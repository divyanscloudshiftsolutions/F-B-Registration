import { PrismaClient, FoodType, Station, OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { redisService } from './RedisService';
import { inventoryService } from './InventoryService';
import { getIO, SOCKET_EVENTS, broadcastOrderItemUpdated } from '../realtime';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class MenuService {
  /**
   * Helper to safely broadcast menu updates
   */
  private notifyMenuUpdated(payload: { action: string; itemId?: string; details?: any }) {
    try {
      getIO().emit(SOCKET_EVENTS.MENU_UPDATED, payload);
    } catch {
      // Ignored if socket server not initialized (e.g. testing)
    }
  }

  /**
   * Invalidate Redis cache for menu catalog
   */
  async invalidateMenuCache() {
    try {
      await redisService.del('menu:full');
      await redisService.del('menu:full:admin');
      await redisService.del('menu:categories');
    } catch (err: any) {
      logger.warn('[MenuService] Failed to clear menu cache:', { error: err.message });
    }
  }

  /**
   * Mathematical Offer & Discount calculation
   */
  computeFinalPrice(
    basePriceInput: number | string | Decimal,
    discountModeInput?: string,
    discountValueInput?: number | string | Decimal
  ) {
    const basePrice = Math.round(Number(basePriceInput) * 100) / 100;
    if (isNaN(basePrice) || basePrice <= 0) {
      throw new Error('Base price must be a positive number greater than 0');
    }

    const discountMode = discountModeInput === 'PERCENTAGE' ? 'PERCENTAGE' : 'AMOUNT';
    let discountValue = Math.round(Number(discountValueInput || 0) * 100) / 100;
    if (isNaN(discountValue) || discountValue < 0) {
      discountValue = 0;
    }

    let finalPrice = basePrice;
    if (discountMode === 'PERCENTAGE') {
      if (discountValue > 100) discountValue = 100;
      finalPrice = Math.max(0, Math.round(basePrice * (1 - discountValue / 100) * 100) / 100);
    } else {
      if (discountValue > basePrice) discountValue = basePrice;
      finalPrice = Math.max(0, Math.round((basePrice - discountValue) * 100) / 100);
    }

    return {
      basePrice: new Decimal(basePrice),
      discountMode,
      discountValue: new Decimal(discountValue),
      finalPrice: new Decimal(finalPrice),
    };
  }

  /**
   * Get complete hierarchical menu catalog (sections -> categories -> subcategories -> items)
   */
  async getFullMenu(includeUnavailable = false) {
    const cacheKey = includeUnavailable ? 'menu:full:admin' : 'menu:full';

    // 1. Try cache
    try {
      const cached = await redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err: any) {
      logger.warn('[MenuService] Redis get failed:', { error: err.message });
    }

    // 2. Query DB
    const sections = await prisma.menuSection.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: includeUnavailable
            ? { categoryId: null, isArchived: false }
            : { categoryId: null, isAvailable: true, isArchived: false },
          orderBy: { sortOrder: 'asc' },
          include: {
            subcategory: true,
            gstTaxTag: true,
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
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            subcategories: {
              orderBy: { sortOrder: 'asc' },
            },
            items: {
              where: includeUnavailable
                ? { isArchived: false }
                : { isAvailable: true, isArchived: false },
              orderBy: { sortOrder: 'asc' },
              include: {
                subcategory: true,
                gstTaxTag: true,
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

    const mappedSections = await Promise.all(
      sections.map(async (s) => {
        const mappedDirectItems = await Promise.all(
          (s.items || []).map(async (it: any) => {
            const currentStock = it.stockItem?.currentStock ?? 50;
            const reserved = await inventoryService.getReservedQuantity(it.id);
            const availableStock = Math.max(0, currentStock - reserved);
            return {
              ...it,
              stockQuantity: currentStock,
              availableStock,
            };
          })
        );

        const mappedCategories = await Promise.all(
          (s.categories || []).map(async (cat: any) => {
            const mappedCatItems = await Promise.all(
              (cat.items || []).map(async (it: any) => {
                const currentStock = it.stockItem?.currentStock ?? 50;
                const reserved = await inventoryService.getReservedQuantity(it.id);
                const availableStock = Math.max(0, currentStock - reserved);
                return {
                  ...it,
                  stockQuantity: currentStock,
                  availableStock,
                };
              })
            );

            const mappedSubcategories = await Promise.all(
              (cat.subcategories || []).map(async (sub: any) => {
                const mappedSubItems = await Promise.all(
                  ((sub as any).items || []).map(async (it: any) => {
                    const currentStock = it.stockItem?.currentStock ?? 50;
                    const reserved = await inventoryService.getReservedQuantity(it.id);
                    const availableStock = Math.max(0, currentStock - reserved);
                    return {
                      ...it,
                      stockQuantity: currentStock,
                      availableStock,
                    };
                  })
                );
                return {
                  ...sub,
                  items: mappedSubItems,
                };
              })
            );

            return {
              ...cat,
              items: mappedCatItems,
              subcategories: mappedSubcategories,
            };
          })
        );

        return {
          ...s,
          name: s.slug === 'eat' ? 'Food' : s.name,
          items: mappedDirectItems,
          categories: mappedCategories,
        };
      })
    );

    // 3. Cache for 2 minutes (short TTL to keep real-time stock sync fresh)
    try {
      await redisService.setex(cacheKey, 120, JSON.stringify(mappedSections));
    } catch (err: any) {
      logger.warn('[MenuService] Redis setex failed:', { error: err.message });
    }

    return mappedSections;
  }

  /**
   * Get all menu categories with subcategories
   */
  async getCategories() {
    const cacheKey = 'menu:categories';
    try {
      const cached = await redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // ignore
    }

    const categories = await prisma.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        section: true,
        subcategories: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const mappedCategories = categories.map((c) => {
      if (c.section && c.section.slug === 'eat') {
        return { ...c, section: { ...c.section, name: 'Food' } };
      }
      return c;
    });

    try {
      await redisService.setex(cacheKey, 600, JSON.stringify(mappedCategories));
    } catch {
      // ignore
    }

    return mappedCategories;
  }

  /**
   * Create Menu Category
   */
  async createCategory(data: {
    sectionId: string;
    name: string;
    slug?: string;
    description?: string;
    sortOrder?: number;
  }) {
    const baseSlug = data.slug ? generateSlug(data.slug) : generateSlug(data.name);
    let finalSlug = baseSlug;
    const existing = await prisma.menuCategory.findUnique({ where: { slug: finalSlug } });
    if (existing) {
      finalSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }

    const category = await prisma.menuCategory.create({
      data: {
        sectionId: data.sectionId,
        name: data.name,
        slug: finalSlug,
        description: data.description || null,
        sortOrder: data.sortOrder ?? 1,
      },
      include: {
        section: true,
        subcategories: true,
      },
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({ action: 'category_created', details: category });
    return category;
  }

  /**
   * Update Menu Category
   */
  async updateCategory(
    id: string,
    data: {
      name?: string;
      description?: string;
      sortOrder?: number;
      sectionId?: string;
    }
  ) {
    const category = await prisma.menuCategory.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.sectionId && { sectionId: data.sectionId }),
      },
      include: {
        section: true,
        subcategories: true,
      },
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({ action: 'category_updated', details: category });
    return category;
  }

  /**
   * Delete Menu Category safely without deleting products
   */
  async deleteCategory(id: string) {
    const category = await prisma.menuCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new Error(`Category with ID ${id} not found`);
    }

    // Atomic transaction: Unlink all affected items, delete child subcategories, delete category
    await prisma.$transaction(async (tx) => {
      // 1. Unlink assigned products (categoryId = null, subcategoryId = null)
      await tx.menuItem.updateMany({
        where: { categoryId: id },
        data: { categoryId: null, subcategoryId: null },
      });

      // 2. Delete child subcategories
      await tx.menuSubcategory.deleteMany({
        where: { categoryId: id },
      });

      // 3. Delete the category
      await tx.menuCategory.delete({
        where: { id },
      });
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({ action: 'category_deleted', details: { categoryId: id } });
    return {
      success: true,
      message: `Category "${category.name}" deleted successfully. Assigned products were preserved under All Dishes.`,
    };
  }

  /**
   * Create Menu Subcategory
   */
  async createSubcategory(data: { categoryId: string; name: string; sortOrder?: number }) {
    const slug = generateSlug(data.name);
    const subcategory = await prisma.menuSubcategory.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        slug,
        sortOrder: data.sortOrder ?? 1,
      },
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({ action: 'subcategory_created', details: subcategory });
    return subcategory;
  }

  /**
   * Update Menu Subcategory
   */
  async updateSubcategory(
    id: string,
    data: {
      name?: string;
      sortOrder?: number;
      categoryId?: string;
    }
  ) {
    const existing = await prisma.menuSubcategory.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Subcategory with ID ${id} not found`);
    }

    const subcategory = await prisma.menuSubcategory.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim(), slug: generateSlug(data.name.trim()) }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.categoryId && { categoryId: data.categoryId }),
      },
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({ action: 'subcategory_updated', details: subcategory });
    return subcategory;
  }

  /**
   * Delete Menu Subcategory safely without deleting products
   */
  async deleteSubcategory(id: string) {
    const existing = await prisma.menuSubcategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`Subcategory with ID ${id} not found`);
    }

    // Atomic transaction: Unlink assigned products (subcategoryId = null) and delete subcategory
    await prisma.$transaction(async (tx) => {
      // 1. Unlink assigned products (retains parent categoryId)
      await tx.menuItem.updateMany({
        where: { subcategoryId: id },
        data: { subcategoryId: null },
      });

      // 2. Delete the subcategory
      await tx.menuSubcategory.delete({
        where: { id },
      });
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({ action: 'subcategory_deleted', details: { subcategoryId: id } });
    return {
      success: true,
      message: `Subcategory "${existing.name}" deleted successfully. Assigned products remain in their category under All Dishes.`,
    };
  }

  /**
   * Create new Menu Item
   */
  async createMenuItem(
    data: {
      name: string;
      description?: string;
      categoryId: string;
      subcategoryId?: string | null;
      gstTaxTagId?: string | null;
      foodType?: FoodType;
      station?: Station;
      image?: string | null;
      basePrice: number;
      discountMode?: string;
      discountValue?: number;
      isAvailable?: boolean;
      isFeatured?: boolean;
      isPopular?: boolean;
      tags?: string[];
      allergens?: string[];
      preparationTime?: number;
      sortOrder?: number;
      variants?: Array<{ name: string; priceDelta: number; sortOrder?: number }>;
      stockQuantity?: number;
      modifierGroups?: Array<{
        name: string;
        isRequired?: boolean;
        isMulti?: boolean;
        options: Array<{ name: string; priceDelta: number; sortOrder?: number }>;
      }>;
    },
    userRole: string
  ) {
    if (userRole !== 'admin') {
      throw new Error('Only administrators can create menu items and set pricing');
    }

    const category = await prisma.menuCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new Error(`Menu category with ID ${data.categoryId} not found`);
    }

    if (data.subcategoryId) {
      const subcategory = await prisma.menuSubcategory.findUnique({
        where: { id: data.subcategoryId },
      });
      if (!subcategory || subcategory.categoryId !== data.categoryId) {
        throw new Error('Selected subcategory does not belong to the selected category');
      }
    }

    const pricing = this.computeFinalPrice(data.basePrice, data.discountMode, data.discountValue);

    let finalGstTaxTagId = data.gstTaxTagId || null;
    if (finalGstTaxTagId) {
      const tag = await prisma.gstTaxTag.findUnique({ where: { id: finalGstTaxTagId } });
      if (!tag) {
        throw new Error('Specified GST Tax Tag does not exist');
      }
    } else {
      const defaultTag = await prisma.gstTaxTag.findFirst({
        where: { name: '5% GST' },
      });
      finalGstTaxTagId = defaultTag ? defaultTag.id : null;
    }

    const initialStock = data.stockQuantity !== undefined ? Math.max(0, Math.floor(Number(data.stockQuantity))) : 50;

    const createdItem = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || '',
          sectionId: category.sectionId,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId || null,
          gstTaxTagId: finalGstTaxTagId,
          foodType: data.foodType || null,
          station: data.station || Station.KITCHEN,
          image: data.image || null,
          basePrice: pricing.basePrice,
          discountMode: pricing.discountMode,
          discountValue: pricing.discountValue,
          finalPrice: pricing.finalPrice,
          isAvailable: data.isAvailable ?? (initialStock > 0),
          isFeatured: data.isFeatured ?? false,
          isPopular: data.isPopular ?? false,
          tags: data.tags || [],
          allergens: data.allergens || [],
          preparationTime: data.preparationTime ?? 10,
          sortOrder: data.sortOrder ?? 0,
          variants:
            data.variants && data.variants.length > 0
              ? {
                  create: data.variants.map((v, idx) => ({
                    name: v.name.trim(),
                    priceDelta: new Decimal(v.priceDelta || 0),
                    sortOrder: v.sortOrder ?? idx,
                  })),
                }
              : undefined,
          modifierGroups:
            data.modifierGroups && data.modifierGroups.length > 0
              ? {
                  create: data.modifierGroups.map((g) => ({
                    name: g.name.trim(),
                    isRequired: Boolean(g.isRequired),
                    isMulti: Boolean(g.isMulti),
                    options: {
                      create: (g.options || []).map((o, optIdx) => ({
                        name: o.name.trim(),
                        priceDelta: new Decimal(o.priceDelta || 0),
                        sortOrder: o.sortOrder ?? optIdx,
                      })),
                    },
                  })),
                }
              : undefined,
        },
        include: {
          variants: true,
          modifierGroups: {
            include: {
              options: true,
            },
          },
          category: true,
          subcategory: true,
          gstTaxTag: true,
        },
      });

      await tx.stockItem.create({
        data: {
          menuItemId: item.id,
          currentStock: initialStock,
          lowStockThreshold: 5,
          isActive: true,
        },
      });

      return item;
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({ action: 'item_created', itemId: createdItem.id });
    return createdItem;
  }

  /**
   * Update existing Menu Item with in-place synchronization of variants and modifiers
   */
  async updateMenuItem(
    id: string,
    data: {
      name?: string;
      description?: string;
      categoryId?: string;
      subcategoryId?: string | null;
      gstTaxTagId?: string | null;
      foodType?: FoodType;
      station?: Station;
      image?: string | null;
      basePrice?: number;
      discountMode?: string;
      discountValue?: number;
      isAvailable?: boolean;
      isFeatured?: boolean;
      isPopular?: boolean;
      tags?: string[];
      allergens?: string[];
      preparationTime?: number;
      sortOrder?: number;
      variants?: Array<{ id?: string; name: string; priceDelta: number; sortOrder?: number }>;
      stockQuantity?: number;
      modifierGroups?: Array<{
        id?: string;
        name: string;
        isRequired?: boolean;
        isMulti?: boolean;
        options: Array<{ id?: string; name: string; priceDelta: number; sortOrder?: number }>;
      }>;
    },
    userRole: string
  ) {
    const existing = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        variants: true,
        modifierGroups: {
          include: {
            options: true,
          },
        },
        stockItem: true,
      },
    });

    if (!existing || existing.isArchived) {
      throw new Error(`MenuItem with ID ${id} not found or has been archived`);
    }

    // RBAC: Verify if manager attempted to change price fields
    const isPriceChangeAttempted =
      (data.basePrice !== undefined && Number(data.basePrice) !== Number(existing.basePrice)) ||
      (data.discountMode !== undefined && data.discountMode !== existing.discountMode) ||
      (data.discountValue !== undefined && Number(data.discountValue) !== Number(existing.discountValue));

    if (isPriceChangeAttempted && userRole !== 'admin') {
      throw new Error('Forbidden: Only administrators can modify base price or discount settings');
    }

    let sectionId = existing.sectionId;
    if (data.categoryId && data.categoryId !== existing.categoryId) {
      const category = await prisma.menuCategory.findUnique({ where: { id: data.categoryId } });
      if (!category) {
        throw new Error(`Category ${data.categoryId} not found`);
      }
      sectionId = category.sectionId;
    }

    const targetCategoryId =
      data.categoryId !== undefined ? (data.categoryId || null) : existing.categoryId;

    if (data.subcategoryId) {
      if (!targetCategoryId) {
        throw new Error('A category must be assigned before assigning a subcategory');
      }
      const subcategory = await prisma.menuSubcategory.findUnique({ where: { id: data.subcategoryId } });
      if (!subcategory || subcategory.categoryId !== targetCategoryId) {
        throw new Error('Selected subcategory does not belong to the category');
      }
    } else if (data.categoryId === null || data.categoryId === '') {
      data.subcategoryId = null;
    }

    // Pricing update (only if admin modified it or base price exists)
    let pricing: {
      basePrice: Decimal;
      discountMode: string;
      discountValue: Decimal;
      finalPrice: Decimal;
    } | null = null;

    if (
      userRole === 'admin' &&
      (data.basePrice !== undefined || data.discountMode !== undefined || data.discountValue !== undefined)
    ) {
      const newBasePrice = data.basePrice !== undefined ? data.basePrice : Number(existing.basePrice);
      const newDiscountMode = data.discountMode !== undefined ? data.discountMode : existing.discountMode;
      const newDiscountValue = data.discountValue !== undefined ? data.discountValue : Number(existing.discountValue);
      pricing = this.computeFinalPrice(newBasePrice, newDiscountMode, newDiscountValue);
    }

    let transitionedItems: any[] = [];
    const isTransitioningToStockOut =
      data.isAvailable === false && existing.isAvailable === true;

    const updatedItem = await prisma.$transaction(async (tx) => {
      // 1. Update Core Item Fields
      await tx.menuItem.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name.trim() }),
          ...(data.description !== undefined && { description: data.description?.trim() || '' }),
          ...(data.categoryId !== undefined && { categoryId: targetCategoryId }),
          ...(data.subcategoryId !== undefined && { subcategoryId: data.subcategoryId }),
          ...(data.gstTaxTagId !== undefined && { gstTaxTagId: data.gstTaxTagId }),
          ...(data.foodType !== undefined && { foodType: data.foodType }),
          ...(data.station !== undefined && { station: data.station }),
          ...(data.image !== undefined && { image: data.image }),
          ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
          ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
          ...(data.isPopular !== undefined && { isPopular: data.isPopular }),
          ...(data.tags !== undefined && { tags: data.tags }),
          ...(data.allergens !== undefined && { allergens: data.allergens }),
          ...(data.preparationTime !== undefined && { preparationTime: data.preparationTime }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          sectionId,
          ...(pricing && {
            basePrice: pricing.basePrice,
            discountMode: pricing.discountMode,
            discountValue: pricing.discountValue,
            finalPrice: pricing.finalPrice,
          }),
        },
      });

      // Update StockItem if stockQuantity provided
      if (data.stockQuantity !== undefined) {
        const newStock = Math.max(0, Math.floor(Number(data.stockQuantity)));
        const stockItem = await tx.stockItem.findUnique({ where: { menuItemId: id } });
        if (stockItem) {
          const prevStock = stockItem.currentStock;
          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: { currentStock: newStock },
          });
          if (newStock !== prevStock) {
            await tx.inventoryLog.create({
              data: {
                stockItemId: stockItem.id,
                quantityDelta: newStock - prevStock,
                previousStock: prevStock,
                newStock,
                reason: 'MANUAL_ADJUSTMENT',
              },
            });
          }
        } else {
          await tx.stockItem.create({
            data: {
              menuItemId: id,
              currentStock: newStock,
              lowStockThreshold: 5,
              isActive: true,
            },
          });
        }
      }

      // If transitioning to Stock Out, mark unaccepted (PLACED) OrderItems as STOCK_OUT
      if (isTransitioningToStockOut) {
        const pendingPlacedItems = await tx.orderItem.findMany({
          where: {
            menuItemId: id,
            status: OrderStatus.PLACED,
          },
          include: {
            order: {
              include: {
                token: true,
                table: true,
              },
            },
          },
        });

        if (pendingPlacedItems.length > 0) {
          const itemIdsToUpdate = pendingPlacedItems.map((pi) => pi.id);
          await tx.orderItem.updateMany({
            where: { id: { in: itemIdsToUpdate } },
            data: { status: OrderStatus.STOCK_OUT },
          });

          const affectedOrderIds = Array.from(new Set(pendingPlacedItems.map((pi) => pi.orderId)));

          for (const ordId of affectedOrderIds) {
            const allItems = await tx.orderItem.findMany({
              where: { orderId: ordId },
            });

            const activeItems = allItems.filter(
              (i) => i.status !== OrderStatus.CANCELLED && i.status !== OrderStatus.STOCK_OUT
            );

            const newSubtotal = activeItems.reduce(
              (sum, i) => sum.plus(new Decimal(i.lineTotal)),
              new Decimal(0)
            );

            let newOrderStatus = OrderStatus.PLACED;
            if (allItems.length > 0 && activeItems.length === 0) {
              newOrderStatus = OrderStatus.CANCELLED;
            } else if (activeItems.every((i) => i.status === OrderStatus.SERVED)) {
              newOrderStatus = OrderStatus.SERVED;
            } else if (activeItems.every((i) => i.status === OrderStatus.READY || i.status === OrderStatus.SERVED)) {
              newOrderStatus = OrderStatus.READY;
            } else if (
              activeItems.some(
                (i) =>
                  i.status === OrderStatus.PREPARING ||
                  i.status === OrderStatus.READY ||
                  i.status === OrderStatus.SERVED
              )
            ) {
              newOrderStatus = OrderStatus.PREPARING;
            } else if (activeItems.some((i) => i.status === OrderStatus.ACCEPTED)) {
              newOrderStatus = OrderStatus.ACCEPTED;
            } else {
              newOrderStatus = OrderStatus.PLACED;
            }

            await tx.order.update({
              where: { id: ordId },
              data: {
                subtotal: newSubtotal,
                status: newOrderStatus,
              },
            });
          }

          transitionedItems = pendingPlacedItems;
        }
      }

      // 2. In-place Variants Sync (Preserve existing IDs)
      if (data.variants !== undefined) {
        const payloadVariantIds = data.variants.filter((v) => v.id).map((v) => v.id as string);
        const toDeleteVariantIds = existing.variants
          .filter((v) => !payloadVariantIds.includes(v.id))
          .map((v) => v.id);

        if (toDeleteVariantIds.length > 0) {
          await tx.itemVariant.deleteMany({
            where: { id: { in: toDeleteVariantIds } },
          });
        }

        for (let idx = 0; idx < data.variants.length; idx++) {
          const v = data.variants[idx];
          if (v.id && existing.variants.some((ev) => ev.id === v.id)) {
            await tx.itemVariant.update({
              where: { id: v.id },
              data: {
                name: v.name.trim(),
                priceDelta: new Decimal(v.priceDelta || 0),
                sortOrder: v.sortOrder ?? idx,
              },
            });
          } else {
            await tx.itemVariant.create({
              data: {
                menuItemId: id,
                name: v.name.trim(),
                priceDelta: new Decimal(v.priceDelta || 0),
                sortOrder: v.sortOrder ?? idx,
              },
            });
          }
        }
      }

      // 3. In-place Modifier Groups & Options Sync
      if (data.modifierGroups !== undefined) {
        const payloadGroupIds = data.modifierGroups.filter((g) => g.id).map((g) => g.id as string);
        const toDeleteGroupIds = existing.modifierGroups
          .filter((g) => !payloadGroupIds.includes(g.id))
          .map((g) => g.id);

        if (toDeleteGroupIds.length > 0) {
          await tx.modifierGroup.deleteMany({
            where: { id: { in: toDeleteGroupIds } },
          });
        }

        for (const groupInput of data.modifierGroups) {
          let groupId = groupInput.id;
          const isExistingGroup = groupId && existing.modifierGroups.some((eg) => eg.id === groupId);

          if (isExistingGroup && groupId) {
            await tx.modifierGroup.update({
              where: { id: groupId },
              data: {
                name: groupInput.name.trim(),
                isRequired: Boolean(groupInput.isRequired),
                isMulti: Boolean(groupInput.isMulti),
              },
            });
          } else {
            const createdGroup = await tx.modifierGroup.create({
              data: {
                menuItemId: id,
                name: groupInput.name.trim(),
                isRequired: Boolean(groupInput.isRequired),
                isMulti: Boolean(groupInput.isMulti),
              },
            });
            groupId = createdGroup.id;
          }

          // Options sync for this group
          const existingOptions = groupId
            ? await tx.modifierOption.findMany({ where: { groupId } })
            : [];
          const payloadOptionIds = (groupInput.options || [])
            .filter((o) => o.id)
            .map((o) => o.id as string);

          const toDeleteOptionIds = existingOptions
            .filter((eo) => !payloadOptionIds.includes(eo.id))
            .map((eo) => eo.id);

          if (toDeleteOptionIds.length > 0) {
            await tx.modifierOption.deleteMany({
              where: { id: { in: toDeleteOptionIds } },
            });
          }

          for (let optIdx = 0; optIdx < (groupInput.options || []).length; optIdx++) {
            const opt = groupInput.options[optIdx];
            if (opt.id && existingOptions.some((eo) => eo.id === opt.id)) {
              await tx.modifierOption.update({
                where: { id: opt.id },
                data: {
                  name: opt.name.trim(),
                  priceDelta: new Decimal(opt.priceDelta || 0),
                  sortOrder: opt.sortOrder ?? optIdx,
                },
              });
            } else {
              await tx.modifierOption.create({
                data: {
                  groupId: groupId!,
                  name: opt.name.trim(),
                  priceDelta: new Decimal(opt.priceDelta || 0),
                  sortOrder: opt.sortOrder ?? optIdx,
                },
              });
            }
          }
        }
      }

      return tx.menuItem.findUnique({
        where: { id },
        include: {
          variants: { orderBy: { sortOrder: 'asc' } },
          modifierGroups: {
            include: {
              options: { orderBy: { sortOrder: 'asc' } },
            },
          },
          category: true,
          subcategory: true,
          gstTaxTag: true,
          stockItem: true,
        },
      });
    });

    // Broadcast real-time order item updates for each transitioned item
    if (transitionedItems.length > 0) {
      const nowIso = new Date().toISOString();
      for (const transitioned of transitionedItems) {
        try {
          broadcastOrderItemUpdated({
            orderId: transitioned.orderId,
            orderItemId: transitioned.id,
            orderNumber: transitioned.order?.orderNumber || 0,
            tokenNumber: transitioned.order?.token?.tokenNumber || '',
            tableId: transitioned.order?.tableId || '',
            tableNumber: transitioned.order?.table?.tableNumber,
            station: transitioned.station,
            itemName: transitioned.itemName,
            variantName: transitioned.variantName,
            selectedModifiers: transitioned.selectedModifiers,
            specialInstructions: transitioned.specialInstructions,
            quantity: transitioned.quantity,
            previousStatus: OrderStatus.PLACED,
            status: OrderStatus.STOCK_OUT,
            preparedAt: null,
            readyAt: null,
            servedAt: null,
            updatedAt: nowIso,
          });
        } catch (bErr) {
          logger.warn('[MenuService] Failed to broadcast stock-out order item update:', bErr);
        }
      }
    }

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({ action: 'item_updated', itemId: id });

    if (data.isAvailable !== undefined && data.isAvailable !== existing.isAvailable) {
      const currentStock = updatedItem?.stockItem?.currentStock ?? 50;
      const reserved = await inventoryService.getReservedQuantity(id);
      const availableStock = Math.max(0, currentStock - reserved);

      this.notifyMenuUpdated({
        action: 'item_availability',
        itemId: id,
        details: {
          isAvailable: data.isAvailable && availableStock > 0,
          currentStock,
          availableStock,
          station: updatedItem?.station || existing.station,
          name: updatedItem?.name || existing.name,
          affectedItemsCount: transitionedItems.length,
        },
      });
    }

    return updatedItem;
  }

  /**
   * Delete Menu Item (Hard delete if 0 order references, Soft-archive if orders exist)
   */
  async deleteMenuItem(id: string) {
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) {
      throw new Error(`MenuItem with ID ${id} not found`);
    }

    const orderCount = await prisma.orderItem.count({ where: { menuItemId: id } });

    if (orderCount > 0) {
      let transitionedItems: any[] = [];
      // Soft Archive to protect foreign keys and historical orders
      await prisma.$transaction(async (tx) => {
        await tx.menuItem.update({
          where: { id },
          data: {
            isArchived: true,
            isAvailable: false,
          },
        });

        // Any remaining unaccepted PLACED items become STOCK_OUT
        const pendingPlacedItems = await tx.orderItem.findMany({
          where: {
            menuItemId: id,
            status: OrderStatus.PLACED,
          },
          include: {
            order: {
              include: {
                token: true,
                table: true,
              },
            },
          },
        });

        if (pendingPlacedItems.length > 0) {
          const itemIdsToUpdate = pendingPlacedItems.map((pi) => pi.id);
          await tx.orderItem.updateMany({
            where: { id: { in: itemIdsToUpdate } },
            data: { status: OrderStatus.STOCK_OUT },
          });

          const affectedOrderIds = Array.from(new Set(pendingPlacedItems.map((pi) => pi.orderId)));
          for (const ordId of affectedOrderIds) {
            const allItems = await tx.orderItem.findMany({
              where: { orderId: ordId },
            });

            const activeItems = allItems.filter(
              (i) => i.status !== OrderStatus.CANCELLED && i.status !== OrderStatus.STOCK_OUT
            );

            const newSubtotal = activeItems.reduce(
              (sum, i) => sum.plus(new Decimal(i.lineTotal)),
              new Decimal(0)
            );

            let newOrderStatus = OrderStatus.PLACED;
            if (allItems.length > 0 && activeItems.length === 0) {
              newOrderStatus = OrderStatus.CANCELLED;
            } else if (activeItems.every((i) => i.status === OrderStatus.SERVED)) {
              newOrderStatus = OrderStatus.SERVED;
            } else if (activeItems.every((i) => i.status === OrderStatus.READY || i.status === OrderStatus.SERVED)) {
              newOrderStatus = OrderStatus.READY;
            } else if (
              activeItems.some(
                (i) =>
                  i.status === OrderStatus.PREPARING ||
                  i.status === OrderStatus.READY ||
                  i.status === OrderStatus.SERVED
              )
            ) {
              newOrderStatus = OrderStatus.PREPARING;
            } else if (activeItems.some((i) => i.status === OrderStatus.ACCEPTED)) {
              newOrderStatus = OrderStatus.ACCEPTED;
            } else {
              newOrderStatus = OrderStatus.PLACED;
            }

            await tx.order.update({
              where: { id: ordId },
              data: {
                subtotal: newSubtotal,
                status: newOrderStatus,
              },
            });
          }

          transitionedItems = pendingPlacedItems;
        }
      });

      if (transitionedItems.length > 0) {
        const nowIso = new Date().toISOString();
        for (const transitioned of transitionedItems) {
          try {
            broadcastOrderItemUpdated({
              orderId: transitioned.orderId,
              orderItemId: transitioned.id,
              orderNumber: transitioned.order?.orderNumber || 0,
              tokenNumber: transitioned.order?.token?.tokenNumber || '',
              tableId: transitioned.order?.tableId || '',
              tableNumber: transitioned.order?.table?.tableNumber,
              station: transitioned.station,
              itemName: transitioned.itemName,
              variantName: transitioned.variantName,
              selectedModifiers: transitioned.selectedModifiers,
              specialInstructions: transitioned.specialInstructions,
              quantity: transitioned.quantity,
              previousStatus: OrderStatus.PLACED,
              status: OrderStatus.STOCK_OUT,
              preparedAt: null,
              readyAt: null,
              servedAt: null,
              updatedAt: nowIso,
            });
          } catch (bErr) {
            logger.warn('[MenuService] Failed to broadcast stock-out on archive:', bErr);
          }
        }
      }

      await this.invalidateMenuCache();
      this.notifyMenuUpdated({ action: 'item_archived', itemId: id });
      this.notifyMenuUpdated({
        action: 'item_availability',
        itemId: id,
        details: { isAvailable: false, station: item.station, name: item.name },
      });
      return {
        softDeleted: true,
        message: `Item has been archived (${orderCount} historical orders preserved).`,
      };
    }

    // Hard Delete allowed when zero order references exist
    await prisma.menuItem.delete({
      where: { id },
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({ action: 'item_deleted', itemId: id });
    return {
      softDeleted: false,
      message: 'Item permanently deleted from catalog.',
    };
  }

  /**
   * Operational 86 availability toggle with authoritative item-level Stock Out handling and preserved numeric stock
   */
  async setItemAvailability(itemId: string, isAvailable: boolean, stockQuantity?: number) {
    const item = await prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { stockItem: true },
    });

    if (!item || item.isArchived) {
      throw new Error(`MenuItem with ID ${itemId} not found`);
    }

    let transitionedItems: any[] = [];
    const preservedStock = item.stockItem?.currentStock ?? 50;

    if (!isAvailable) {
      // MANUAL STOCK OUT ACTION:
      // 1. Mark menu item unavailable (isAvailable = false)
      // 2. Underlying numeric stock is PRESERVED (never destroyed/set to 0)
      // 3. Transition ONLY unaccepted (PLACED) OrderItems for this menuItem to STOCK_OUT
      // 4. Leave ACCEPTED, PREPARING, READY, SERVED items completely untouched
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.menuItem.update({
          where: { id: itemId },
          data: { isAvailable: false },
        });

        // Find strictly unaccepted PLACED items
        const pendingPlacedItems = await tx.orderItem.findMany({
          where: {
            menuItemId: itemId,
            status: OrderStatus.PLACED,
          },
          include: {
            order: {
              include: {
                token: true,
                table: true,
              },
            },
          },
        });

        if (pendingPlacedItems.length > 0) {
          const itemIdsToUpdate = pendingPlacedItems.map((pi) => pi.id);
          await tx.orderItem.updateMany({
            where: { id: { in: itemIdsToUpdate } },
            data: { status: OrderStatus.STOCK_OUT },
          });

          // Unique affected order IDs
          const affectedOrderIds = Array.from(new Set(pendingPlacedItems.map((pi) => pi.orderId)));

          // Recalculate parent order subtotal and status for each affected order
          for (const ordId of affectedOrderIds) {
            const allItems = await tx.orderItem.findMany({
              where: { orderId: ordId },
            });

            const activeItems = allItems.filter(
              (i) => i.status !== OrderStatus.CANCELLED && i.status !== OrderStatus.STOCK_OUT
            );

            const newSubtotal = activeItems.reduce(
              (sum, i) => sum.plus(new Decimal(i.lineTotal)),
              new Decimal(0)
            );

            let newOrderStatus = OrderStatus.PLACED;
            if (allItems.length > 0 && activeItems.length === 0) {
              newOrderStatus = OrderStatus.CANCELLED;
            } else if (activeItems.every((i) => i.status === OrderStatus.SERVED)) {
              newOrderStatus = OrderStatus.SERVED;
            } else if (activeItems.every((i) => i.status === OrderStatus.READY || i.status === OrderStatus.SERVED)) {
              newOrderStatus = OrderStatus.READY;
            } else if (
              activeItems.some(
                (i) =>
                  i.status === OrderStatus.PREPARING ||
                  i.status === OrderStatus.READY ||
                  i.status === OrderStatus.SERVED
              )
            ) {
              newOrderStatus = OrderStatus.PREPARING;
            } else if (activeItems.some((i) => i.status === OrderStatus.ACCEPTED)) {
              newOrderStatus = OrderStatus.ACCEPTED;
            } else {
              newOrderStatus = OrderStatus.PLACED;
            }

            await tx.order.update({
              where: { id: ordId },
              data: {
                subtotal: newSubtotal,
                status: newOrderStatus,
              },
            });
          }
        }

        return { updated, pendingPlacedItems };
      });

      transitionedItems = result.pendingPlacedItems;

      // Broadcast real-time order item updates for each transitioned item
      const nowIso = new Date().toISOString();
      for (const transitioned of transitionedItems) {
        try {
          broadcastOrderItemUpdated({
            orderId: transitioned.orderId,
            orderItemId: transitioned.id,
            orderNumber: transitioned.order?.orderNumber || 0,
            tokenNumber: transitioned.order?.token?.tokenNumber || '',
            tableId: transitioned.order?.tableId || '',
            tableNumber: transitioned.order?.table?.tableNumber,
            station: transitioned.station,
            itemName: transitioned.itemName,
            variantName: transitioned.variantName,
            selectedModifiers: transitioned.selectedModifiers,
            specialInstructions: transitioned.specialInstructions,
            quantity: transitioned.quantity,
            previousStatus: OrderStatus.PLACED,
            status: OrderStatus.STOCK_OUT,
            preparedAt: null,
            readyAt: null,
            servedAt: null,
            updatedAt: nowIso,
          });
        } catch (bErr) {
          logger.warn('[MenuService] Failed to broadcast stock-out order item update:', bErr);
        }
      }

      await this.invalidateMenuCache();
      this.notifyMenuUpdated({
        action: 'item_availability',
        itemId,
        details: {
          isAvailable: false,
          currentStock: preservedStock,
          availableStock: 0,
          station: item.station,
          name: item.name,
          affectedItemsCount: transitionedItems.length,
        },
      });

      return {
        ...result.updated,
        currentStock: preservedStock,
        availableStock: 0,
      };
    } else {
      // MANUAL STOCK IN ACTION:
      // If stockQuantity is specified (e.g. user confirmed 3 or updated to 5):
      const newStock = stockQuantity !== undefined ? Math.max(0, Math.floor(Number(stockQuantity))) : (preservedStock > 0 ? preservedStock : 50);
      const shouldBeAvailable = newStock > 0;

      await prisma.$transaction(async (tx) => {
        await tx.menuItem.update({
          where: { id: itemId },
          data: { isAvailable: shouldBeAvailable },
        });

        if (item.stockItem) {
          const prevStock = item.stockItem.currentStock;
          await tx.stockItem.update({
            where: { id: item.stockItem.id },
            data: { currentStock: newStock },
          });
          if (newStock !== prevStock) {
            await tx.inventoryLog.create({
              data: {
                stockItemId: item.stockItem.id,
                quantityDelta: newStock - prevStock,
                previousStock: prevStock,
                newStock,
                reason: 'STOCK_IN_ADJUSTMENT',
              },
            });
          }
        } else {
          await tx.stockItem.create({
            data: {
              menuItemId: itemId,
              currentStock: newStock,
              lowStockThreshold: 5,
              isActive: true,
            },
          });
        }
      });

      const reserved = await inventoryService.getReservedQuantity(itemId);
      const availableStock = Math.max(0, newStock - reserved);

      await this.invalidateMenuCache();
      this.notifyMenuUpdated({
        action: 'item_availability',
        itemId,
        details: {
          isAvailable: shouldBeAvailable && availableStock > 0,
          currentStock: newStock,
          availableStock,
          station: item.station,
          name: item.name,
        },
      });

      return {
        id: itemId,
        isAvailable: shouldBeAvailable && availableStock > 0,
        currentStock: newStock,
        availableStock,
      };
    }
  }

  /**
   * Active promotions
   */
  async getActivePromotions() {
    return prisma.promotion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Venue Configuration (Billing, GST%, Service Charge%, Rounding)
   */
  async getVenueConfig() {
    let config = await prisma.venueConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await prisma.venueConfig.create({
        data: {
          id: 'default',
          gstEnabled: true,
          gstRate: 0.05,
          scEnabled: true,
          scRate: 0.05,
          roundingEnabled: true,
        },
      });
    }
    return config;
  }

  /**
   * Update Venue Configuration (Admin only)
   */
  async updateVenueConfig(
    data: {
      gstEnabled?: boolean;
      gstRate?: number;
      scEnabled?: boolean;
      scRate?: number;
      roundingEnabled?: boolean;
    },
    updatedBy?: string
  ) {
    const config = await prisma.venueConfig.upsert({
      where: { id: 'default' },
      update: {
        ...(data.gstEnabled !== undefined && { gstEnabled: data.gstEnabled }),
        ...(data.gstRate !== undefined && { gstRate: new Decimal(data.gstRate) }),
        ...(data.scEnabled !== undefined && { scEnabled: data.scEnabled }),
        ...(data.scRate !== undefined && { scRate: new Decimal(data.scRate) }),
        ...(data.roundingEnabled !== undefined && { roundingEnabled: data.roundingEnabled }),
        updatedBy: updatedBy || null,
      },
      create: {
        id: 'default',
        gstEnabled: data.gstEnabled ?? true,
        gstRate: new Decimal(data.gstRate ?? 0.05),
        scEnabled: data.scEnabled ?? true,
        scRate: new Decimal(data.scRate ?? 0.05),
        roundingEnabled: data.roundingEnabled ?? true,
        updatedBy: updatedBy || null,
      },
    });

    return config;
  }

  /**
   * Get all active GST Tax Tags
   */
  async getGstTaxTags() {
    return await prisma.gstTaxTag.findMany({
      orderBy: { rate: 'desc' },
      include: {
        _count: {
          select: { items: { where: { isArchived: false } } },
        },
      },
    });
  }

  /**
   * Helper: Normalize GST percentage to canonical Decimal(5, 4)
   * e.g. "3%", "3", "3.0", "3.00", 3, 0.03, "0.0300" all resolve to Decimal('0.0300')
   */
  normalizeGstRate(rawRate: any): Decimal {
    if (rawRate === undefined || rawRate === null) {
      throw new Error('GST rate is required');
    }

    let str = String(rawRate).trim();
    if (!str) {
      throw new Error('GST rate is required');
    }

    if (str.endsWith('%')) {
      str = str.slice(0, -1).trim();
      const num = parseFloat(str);
      if (isNaN(num) || num < 0 || num > 100) {
        throw new Error('GST percentage must be between 0 and 100');
      }
      return new Decimal((num / 100).toFixed(4));
    }

    const num = parseFloat(str);
    if (isNaN(num) || num < 0) {
      throw new Error('Invalid GST percentage or rate');
    }

    let canonicalStr: string;
    if (num > 1) {
      if (num > 100) {
        throw new Error('GST percentage must be between 0 and 100');
      }
      canonicalStr = (num / 100).toFixed(4);
    } else if (num === 0) {
      canonicalStr = '0.0000';
    } else if (num === 1) {
      canonicalStr = '0.0100';
    } else {
      canonicalStr = num.toFixed(4);
    }

    return new Decimal(canonicalStr);
  }

  /**
   * Create a new GST Tax Tag (Admin only)
   * Enforces global GST percentage uniqueness across all tags
   */
  async createGstTaxTag(data: { name: string; rate: any }) {
    const trimmedName = data.name ? data.name.trim() : '';
    if (!trimmedName) {
      throw new Error('GST Tax Tag name is required');
    }

    const canonicalRate = this.normalizeGstRate(data.rate);

    // 1. Check percentage uniqueness (Mandatory requirement)
    const existingRate = await prisma.gstTaxTag.findFirst({
      where: { rate: canonicalRate },
    });
    if (existingRate) {
      throw new Error('This GST percentage already exists.');
    }

    // 2. Check tag name uniqueness
    const existingName = await prisma.gstTaxTag.findUnique({
      where: { name: trimmedName },
    });
    if (existingName) {
      throw new Error(`A GST Tax Tag named "${trimmedName}" already exists`);
    }

    try {
      const tag = await prisma.gstTaxTag.create({
        data: {
          name: trimmedName,
          rate: canonicalRate,
          isActive: true,
        },
      });

      await this.invalidateMenuCache();
      this.notifyMenuUpdated({ action: 'gst_tag_created', details: tag });
      return tag;
    } catch (err: any) {
      if (err.code === 'P2002' && (err.meta?.target?.includes('rate') || String(err).includes('rate'))) {
        throw new Error('This GST percentage already exists.');
      }
      throw err;
    }
  }

  /**
   * Update GST Tax Tag (Admin only)
   */
  async updateGstTaxTag(id: string, data: { name?: string; rate?: any; isActive?: boolean }) {
    const tag = await prisma.gstTaxTag.findUnique({ where: { id } });
    if (!tag) throw new Error('GST Tax Tag not found');

    let canonicalRate: Decimal | undefined;
    if (data.rate !== undefined) {
      canonicalRate = this.normalizeGstRate(data.rate);
      const existingRate = await prisma.gstTaxTag.findFirst({
        where: {
          rate: canonicalRate,
          id: { not: id },
        },
      });
      if (existingRate) {
        throw new Error('This GST percentage already exists.');
      }
    }

    if (data.name && data.name.trim() !== tag.name) {
      const existingName = await prisma.gstTaxTag.findUnique({
        where: { name: data.name.trim() },
      });
      if (existingName && existingName.id !== id) {
        throw new Error(`A GST Tax Tag named "${data.name.trim()}" already exists`);
      }
    }

    if (data.isActive === false) {
      const assignedItemsCount = await prisma.menuItem.count({
        where: { gstTaxTagId: id, isArchived: false },
      });
      if (assignedItemsCount > 0) {
        throw new Error(
          `Cannot deactivate GST Tax Tag "${tag.name}" because ${assignedItemsCount} item(s) are currently assigned to it. Please reassign those items first.`
        );
      }
    }

    try {
      const updated = await prisma.gstTaxTag.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name.trim() }),
          ...(canonicalRate !== undefined && { rate: canonicalRate }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      await this.invalidateMenuCache();
      this.notifyMenuUpdated({ action: 'gst_tag_updated', details: updated });
      return updated;
    } catch (err: any) {
      if (err.code === 'P2002' && (err.meta?.target?.includes('rate') || String(err).includes('rate'))) {
        throw new Error('This GST percentage already exists.');
      }
      throw err;
    }
  }

  /**
   * Delete a GST Tax Tag and atomically move all its assigned items to "No GST"
   */
  async deleteGstTaxTag(id: string) {
    const targetTag = await prisma.gstTaxTag.findUnique({ where: { id } });
    if (!targetTag) {
      // Idempotent deletion: if tag was already deleted, safely return fallback No GST
      const fallback = await prisma.gstTaxTag.findFirst({
        where: {
          OR: [
            { rate: new Decimal('0.0000') },
            { name: 'No GST' },
          ],
        },
      });
      return {
        success: true,
        deletedTag: { id, name: 'GST Tag', rate: '0' },
        affectedProductsCount: 0,
        fallbackTag: fallback || { id: '', name: 'No GST' },
        message: 'GST Tax Tag was already removed.',
      };
    }

    // Guard: Prevent deleting mandatory "No GST" fallback tag
    if (Number(targetTag.rate) === 0 || targetTag.name.toLowerCase() === 'no gst') {
      throw new Error("The 'No GST' tax tag is mandatory and cannot be deleted.");
    }

    // Find destination "No GST" tag
    let noGstTag = await prisma.gstTaxTag.findFirst({
      where: {
        OR: [
          { rate: new Decimal('0.0000') },
          { name: 'No GST' },
        ],
      },
    });

    if (!noGstTag) {
      noGstTag = await prisma.gstTaxTag.create({
        data: {
          name: 'No GST',
          rate: new Decimal('0.0000'),
          isActive: true,
        },
      });
    }

    // Atomic transaction: Reassign items then delete tag
    const result = await prisma.$transaction(async (tx) => {
      const assignedItemsCount = await tx.menuItem.count({
        where: { gstTaxTagId: id, isArchived: false },
      });

      if (assignedItemsCount > 0) {
        await tx.menuItem.updateMany({
          where: { gstTaxTagId: id },
          data: { gstTaxTagId: noGstTag!.id },
        });
      }

      await tx.gstTaxTag.delete({
        where: { id },
      });

      return { assignedItemsCount };
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({
      action: 'gst_tag_deleted',
      details: {
        deletedTagId: targetTag.id,
        deletedTagName: targetTag.name,
        affectedProductsCount: result.assignedItemsCount,
        fallbackTagId: noGstTag.id,
        fallbackTagName: noGstTag.name,
      },
    });

    return {
      success: true,
      deletedTag: {
        id: targetTag.id,
        name: targetTag.name,
        rate: targetTag.rate,
      },
      affectedProductsCount: result.assignedItemsCount,
      fallbackTag: {
        id: noGstTag.id,
        name: noGstTag.name,
      },
    };
  }

  /**
   * Get all active products with their current GST assignments for GST Management UI
   */
  async getGstItemAssignments() {
    return await prisma.menuItem.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        name: true,
        basePrice: true,
        finalPrice: true,
        isAvailable: true,
        sectionId: true,
        categoryId: true,
        gstTaxTagId: true,
        gstTaxTag: {
          select: {
            id: true,
            name: true,
            rate: true,
            isActive: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ section: { sortOrder: 'asc' } }, { category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
  }

  /**
   * Bulk assign items to target GST Tax Tag
   */
  async bulkAssignGstTaxTag(targetTagId: string, itemIds: string[]) {
    if (!itemIds || itemIds.length === 0) {
      throw new Error('At least one item must be selected for GST reassignment');
    }

    const targetTag = await prisma.gstTaxTag.findUnique({
      where: { id: targetTagId },
    });
    if (!targetTag) {
      throw new Error('Target GST Tax Tag not found');
    }
    if (!targetTag.isActive) {
      throw new Error(`Target GST Tax Tag "${targetTag.name}" is inactive`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.menuItem.updateMany({
        where: {
          id: { in: itemIds },
          OR: [
            { gstTaxTagId: null },
            { gstTaxTagId: { not: targetTag.id } },
          ],
        },
        data: { gstTaxTagId: targetTag.id },
      });
      return updateResult;
    });

    await this.invalidateMenuCache();
    this.notifyMenuUpdated({
      action: 'gst_bulk_assigned',
      details: { targetTagId, targetTagName: targetTag.name, count: result.count },
    });

    return {
      success: true,
      count: result.count,
      targetTag,
    };
  }
}

export const menuService = new MenuService();
export default menuService;
