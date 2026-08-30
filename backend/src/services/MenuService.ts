import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class MenuService {
  /**
   * Get complete hierarchical menu catalog (sections -> categories -> subcategories -> items with variants and modifiers)
   */
  async getFullMenu(includeUnavailable = false) {
    const sections = await prisma.menuSection.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            subcategories: {
              orderBy: { sortOrder: 'asc' },
            },
            items: {
              where: includeUnavailable ? {} : { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                variants: {
                  orderBy: { sortOrder: 'asc' },
                },
                modifierGroups: {
                  include: {
                    options: {
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
                stockItem: true,
              },
            },
          },
        },
      },
    });

    return sections;
  }

  /**
   * Get all menu categories
   */
  async getCategories() {
    return prisma.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        section: true,
        subcategories: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  /**
   * Operational 86 toggle
   */
  async setItemAvailability(itemId: string, isAvailable: boolean) {
    const item = await prisma.menuItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error(`MenuItem with ID ${itemId} not found`);
    }

    return prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable },
    });
  }

  /**
   * Get active promotions
   */
  async getActivePromotions() {
    return prisma.promotion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const menuService = new MenuService();
