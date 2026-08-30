import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InventoryService {
  /**
   * Get all tracked stock items with low-stock status
   */
  async getInventoryOverview() {
    const items = await prisma.stockItem.findMany({
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            station: true,
            basePrice: true,
            isAvailable: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.menuItem.name,
      station: item.menuItem.station,
      currentStock: item.currentStock,
      unitOfMeasure: item.unitOfMeasure,
      lowStockThreshold: item.lowStockThreshold,
      isLowStock: item.currentStock <= item.lowStockThreshold,
      isAvailable: item.menuItem.isAvailable,
      isActive: item.isActive,
    }));
  }

  /**
   * Adjust stock manually (e.g. restock or wastage)
   */
  async adjustStock(input: {
    stockItemId: string;
    quantityDelta: number;
    reason: string;
    userId?: string;
    referenceId?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const stock = await tx.stockItem.findUnique({
        where: { id: input.stockItemId },
      });

      if (!stock) {
        throw new Error(`StockItem ${input.stockItemId} not found`);
      }

      const newStock = stock.currentStock + input.quantityDelta;
      if (newStock < 0) {
        throw new Error(`Adjustment would result in negative stock: ${newStock}`);
      }

      const updated = await tx.stockItem.update({
        where: { id: stock.id },
        data: { currentStock: newStock },
      });

      await tx.inventoryLog.create({
        data: {
          stockItemId: stock.id,
          quantityDelta: input.quantityDelta,
          previousStock: stock.currentStock,
          newStock,
          reason: input.reason,
          referenceId: input.referenceId || null,
          userId: input.userId || null,
        },
      });

      return updated;
    });
  }
}

export const inventoryService = new InventoryService();
