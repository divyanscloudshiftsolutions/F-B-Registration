import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChefHat, Search, Loader2, CheckCircle2, AlertCircle, RefreshCw, X, UtensilsCrossed } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { onSocketEvent } from '../../services/socket';
import { formatImageUrl } from '../../utils/imageUrl';

interface FlatKitchenItem {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  finalPrice?: number;
  station: string;
  isAvailable: boolean;
  isArchived: boolean;
  image?: string | null;
  categoryName?: string;
  sectionName?: string;
  foodType?: string | null;
  variants?: Array<{ id: string; name: string; priceDelta: number }>;
}

export const KitchenStockTab: React.FC = () => {
  const { user, showToast } = useAuth();
  const [items, setItems] = useState<FlatKitchenItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  const userRole = (user?.role || '').toLowerCase();
  const canControl = ['chef', 'admin', 'manager'].includes(userRole);

  const fetchKitchenItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const sections = await api.getMenu(true);
      const flatList: FlatKitchenItem[] = [];

      if (Array.isArray(sections)) {
        sections.forEach((section: any) => {
          // Direct section items
          if (Array.isArray(section.items)) {
            section.items.forEach((it: any) => {
              if ((it.station === 'KITCHEN' || it.station === 'DESSERT') && !it.isArchived) {
                flatList.push({
                  ...it,
                  sectionName: section.name,
                  categoryName: 'General Dishes',
                  basePrice: Number(it.basePrice || 0),
                  finalPrice: Number(it.finalPrice ?? it.basePrice ?? 0),
                });
              }
            });
          }

          // Category items
          if (Array.isArray(section.categories)) {
            section.categories.forEach((cat: any) => {
              if (Array.isArray(cat.items)) {
                cat.items.forEach((it: any) => {
                  if ((it.station === 'KITCHEN' || it.station === 'DESSERT') && !it.isArchived) {
                    flatList.push({
                      ...it,
                      sectionName: section.name,
                      categoryName: cat.name,
                      basePrice: Number(it.basePrice || 0),
                      finalPrice: Number(it.finalPrice ?? it.basePrice ?? 0),
                    });
                  }
                });
              }

              // Subcategory items
              if (Array.isArray(cat.subcategories)) {
                cat.subcategories.forEach((sub: any) => {
                  if (Array.isArray(sub.items)) {
                    sub.items.forEach((it: any) => {
                      if ((it.station === 'KITCHEN' || it.station === 'DESSERT') && !it.isArchived) {
                        flatList.push({
                          ...it,
                          sectionName: section.name,
                          categoryName: `${cat.name} · ${sub.name}`,
                          basePrice: Number(it.basePrice || 0),
                          finalPrice: Number(it.finalPrice ?? it.basePrice ?? 0),
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }

      setItems(flatList);
    } catch (err: any) {
      console.warn('Failed to load Kitchen station items:', err);
      if (!silent) {
        showToast(err.message || 'Failed to load kitchen items', 'danger');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchKitchenItems();

    const unsubMenuUpdated = onSocketEvent('menu.updated', (payload: any) => {
      if (payload && payload.action === 'item_availability' && payload.itemId) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === payload.itemId
              ? { ...it, isAvailable: Boolean(payload.details?.isAvailable) }
              : it
          )
        );
      } else {
        fetchKitchenItems(true);
      }
    });

    return () => {
      unsubMenuUpdated();
    };
  }, [fetchKitchenItems]);

  const handleToggleAvailability = async (item: FlatKitchenItem) => {
    if (!canControl || updatingIds.has(item.id)) return;

    const newStatus = !item.isAvailable;
    setUpdatingIds((prev) => new Set(prev).add(item.id));

    // Optimistic update
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, isAvailable: newStatus } : it))
    );

    try {
      const res = await api.setItemAvailability(item.id, newStatus);
      if (res && res.success) {
        showToast(
          `${item.name} marked ${newStatus ? 'Stock In (Available)' : 'Stock Out (Out of Stock)'}`,
          newStatus ? 'success' : 'warning'
        );
      } else {
        throw new Error(res?.error?.message || 'Update failed');
      }
    } catch (err: any) {
      // Revert optimistic update on failure
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, isAvailable: !newStatus } : it))
      );
      showToast(err.message || 'Failed to update item availability', 'danger');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.categoryName) set.add(it.categoryName);
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Category filter
      if (selectedCategory !== 'all' && it.categoryName !== selectedCategory) {
        return false;
      }

      // Status filter
      if (statusFilter === 'available' && !it.isAvailable) return false;
      if (statusFilter === 'unavailable' && it.isAvailable) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = it.name.toLowerCase().includes(q);
        const matchCat = (it.categoryName || '').toLowerCase().includes(q);
        return matchName || matchCat;
      }

      return true;
    });
  }, [items, selectedCategory, statusFilter, searchQuery]);

  const totalCount = items.length;
  const availableCount = items.filter((it) => it.isAvailable).length;
  const outOfStockCount = totalCount - availableCount;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border-main dark:border-white/10 bg-white dark:bg-[#18181A] p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
            <ChefHat size={24} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text-main flex items-center gap-2">
              Kitchen & Dessert Stock Management
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Control physical kitchen item availability in real time for dining guests
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              statusFilter === 'all'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-bg-primary text-text-muted hover:text-text-main border-border-main dark:border-white/10'
            }`}
          >
            All Items ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('available')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
              statusFilter === 'available'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-bg-primary text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-border-main dark:border-white/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            In Stock ({availableCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('unavailable')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
              statusFilter === 'unavailable'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-bg-primary text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-border-main dark:border-white/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Stock Out ({outOfStockCount})
          </button>
          <button
            type="button"
            onClick={() => fetchKitchenItems()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border-main dark:border-white/10 text-text-muted hover:text-text-main bg-bg-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Refresh Kitchen Stock"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search kitchen dishes by name or category..."
            className="w-full pl-10 pr-9 py-2.5 bg-bg-surface border border-border-main dark:border-white/10 rounded-xl text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Pills */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Kitchen Items */}
      {loading ? (
        <div className="py-24 text-center text-text-muted flex flex-col items-center justify-center gap-2">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-xs font-bold">Loading Kitchen Menu Stock...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border-main dark:border-white/10 p-12 text-center text-text-muted space-y-2">
          <UtensilsCrossed size={32} className="mx-auto text-text-muted/40" />
          <h4 className="text-sm font-bold text-text-main">No Kitchen Items Found</h4>
          <p className="text-xs max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all' || statusFilter !== 'all'
              ? 'No dishes match your current filter criteria.'
              : 'No Kitchen or Dessert station items exist in the menu catalog.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isUpdating = updatingIds.has(item.id);
            const isAvailable = item.isAvailable;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all p-4 flex flex-col justify-between gap-3 shadow-2xs ${
                  isAvailable
                    ? 'bg-white dark:bg-[#18181A] border-border-main dark:border-white/10 hover:border-primary/40'
                    : 'bg-zinc-50/80 dark:bg-[#151517] border-rose-500/20 dark:border-rose-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-black/5 dark:bg-white/5 border border-border-main dark:border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image ? (
                      <img
                        src={formatImageUrl(item.image)}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ChefHat size={22} className="text-text-muted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-primary dark:text-amber-400 uppercase tracking-wider truncate">
                        {item.categoryName || item.station}
                      </span>
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                          <CheckCircle2 size={11} /> In Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 shrink-0">
                          <AlertCircle size={11} /> Stock Out
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-text-main truncate mt-0.5" title={item.name}>
                      {item.name}
                    </h4>

                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xs font-mono font-bold text-text-main">
                        ₹{item.finalPrice ?? item.basePrice}
                      </span>
                      {item.variants && item.variants.length > 0 && (
                        <span className="text-[10px] text-text-muted font-medium">
                          ({item.variants.length} options)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock In / Out Toggle Button */}
                <div className="pt-2 border-t border-border-main dark:border-white/5 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-text-muted font-medium">
                    {isAvailable ? 'Available on Customer Portal' : 'Hidden from Customer Portal'}
                  </span>

                  <button
                    type="button"
                    disabled={isUpdating || !canControl}
                    onClick={() => handleToggleAvailability(item)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
                      isAvailable
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-primary hover:bg-primary-hover text-white shadow-2xs'
                    }`}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : isAvailable ? (
                      <span>Stock Out</span>
                    ) : (
                      <span>Stock In</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
