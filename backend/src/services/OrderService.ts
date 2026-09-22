import { PrismaClient, OrderStatus, OrderSource, Station } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { broadcastOrderCreated, broadcastOrderItemUpdated } from '../realtime';
import { inventoryService } from './InventoryService';
import { menuService } from './MenuService';

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
    name?: string;
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

    if (!token.paymentVerified) {
      throw new Error('Cannot place order: Session payment has not been verified yet. Please complete payment at the counter.');
    }

    if (token.table?.status === 'SETTLING') {
      throw new Error('Ordering is locked: Bill settlement is in progress for this table.');
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
    const [menuItems, venueConfig] = await Promise.all([
      prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        include: {
          variants: true,
          modifierGroups: {
            include: { options: true },
          },
          section: true,
          stockItem: true,
          gstTaxTag: true,
        },
      }),
      prisma.venueConfig.findUnique({ where: { id: 'default' } }),
    ]);

    const isGstGloballyEnabled = venueConfig?.gstEnabled ?? true;
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
      gstTaxTagId?: string | null;
      gstTaxTagName?: string | null;
      gstRate?: Decimal;
      gstAmount?: Decimal;
    }> = [];

    const stockDeductions: Array<{ stockItemId: string; menuItemId: string; quantity: number; itemName: string; newStock?: number }> = [];

    for (const itemInput of input.items) {
      const menuItem = menuItemMap.get(itemInput.menuItemId);
      if (!menuItem || menuItem.isArchived) {
        throw new Error(`MenuItem ${itemInput.menuItemId} does not exist or has been archived`);
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
          menuItemId: menuItem.id,
          quantity: qty,
          itemName: menuItem.name,
        });
      }

      let baseUnitPrice = new Decimal(menuItem.finalPrice ?? menuItem.basePrice);

      // Validate Variant Price Delta
      if (itemInput.variantName) {
        const matchingVariant = menuItem.variants.find((v) => v.name === itemInput.variantName);
        if (matchingVariant) {
          baseUnitPrice = baseUnitPrice.plus(matchingVariant.priceDelta);
        }
      }

      // Validate Modifiers Price Deltas strictly from DB authoritative options
      const safeModifiers: any[] = [];
      const clientModifiers = itemInput.selectedModifiers || [];
      for (const clientMod of clientModifiers) {
        let foundOpt: any = null;
        let foundGroup: any = null;

        for (const mg of menuItem.modifierGroups) {
          const opt = mg.options.find(
            (o) =>
              (clientMod.optionId && o.id === clientMod.optionId) ||
              o.name.toLowerCase() === (clientMod.optionName || clientMod.name || '').toLowerCase()
          );
          if (opt) {
            foundOpt = opt;
            foundGroup = mg;
            break;
          }
        }

        const authoritativeDelta = foundOpt ? new Decimal(foundOpt.priceDelta) : new Decimal(0);
        baseUnitPrice = baseUnitPrice.plus(authoritativeDelta);

        safeModifiers.push({
          groupId: foundGroup?.id || clientMod.groupId || '',
          groupName: foundGroup?.name || clientMod.groupName || '',
          optionId: foundOpt?.id || clientMod.optionId || '',
          optionName: foundOpt?.name || clientMod.optionName || clientMod.name || '',
          priceDelta: authoritativeDelta.toNumber(),
        });
      }

      const lineTotal = baseUnitPrice.times(qty);
      orderSubtotal = orderSubtotal.plus(lineTotal);

      // Resolve GST snapshot values
      let itemGstRate = new Decimal(0);
      let itemGstTagName = 'No GST';
      let itemGstTagId: string | null = null;

      if (isGstGloballyEnabled) {
        if (menuItem.gstTaxTag) {
          itemGstRate = new Decimal(menuItem.gstTaxTag.rate);
          itemGstTagName = menuItem.gstTaxTag.name;
          itemGstTagId = menuItem.gstTaxTag.id;
        } else if (venueConfig?.gstRate) {
          itemGstRate = new Decimal(venueConfig.gstRate);
          itemGstTagName = `${itemGstRate.times(100).toNumber()}% GST`;
        }
      }

      const itemGstAmount = lineTotal.times(itemGstRate).toDecimalPlaces(2);

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
        gstTaxTagId: itemGstTagId,
        gstTaxTagName: itemGstTagName,
        gstRate: itemGstRate,
        gstAmount: itemGstAmount,
      });
    }

    // 5. Determine next order number for this session
    const existingOrdersCount = await prisma.order.count({
      where: { tokenId: token.id },
    });
    const orderNumber = existingOrdersCount + 1;

    // 6. Execute Transactional Order Creation with Atomic Inventory Lock
    const zeroStockItemIds: string[] = [];
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
        deduction.newStock = newStock;
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

        if (newStock === 0) {
          zeroStockItemIds.push(deduction.menuItemId);
          await tx.menuItem.update({
            where: { id: deduction.menuItemId },
            data: { isAvailable: false },
          });
        }
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

    // 7. Clear Cart Reservations for this session
    try {
      await inventoryService.clearSessionCartReservations(token.tokenNumber);
    } catch (clearErr) {
      console.warn('[OrderService] Failed to clear cart reservations after order:', clearErr);
    }

    // 8. Auto-Stock-Out cascade for items that reached 0 stock
    for (const zeroItemId of zeroStockItemIds) {
      try {
        await menuService.setItemAvailability(zeroItemId, false);
      } catch (zeroErr) {
        console.warn(`[OrderService] Failed to execute auto stock-out for item ${zeroItemId}:`, zeroErr);
      }
    }

    // 9. Invalidate menu cache & notify real-time stock changes for deducted items
    try {
      await menuService.invalidateMenuCache();
      for (const deduction of stockDeductions) {
        if (!zeroStockItemIds.includes(deduction.menuItemId)) {
          const currentStock = deduction.newStock ?? 0;
          const reserved = await inventoryService.getReservedQuantity(deduction.menuItemId);
          const availableStock = Math.max(0, currentStock - reserved);
          inventoryService.notifyStockChanged({
            itemId: deduction.menuItemId,
            stockQuantity: currentStock,
            availableStock,
            isAvailable: currentStock > 0,
          });
        }
      }
    } catch (syncErr) {
      console.warn('[OrderService] Failed to sync stock changes after order:', syncErr);
    }

    // 10. Broadcast order.created in real-time after successful DB commit
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
  async getOrdersForToken(tokenIdOrNumber?: string, tableId?: string, tableNumber?: string) {
    let resolvedTokenId: string | undefined;

    if (tokenIdOrNumber) {
      const t = await prisma.token.findFirst({
        where: {
          OR: [
            { id: tokenIdOrNumber },
            { tokenNumber: tokenIdOrNumber },
          ],
        },
      });
      if (t) {
        resolvedTokenId = t.id;
      }
    }

    if (!resolvedTokenId && (tableId || tableNumber)) {
      const t = await prisma.token.findFirst({
        where: {
          ...(tableId ? { tableId } : {}),
          ...(tableNumber ? { table: { tableNumber } } : {}),
          status: { in: [TokenStatus.ACTIVE, TokenStatus.EXTENDED] },
        },
        orderBy: { issuedAt: 'desc' },
      });
      if (t) {
        resolvedTokenId = t.id;
      }
    }

    const whereClause: any = {};
    if (resolvedTokenId) {
      whereClause.tokenId = resolvedTokenId;
    } else if (tableId) {
      whereClause.tableId = tableId;
    } else if (tableNumber) {
      whereClause.table = { tableNumber };
    } else if (tokenIdOrNumber) {
      whereClause.tokenId = tokenIdOrNumber;
    } else {
      return [];
    }

    return prisma.order.findMany({
      where: whereClause,
      orderBy: { placedAt: 'asc' },
      include: {
        items: true,
        table: true,
      },
    });
  }

  /**
   * Retrieve all completed historical orders for an authenticated customer identity
   */
  async getCustomerOrderHistory(customerId: string) {
    if (!customerId) return [];

    const orders = await prisma.order.findMany({
      where: {
        customerId,
        status: { in: [OrderStatus.SERVED, OrderStatus.CANCELLED] },
      },
      orderBy: { placedAt: 'desc' },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
        table: {
          select: {
            id: true,
            tableNumber: true,
            placeType: {
              select: { name: true },
            },
          },
        },
        token: {
          select: {
            id: true,
            tokenNumber: true,
            status: true,
            startTime: true,
            endTime: true,
            closedAt: true,
          },
        },
      },
    });

    return orders.map((o) => {
      const itemServedTimes = o.items
        .map((i) => (i.servedAt ? new Date(i.servedAt).getTime() : 0))
        .filter((t) => t > 0);
      const latestServedTimestamp =
        itemServedTimes.length > 0
          ? new Date(Math.max(...itemServedTimes)).toISOString()
          : (o.updatedAt ? o.updatedAt.toISOString() : o.placedAt.toISOString());

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        placedAt: o.placedAt ? o.placedAt.toISOString() : o.createdAt.toISOString(),
        createdAt: o.createdAt.toISOString(),
        completedAt: latestServedTimestamp,
        subtotal: Number(o.subtotal || 0),
        notes: o.notes,
        tableId: o.tableId,
        tokenId: o.tokenId,
        sessionId: o.tokenId,
        tableNumber: o.table?.tableNumber || 'N/A',
        areaName: o.table?.placeType?.name || 'Dine-In',
        sessionTokenNumber: o.token?.tokenNumber || 'N/A',
        sessionStatus: o.token?.status || 'CLOSED',
        sessionStartTime: o.token?.startTime ? o.token.startTime.toISOString() : null,
        sessionClosedAt: o.token?.closedAt ? o.token.closedAt.toISOString() : null,
        totalItemsCount: (o.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
        items: o.items.map((it) => ({
          id: it.id,
          menuItemId: it.menuItemId,
          itemName: it.itemName,
          sectionSlug: it.sectionSlug,
          variantName: it.variantName,
          selectedModifiers: it.selectedModifiers,
          specialInstructions: it.specialInstructions,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          lineTotal: Number(it.lineTotal),
          station: it.station,
          foodType: it.foodType,
          status: it.status,
          servedAt: it.servedAt ? it.servedAt.toISOString() : null,
        })),
      };
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

    // State Machine Validation Rules (forward and 1-step corrective reverse transitions)
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PLACED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED, OrderStatus.STOCK_OUT],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.PLACED, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.SERVED, OrderStatus.PREPARING],
      [OrderStatus.SERVED]: [OrderStatus.READY],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.STOCK_OUT]: [],
    };

    if (item.status !== status && !validTransitions[item.status]?.includes(status)) {
      throw new Error(`Invalid status transition from ${item.status} to ${status}`);
    }

    if (staffUserId) {
      const staffUser = await prisma.user.findUnique({
        where: { id: staffUserId },
        include: { role: true },
      });

      if (staffUser) {
        const roleName = (staffUser.role?.name || '').toLowerCase();
        if (roleName === 'chef') {
          if (item.station !== Station.KITCHEN && item.station !== Station.DESSERT) {
            throw new Error('Chef is only authorized to manage Kitchen and Dessert items');
          }
        } else if (roleName === 'bartender') {
          if (item.station !== Station.BAR) {
            throw new Error('Bartender is only authorized to manage Bar items');
          }
        } else if (['waiter', 'server'].includes(roleName)) {
          const isServing = status === OrderStatus.SERVED && item.status === OrderStatus.READY;
          const isUndoing = status === OrderStatus.READY && item.status === OrderStatus.SERVED;
          if (!isServing && !isUndoing) {
            throw new Error('Waiters and Servers are only authorized to mark Ready items as Served and undo recent serves');
          }
        }
      }
    }

    const now = new Date();
    const timestampData: any = { status };

    if (status === OrderStatus.PLACED) {
      timestampData.preparedAt = null;
      timestampData.readyAt = null;
      timestampData.servedAt = null;
    } else if (status === OrderStatus.ACCEPTED) {
      timestampData.preparedAt = null;
      timestampData.readyAt = null;
      timestampData.servedAt = null;
    } else if (status === OrderStatus.PREPARING) {
      timestampData.preparedAt = now;
      timestampData.readyAt = null;
      timestampData.servedAt = null;
    } else if (status === OrderStatus.READY) {
      timestampData.readyAt = now;
      timestampData.servedAt = null;
    } else if (status === OrderStatus.SERVED) {
      timestampData.servedAt = now;
    } else if (status === OrderStatus.STOCK_OUT) {
      timestampData.preparedAt = null;
      timestampData.readyAt = null;
      timestampData.servedAt = null;
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: orderItemId },
      data: timestampData,
    });

    // Check if all items in order have reached at least this status
    const allOrderItems = await prisma.orderItem.findMany({
      where: { orderId: item.orderId },
    });

    const activeItems = allOrderItems.filter(
      (i) => i.status !== OrderStatus.CANCELLED && i.status !== OrderStatus.STOCK_OUT
    );
    const allCancelled = allOrderItems.length > 0 && activeItems.length === 0;
    const allServed = activeItems.length > 0 && activeItems.every((i) => i.status === OrderStatus.SERVED);
    const allReady = activeItems.length > 0 && activeItems.every((i) => i.status === OrderStatus.READY || i.status === OrderStatus.SERVED);

    let newOrderStatus = OrderStatus.PLACED;
    if (allCancelled) {
      newOrderStatus = OrderStatus.CANCELLED;
    } else if (allServed) {
      newOrderStatus = OrderStatus.SERVED;
    } else if (allReady) {
      newOrderStatus = OrderStatus.READY;
    } else if (activeItems.some((i) => i.status === OrderStatus.PREPARING || i.status === OrderStatus.READY || i.status === OrderStatus.SERVED)) {
      newOrderStatus = OrderStatus.PREPARING;
    } else if (activeItems.some((i) => i.status === OrderStatus.ACCEPTED)) {
      newOrderStatus = OrderStatus.ACCEPTED;
    } else {
      newOrderStatus = OrderStatus.PLACED;
    }

    const newSubtotal = activeItems.reduce(
      (sum, i) => sum.plus(new Decimal(i.lineTotal)),
      new Decimal(0)
    );

    await prisma.order.update({
      where: { id: item.orderId },
      data: {
        status: newOrderStatus,
        subtotal: newSubtotal,
      },
    });

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

  /**
   * Cancel/Delete an individual order item by customer before KDS acceptance
   */
  async cancelOrderItemByCustomer(orderItemId: string, tokenNumber: string) {
    const item = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          include: {
            token: true,
            table: true,
          },
        },
        menuItem: {
          include: {
            stockItem: true,
          },
        },
      },
    });

    if (!item) {
      throw new Error('Order item not found');
    }

    // Validate that the item belongs to the customer's session
    if (
      item.order?.token?.tokenNumber !== tokenNumber &&
      item.order?.tokenId !== tokenNumber
    ) {
      throw new Error('Unauthorized: Item does not belong to this dining session');
    }

    // Authoritative KDS Accept lock check
    if (item.status !== OrderStatus.PLACED) {
      throw new Error('Cannot delete item: This item has already been accepted by the kitchen/bar for preparation.');
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Restore inventory stock if tracked
      if (item.menuItem?.stockItem && item.menuItem.stockItem.isActive) {
        const stock = await tx.stockItem.findUnique({
          where: { id: item.menuItem.stockItem.id },
        });
        if (stock) {
          const newStock = stock.currentStock + item.quantity;
          await tx.stockItem.update({
            where: { id: stock.id },
            data: { currentStock: newStock },
          });

          await tx.inventoryLog.create({
            data: {
              stockItemId: stock.id,
              quantityDelta: item.quantity,
              previousStock: stock.currentStock,
              newStock,
              reason: 'ORDER_CANCELLATION',
              userId: null,
            },
          });
        }
      }

      // Mark order item status as CANCELLED
      const updatedItem = await tx.orderItem.update({
        where: { id: orderItemId },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      // Recalculate parent order subtotal and overall status
      const allOrderItems = await tx.orderItem.findMany({
        where: { orderId: item.orderId },
      });

      const activeItems = allOrderItems.filter((i) => i.status !== OrderStatus.CANCELLED);
      const newSubtotal = activeItems.reduce(
        (sum, i) => sum.plus(new Decimal(i.lineTotal)),
        new Decimal(0)
      );

      let newOrderStatus = OrderStatus.PLACED;
      if (allOrderItems.length > 0 && activeItems.length === 0) {
        newOrderStatus = OrderStatus.CANCELLED;
      } else if (activeItems.every((i) => i.status === OrderStatus.SERVED)) {
        newOrderStatus = OrderStatus.SERVED;
      } else if (activeItems.every((i) => i.status === OrderStatus.READY || i.status === OrderStatus.SERVED)) {
        newOrderStatus = OrderStatus.READY;
      } else if (activeItems.some((i) => i.status === OrderStatus.PREPARING || i.status === OrderStatus.READY || i.status === OrderStatus.SERVED)) {
        newOrderStatus = OrderStatus.PREPARING;
      } else if (activeItems.some((i) => i.status === OrderStatus.ACCEPTED)) {
        newOrderStatus = OrderStatus.ACCEPTED;
      } else {
        newOrderStatus = OrderStatus.PLACED;
      }

      await tx.order.update({
        where: { id: item.orderId },
        data: {
          subtotal: newSubtotal,
          status: newOrderStatus,
        },
      });

      return { updatedItem, newOrderStatus, newSubtotal };
    });

    // Broadcast real-time order item update
    try {
      broadcastOrderItemUpdated({
        orderId: item.orderId,
        orderItemId: item.id,
        orderNumber: item.order.orderNumber,
        tokenNumber: item.order.token?.tokenNumber || '',
        tableId: item.order.tableId,
        tableNumber: item.order.table?.tableNumber,
        station: item.station,
        itemName: item.itemName,
        variantName: item.variantName,
        selectedModifiers: item.selectedModifiers,
        specialInstructions: item.specialInstructions,
        quantity: item.quantity,
        previousStatus: item.status,
        status: OrderStatus.CANCELLED,
        preparedAt: null,
        readyAt: null,
        servedAt: null,
        updatedAt: now.toISOString(),
      });
    } catch (broadcastErr) {
      console.warn('Real-time cancellation broadcast error:', broadcastErr);
    }

    return result.updatedItem;
  }
}

export const orderService = new OrderService();
