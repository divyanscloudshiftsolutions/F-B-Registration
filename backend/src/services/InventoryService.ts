import { PrismaClient } from '@prisma/client';
import { redisService } from './RedisService';
import { getIO, SOCKET_EVENTS } from '../realtime';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

// In-memory reservation tracker for fallback / instant aggregation
const activeReservationsMap = new Map<string, { tokenNumber: string; menuItemId: string; quantity: number; expiresAt: number }>();

export class InventoryService {
  /**
   * Startup migration helper ensuring all existing and newly created menu items have an associated StockItem with default stock 50
   */
  async ensureAllItemsHaveStock() {
    try {
      const items = await prisma.menuItem.findMany({
        where: { isArchived: false },
        include: { stockItem: true },
      });

      let createdCount = 0;
      for (const item of items) {
        if (!item.stockItem) {
          await prisma.stockItem.create({
            data: {
              menuItemId: item.id,
              currentStock: 50,
              lowStockThreshold: 5,
              isActive: true,
            },
          });
          createdCount++;
        }
      }

      if (createdCount > 0) {
        logger.info(`[InventoryService] Initialized default StockItem (50) for ${createdCount} menu items.`);
      }
    } catch (err: any) {
      logger.warn('[InventoryService] Error ensuring stock items exist:', { error: err.message });
    }
  }

  /**
   * Helper to safely broadcast stock and availability changes
   */
  public notifyStockUpdated(payload: {
    itemId: string;
    isAvailable: boolean;
    availableStock: number;
    currentStock: number;
    reservedStock?: number;
    name?: string;
    station?: string;
    reason?: string;
    stockQuantity?: number;
  }) {
    try {
      getIO().emit(SOCKET_EVENTS.MENU_UPDATED, {
        action: 'item_availability',
        itemId: payload.itemId,
        details: {
          isAvailable: payload.isAvailable,
          availableStock: payload.availableStock,
          currentStock: payload.currentStock ?? payload.stockQuantity,
          stockQuantity: payload.currentStock ?? payload.stockQuantity,
          reservedStock: payload.reservedStock,
          name: payload.name,
          station: payload.station,
          reason: payload.reason,
        },
      });
    } catch {
      // Ignored if socket server not initialized
    }
  }

  /**
   * Public alias for notifyStockUpdated to maintain consistency across services
   */
  public notifyStockChanged = this.notifyStockUpdated.bind(this);

  /**
   * Get active reserved quantity for a menuItemId across all active customer carts
   */
  async getReservedQuantity(menuItemId: string, excludeTokenNumber?: string): Promise<number> {
    const now = Date.now();
    let total = 0;

    // Scan memory map and prune expired entries
    for (const [key, entry] of activeReservationsMap.entries()) {
      if (entry.expiresAt < now) {
        activeReservationsMap.delete(key);
      } else if (entry.menuItemId === menuItemId) {
        if (!excludeTokenNumber || entry.tokenNumber !== excludeTokenNumber) {
          total += entry.quantity;
        }
      }
    }

    return total;
  }

  /**
   * Get available-to-sell stock for a specific menuItemId
   */
  async getAvailableStock(menuItemId: string, forTokenNumber?: string): Promise<{
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    availableForToken: number;
    isAvailable: boolean;
  }> {
    const item = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: { stockItem: true },
    });

    if (!item) {
      return { currentStock: 0, reservedStock: 0, availableStock: 0, availableForToken: 0, isAvailable: false };
    }

    const currentStock = item.stockItem?.currentStock ?? 50;
    const totalReserved = await this.getReservedQuantity(menuItemId);
    const otherReserved = await this.getReservedQuantity(menuItemId, forTokenNumber);
    const availableStock = Math.max(0, currentStock - totalReserved);
    const availableForToken = Math.max(0, currentStock - otherReserved);
    const isPhysicalAvailable = item.isAvailable && currentStock > 0;

    return {
      currentStock,
      reservedStock: totalReserved,
      availableStock,
      availableForToken,
      isAvailable: isPhysicalAvailable,
    };
  }

  /**
   * Reserve cart stock for a dining session token (TTL: 15 minutes / 900 seconds)
   */
  async reserveCartStock(tokenNumber: string, menuItemId: string, quantity: number): Promise<{
    success: boolean;
    availableStock: number;
    availableForToken: number;
    currentStock: number;
    message?: string;
  }> {
    if (!tokenNumber || !menuItemId || quantity < 0) {
      throw new Error('Invalid reservation parameters');
    }

    const item = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: { stockItem: true },
    });

    if (!item || item.isArchived) {
      return { success: false, availableStock: 0, availableForToken: 0, currentStock: 0, message: 'Item not found' };
    }

    // If item is manually 86'd, no reservations allowed
    if (!item.isAvailable) {
      return { success: false, availableStock: 0, availableForToken: 0, currentStock: item.stockItem?.currentStock ?? 0, message: 'Item is currently Out of Stock' };
    }

    const currentStock = item.stockItem?.currentStock ?? 50;
    const otherReserved = await this.getReservedQuantity(menuItemId, tokenNumber);
    const availableForThisToken = Math.max(0, currentStock - otherReserved);

    if (quantity > availableForThisToken) {
      const currentTotalReserved = await this.getReservedQuantity(menuItemId);
      const currentAvailableForOthers = Math.max(0, currentStock - currentTotalReserved);
      return {
        success: false,
        availableStock: currentAvailableForOthers,
        availableForToken: availableForThisToken,
        currentStock,
        message: availableForThisToken > 0 ? `Only ${availableForThisToken} left in stock` : 'Item is currently reserved by other customers',
      };
    }

    const key = `cart:reserve:${tokenNumber}:${menuItemId}`;
    const ttlSeconds = 900; // 15 minutes
    const expiresAt = Date.now() + ttlSeconds * 1000;

    if (quantity === 0) {
      activeReservationsMap.delete(key);
      await redisService.del(key);
    } else {
      activeReservationsMap.set(key, {
        tokenNumber,
        menuItemId,
        quantity,
        expiresAt,
      });
      await redisService.setex(key, ttlSeconds, String(quantity));
    }

    const newTotalReserved = await this.getReservedQuantity(menuItemId);
    const newAvailableStock = Math.max(0, currentStock - newTotalReserved);

    // CRITICAL: isAvailable remains true as long as the physical item is active and has physical stock > 0.
    // Temporary reservation exhaustion (newAvailableStock === 0) is communicated via availableStock: 0 and reason.
    this.notifyStockUpdated({
      itemId: menuItemId,
      isAvailable: item.isAvailable && currentStock > 0,
      availableStock: newAvailableStock,
      currentStock,
      reservedStock: newTotalReserved,
      name: item.name,
      station: item.station,
      reason: newAvailableStock === 0 ? 'RESERVATION_EXHAUSTED' : 'RESERVATION_UPDATED',
    });

    return {
      success: true,
      availableStock: newAvailableStock,
      availableForToken: availableForThisToken,
      currentStock,
      reservedStock: newTotalReserved,
    };
  }

  /**
   * Release reserved cart stock for an item
   */
  async releaseCartStock(tokenNumber: string, menuItemId: string) {
    const key = `cart:reserve:${tokenNumber}:${menuItemId}`;
    activeReservationsMap.delete(key);
    await redisService.del(key);

    const stockInfo = await this.getAvailableStock(menuItemId);
    const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } });

    if (item) {
      this.notifyStockUpdated({
        itemId: menuItemId,
        isAvailable: item.isAvailable && stockInfo.currentStock > 0,
        availableStock: stockInfo.availableStock,
        currentStock: stockInfo.currentStock,
        reservedStock: stockInfo.reservedStock,
        name: item.name,
        station: item.station,
        reason: 'RESERVATION_RELEASED',
      });
    }
  }

  /**
   * Clear all cart reservations for a session (e.g. upon order placement, checkout, or cart clear)
   */
  async clearSessionCartReservations(tokenNumber: string) {
    const affectedItemIds: string[] = [];

    for (const [key, entry] of activeReservationsMap.entries()) {
      if (entry.tokenNumber === tokenNumber) {
        affectedItemIds.push(entry.menuItemId);
        activeReservationsMap.delete(key);
        redisService.del(key).catch(() => {});
      }
    }

    for (const menuItemId of Array.from(new Set(affectedItemIds))) {
      const stockInfo = await this.getAvailableStock(menuItemId);
      const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
      if (item) {
        this.notifyStockUpdated({
          itemId: menuItemId,
          isAvailable: item.isAvailable && stockInfo.currentStock > 0,
          availableStock: stockInfo.availableStock,
          currentStock: stockInfo.currentStock,
          reservedStock: stockInfo.reservedStock,
          name: item.name,
          station: item.station,
          reason: 'RESERVATION_RELEASED',
        });
      }
    }
  }

  /**
   * Set or adjust authoritative stock quantity for a menu item
   */
  async setStockQuantity(menuItemId: string, stockQuantity: number, reason: string, userId?: string) {
    const qty = Math.max(0, Math.floor(Number(stockQuantity) || 0));

    return prisma.$transaction(async (tx) => {
      let stockItem = await tx.stockItem.findUnique({
        where: { menuItemId },
      });

      if (!stockItem) {
        stockItem = await tx.stockItem.create({
          data: {
            menuItemId,
            currentStock: qty,
            lowStockThreshold: 5,
            isActive: true,
          },
        });
      } else {
        const prevStock = stockItem.currentStock;
        stockItem = await tx.stockItem.update({
          where: { id: stockItem.id },
          data: { currentStock: qty },
        });

        await tx.inventoryLog.create({
          data: {
            stockItemId: stockItem.id,
            quantityDelta: qty - prevStock,
            previousStock: prevStock,
            newStock: qty,
            reason,
            userId: userId || null,
          },
        });
      }

      return stockItem;
    });
  }

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
