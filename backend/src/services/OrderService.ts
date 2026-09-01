import { PrismaClient, OrderStatus, OrderSource, Station } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { broadcastOrderCreated, broadcastOrderItemUpdated } from '../realtime';

const prisma = new PrismaClient();

export interface PlaceOrderItemInput {
  menuItemId: string;
  variantName?: string;
  selectedModifiers?: Array<{
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    priceDelta: number;
  }>;
  specialInstructions?: string;
  quantity: number;
}

export interface PlaceOrderInput {
  tokenNumber: string;
  tableId?: string;
  orderSource?: OrderSource;
  handlerId?: string;
  notes?: string;
  items: PlaceOrderItemInput[];
}

export class OrderService {
  /**
   * Place an order authoritatively on the backend with session isolation and inventory validation
   */
  async placeOrder(input: PlaceOrderInput) {
    if (!input.items || input.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // 1. Validate Token / Session Isolation
    const token = await prisma.token.findUnique({
      where: { tokenNumber: input.tokenNumber },
      include: { table: true, customer: true },
    });

    if (!token) {
      throw new Error(`Invalid token: Token ${input.tokenNumber} not found`);
    }

    if (token.status !== 'ACTIVE' && token.status !== 'EXTENDED') {
      throw new Error(`Cannot place order. Token session is in ${token.status} status`);
    }

    const tableId = input.tableId || token.tableId;
    if (!tableId || (token.tableId && input.tableId && token.tableId !== input.tableId)) {
      throw new Error(`Table mismatch: Token does not belong to table ${input.tableId}`);
    }

    // 2. Idempotency Check: Prevent double-click submission within 3 seconds
    const threeSecondsAgo = new Date(Date.now() - 3000);
    const recentOrder = await prisma.order.findFirst({
      where: {
        tokenId: token.id,
        placedAt: { gte: threeSecondsAgo },
      },
      include: { items: true, table: true, token: true },
      orderBy: { placedAt: 'desc' },
    });

    if (recentOrder && recentOrder.items.length === input.items.length) {
      const match = input.items.every((it) =>
        recentOrder.items.some((ri) => ri.menuItemId === it.menuItemId && ri.quantity === it.quantity)
      );
      if (match) {
        return recentOrder;
      }
    }

    // 3. Fetch Menu Items for Server-Side Validation & Price Snapshots
    const menuItemIds = input.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: {
        variants: true,
        modifierGroups: {
          include: { options: true },
        },
        section: true,
        stockItem: true,
      },
    });

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    // 4. Validate Availability, Quantities & Modifiers
    let orderSubtotal = new Decimal(0);
    const validatedOrderItems: Array<{
      menuItemId: string;
      itemName: string;
      sectionSlug: string;
      variantName?: string | null;
      selectedModifiers: any;
      specialInstructions?: string | null;
      quantity: number;
      unitPrice: Decimal;
      lineTotal: Decimal;
      station: Station;
      foodType: any;
      status: OrderStatus;
    }> = [];

    const stockDeductions: Array<{ stockItemId: string; quantity: number; itemName: string }> = [];

    for (const itemInput of input.items) {
      const menuItem = menuItemMap.get(itemInput.menuItemId);
      if (!menuItem) {
        throw new Error(`MenuItem ${itemInput.menuItemId} does not exist`);
      }

      if (!menuItem.isAvailable) {
        throw new Error(`Item "${menuItem.name}" is currently 86'd / unavailable`);
      }

      const qty = Math.floor(Number(itemInput.quantity));
      if (!qty || qty <= 0 || !Number.isInteger(qty)) {
        throw new Error(`Invalid quantity ${itemInput.quantity} for "${menuItem.name}". Must be a positive integer`);
      }

      // Check numeric stock if tracked
      if (menuItem.stockItem && menuItem.stockItem.isActive) {
        stockDeductions.push({
          stockItemId: menuItem.stockItem.id,
          quantity: qty,
          itemName: menuItem.name,
        });
      }

      let baseUnitPrice = new Decimal(menuItem.basePrice);

      // Validate Variant Price Delta
      if (itemInput.variantName) {
        const matchingVariant = menuItem.variants.find((v) => v.name === itemInput.variantName);
        if (matchingVariant) {
          baseUnitPrice = baseUnitPrice.plus(matchingVariant.priceDelta);
        }
      }

      // Validate Modifiers Price Deltas
      const safeModifiers = itemInput.selectedModifiers || [];
      for (const mod of safeModifiers) {
        if (mod.priceDelta) {
          baseUnitPrice = baseUnitPrice.plus(new Decimal(mod.priceDelta));
        }
      }

      const lineTotal = baseUnitPrice.times(qty);
      orderSubtotal = orderSubtotal.plus(lineTotal);

      validatedOrderItems.push({
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        sectionSlug: menuItem.section.slug,
        variantName: itemInput.variantName || null,
        selectedModifiers: safeModifiers,
        specialInstructions: itemInput.specialInstructions ? itemInput.specialInstructions.slice(0, 250) : null,
        quantity: qty,
        unitPrice: baseUnitPrice,
        lineTotal: lineTotal,
        station: menuItem.station,
        foodType: menuItem.foodType,
        status: OrderStatus.PLACED,
      });
    }

    // 5. Determine next order number for this session
    const existingOrdersCount = await prisma.order.count({
      where: { tokenId: token.id },
    });
    const orderNumber = existingOrdersCount + 1;

    // 6. Execute Transactional Order Creation with Atomic Inventory Lock
    const createdOrder = await prisma.$transaction(async (tx) => {
      // Validate and deduct stock atomically
      for (const deduction of stockDeductions) {
        const stock = await tx.stockItem.findUnique({
          where: { id: deduction.stockItemId },
        });
        if (!stock || stock.currentStock < deduction.quantity) {
          throw new Error(`Insufficient stock for "${deduction.itemName}". Available: ${stock?.currentStock || 0}`);
        }

        const newStock = stock.currentStock - deduction.quantity;
        await tx.stockItem.update({
          where: { id: stock.id },
          data: { currentStock: newStock },
        });

        await tx.inventoryLog.create({
          data: {
            stockItemId: stock.id,
            quantityDelta: -deduction.quantity,
            previousStock: stock.currentStock,
            newStock,
            reason: 'ORDER_DEDUCTION',
            userId: input.handlerId || null,
          },
        });
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          tokenId: token.id,
          tableId,
          customerId: token.customerId,
          orderSource: input.orderSource || OrderSource.CUSTOMER,
          handlerId: input.handlerId || null,
          subtotal: orderSubtotal,
          status: OrderStatus.PLACED,
          notes: input.notes || null,
          items: {
            create: validatedOrderItems,
          },
        },
        include: {
          items: true,
          table: true,
          token: true,
        },
      });

      return createdOrder;
    });

    // Broadcast order.created in real-time after successful DB commit
    try {
      broadcastOrderCreated({
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        tokenNumber: token.tokenNumber,
        tableId: createdOrder.tableId,
        tableNumber: token.table?.tableNumber || 'N/A',
        orderSource: createdOrder.orderSource,
        handlerId: createdOrder.handlerId,
        items: createdOrder.items.map((i) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          itemName: i.itemName,
          variantName: i.variantName,
          selectedModifiers: i.selectedModifiers,
          specialInstructions: i.specialInstructions,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          lineTotal: Number(i.lineTotal),
          station: i.station,
          status: i.status,
          foodType: i.foodType,
        })),
        subtotal: Number(createdOrder.subtotal),
        placedAt: createdOrder.placedAt.toISOString(),
      });
    } catch (broadcastErr) {
      console.warn('Real-time order broadcast error:', broadcastErr);
    }

    return createdOrder;
  }

  /**
   * Get all active orders for a token session
   */
  async getOrdersForToken(tokenIdOrNumber: string) {
    let tokenId = tokenIdOrNumber;
    if (tokenIdOrNumber.startsWith('BAR-')) {
      const t = await prisma.token.findUnique({ where: { tokenNumber: tokenIdOrNumber } });
      if (!t) return [];
      tokenId = t.id;
    }

    return prisma.order.findMany({
      where: { tokenId },
      orderBy: { placedAt: 'asc' },
      include: {
        items: true,
        table: true,
      },
    });
  }

  /**
   * Update item status with strict State Machine enforcement
   */
  async updateOrderItemStatus(orderItemId: string, status: OrderStatus, staffUserId?: string) {
    const item = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    });

    if (!item) {
      throw new Error(`OrderItem ${orderItemId} not found`);
    }

    // State Machine Validation Rules
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PLACED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.SERVED],
      [OrderStatus.SERVED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (item.status !== status && !validTransitions[item.status]?.includes(status)) {
      throw new Error(`Invalid status transition from ${item.status} to ${status}`);
    }

    const timestampData: any = { status };
    const now = new Date();
    if (status === OrderStatus.PREPARING && !item.preparedAt) {
      timestampData.preparedAt = now;
    } else if (status === OrderStatus.READY && !item.readyAt) {
      timestampData.readyAt = now;
    } else if (status === OrderStatus.SERVED && !item.servedAt) {
      timestampData.servedAt = now;
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: orderItemId },
      data: timestampData,
    });

    // Check if all items in order have reached at least this status
    const allOrderItems = await prisma.orderItem.findMany({
      where: { orderId: item.orderId },
    });

    const allReady = allOrderItems.every((i) => i.status === OrderStatus.READY || i.status === OrderStatus.SERVED);
    const allServed = allOrderItems.every((i) => i.status === OrderStatus.SERVED);

    if (allServed) {
      await prisma.order.update({
        where: { id: item.orderId },
        data: { status: OrderStatus.SERVED },
      });
    } else if (allReady) {
      await prisma.order.update({
        where: { id: item.orderId },
        data: { status: OrderStatus.READY },
      });
    } else if (status === OrderStatus.PREPARING) {
      await prisma.order.update({
        where: { id: item.orderId },
        data: { status: OrderStatus.PREPARING },
      });
    }

    // Broadcast order.item.updated after successful DB commit
    try {
      const orderWithToken = await prisma.order.findUnique({
        where: { id: item.orderId },
        include: { token: true, table: true },
      });

      broadcastOrderItemUpdated({
        orderId: item.orderId,
        orderItemId: updatedItem.id,
        orderNumber: orderWithToken?.orderNumber || 0,
        tokenNumber: orderWithToken?.token?.tokenNumber || '',
        tableId: orderWithToken?.tableId || '',
        tableNumber: orderWithToken?.table?.tableNumber,
        station: updatedItem.station,
        itemName: updatedItem.itemName,
        variantName: updatedItem.variantName,
        selectedModifiers: updatedItem.selectedModifiers,
        specialInstructions: updatedItem.specialInstructions,
        quantity: updatedItem.quantity,
        previousStatus: item.status,
        status: updatedItem.status,
        preparedAt: updatedItem.preparedAt ? updatedItem.preparedAt.toISOString() : null,
        readyAt: updatedItem.readyAt ? updatedItem.readyAt.toISOString() : null,
        servedAt: updatedItem.servedAt ? updatedItem.servedAt.toISOString() : null,
        updatedAt: now.toISOString(),
      });
    } catch (broadcastErr) {
      console.warn('Real-time order item broadcast error:', broadcastErr);
    }

    return updatedItem;
  }
}

export const orderService = new OrderService();
