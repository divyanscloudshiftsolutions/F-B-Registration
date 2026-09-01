import { PrismaClient, Station, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class KdsService {
  /**
   * Get active order tickets filtered for a specific station (KITCHEN or BAR)
   */
  async getStationOrders(station: Station) {
    const activeItems = await prisma.orderItem.findMany({
      where: {
        station: station === Station.KITCHEN ? { in: [Station.KITCHEN, Station.DESSERT] } : station,
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
      placedAt: Date;
      notes: string | null;
      status: OrderStatus;
      items: typeof activeItems;
    }>();

    for (const item of activeItems) {
      if (!ticketMap.has(item.orderId)) {
        ticketMap.set(item.orderId, {
          orderId: item.orderId,
          orderNumber: item.order.orderNumber,
          tableNumber: item.order.table?.tableNumber || 'Unknown',
          placedAt: item.order.placedAt,
          notes: item.order.notes,
          status: item.order.status,
          items: [],
        });
      }
      ticketMap.get(item.orderId)!.items.push(item);
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
            table: true,
            token: true,
          },
        },
      },
    });
  }
}

export const kdsService = new KdsService();
