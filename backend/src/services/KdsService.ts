import { PrismaClient, Station, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class KdsService {
  /**
   * Get active order tickets filtered for a specific station (KITCHEN or BAR)
   */
  async getStationOrders(station: Station) {
    const isKitchen = station === Station.KITCHEN;
    const stationFilter = isKitchen 
      ? { in: [Station.KITCHEN, Station.DESSERT] } 
      : Station.BAR;

    const activeItems = await prisma.orderItem.findMany({
      where: {
        station: stationFilter,
        status: {
          in: [OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY],
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        order: {
          include: {
            table: true,
            token: true,
          },
        },
      },
    });

    // Group items by order ticket
    const ticketMap = new Map<string, {
      orderId: string;
      orderNumber: number;
      tableNumber: string;
      placedAt: string;
      notes: string | null;
      status: OrderStatus;
      isSessionClosed: boolean;
      tokenStatus: string | null;
      items: Array<{
        id: string;
        orderId: string;
        menuItemId: string;
        itemName: string;
        variantName: string | null;
        selectedModifiers: any;
        specialInstructions: string | null;
        quantity: number;
        station: Station;
        status: OrderStatus;
        foodType: any;
        isSessionClosed: boolean;
        tokenStatus: string | null;
        createdAt: string;
        preparedAt: string | null;
        readyAt: string | null;
        servedAt: string | null;
      }>;
    }>();

    for (const item of activeItems) {
      const isTokenActive = item.order?.token
        ? (item.order.token.status === 'ACTIVE' || item.order.token.status === 'EXTENDED')
        : false;
      const isSessionClosed = item.order?.token ? !isTokenActive : false;
      const tokenStatus = item.order?.token?.status || null;

      if (!ticketMap.has(item.orderId)) {
        const placedDate = item.order.placedAt || item.order.createdAt;
        ticketMap.set(item.orderId, {
          orderId: item.orderId,
          orderNumber: item.order.orderNumber,
          tableNumber: item.order.table?.tableNumber || 'Bar',
          placedAt: placedDate ? placedDate.toISOString() : new Date().toISOString(),
          notes: item.order.notes,
          status: item.order.status,
          isSessionClosed,
          tokenStatus,
          items: [],
        });
      }

      ticketMap.get(item.orderId)!.items.push({
        id: item.id,
        orderId: item.orderId,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        variantName: item.variantName,
        selectedModifiers: item.selectedModifiers,
        specialInstructions: item.specialInstructions,
        quantity: item.quantity,
        station: item.station,
        status: item.status,
        foodType: item.foodType,
        isSessionClosed,
        tokenStatus,
        createdAt: item.createdAt.toISOString(),
        preparedAt: item.preparedAt ? item.preparedAt.toISOString() : null,
        readyAt: item.readyAt ? item.readyAt.toISOString() : null,
        servedAt: item.servedAt ? item.servedAt.toISOString() : null,
      });
    }

    return Array.from(ticketMap.values());
  }

  /**
   * Get all items across all stations marked as READY for floor staff delivery
   */
  async getReadyItemsForService() {
    return prisma.orderItem.findMany({
      where: {
        status: OrderStatus.READY,
      },
      orderBy: { readyAt: 'asc' },
      include: {
        order: {
          include: {
            table: {
              include: {
                placeType: true,
              },
            },
            token: true,
            handler: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
      },
    });
  }
}

export const kdsService = new KdsService();

