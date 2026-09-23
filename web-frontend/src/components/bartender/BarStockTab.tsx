import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Wine, Search, Loader2, CheckCircle2, AlertCircle, RefreshCw, X, ShieldAlert, Pencil } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { onSocketEvent } from '../../services/socket';
import { formatImageUrl } from '../../utils/imageUrl';

interface FlatMenuItem {
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
  stockQuantity?: number;
  availableStock?: number;
  variants?: Array<{ id: string; name: string; priceDelta: number }>;
}

export const BarStockTab: React.FC = () => {
  const { user, showToast } = useAuth();
  const [items, setItems] = useState<FlatMenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  // Stock Out Modal state
  const [stockOutModalItem, setStockOutModalItem] = useState<FlatMenuItem | null>(null);

  // Stock In Modal state
  const [stockInModalItem, setStockInModalItem] = useState<FlatMenuItem | null>(null);
  const [stockInQuantity, setStockInQuantity] = useState<number>(50);

  // Compact Stock Edit Modal state
  const [editStockModalItem, setEditStockModalItem] = useState<FlatMenuItem | null>(null);
  const [editStockQuantity, setEditStockQuantity] = useState<number>(50);

  const userRole = (user?.role || '').toLowerCase();
  const canControl = ['bartender', 'admin', 'manager'].includes(userRole);

  const fetchBarItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const sections = await api.getMenu(true);
      const flatList: FlatMenuItem[] = [];

      if (Array.isArray(sections)) {
        sections.forEach((section: any) => {
          // Direct section items
          if (Array.isArray(section.items)) {
            section.items.forEach((it: any) => {
              if (it.station === 'BAR' && !it.isArchived) {
                flatList.push({
                  ...it,
                  sectionName: section.name,
                  categoryName: 'General Bar',
                  basePrice: Number(it.basePrice || 0),
                  finalPrice: Number(it.finalPrice ?? it.basePrice ?? 0),
                  stockQuantity: Number(it.stockQuantity ?? it.stockItem?.currentStock ?? 50),
                  availableStock: Number(it.availableStock ?? it.stockItem?.currentStock ?? 50),
                });
              }
            });
          }

          // Category items
          if (Array.isArray(section.categories)) {
            section.categories.forEach((cat: any) => {
              if (Array.isArray(cat.items)) {
                cat.items.forEach((it: any) => {
                  if (it.station === 'BAR' && !it.isArchived) {
                    flatList.push({
                      ...it,
                      sectionName: section.name,
                      categoryName: cat.name,
                      basePrice: Number(it.basePrice || 0),
                      finalPrice: Number(it.finalPrice ?? it.basePrice ?? 0),
                      stockQuantity: Number(it.stockQuantity ?? it.stockItem?.currentStock ?? 50),
                      availableStock: Number(it.availableStock ?? it.stockItem?.currentStock ?? 50),
                    });
                  }
                });
              }

              // Subcategory items
              if (Array.isArray(cat.subcategories)) {
                cat.subcategories.forEach((sub: any) => {
                  if (Array.isArray(sub.items)) {
                    sub.items.forEach((it: any) => {
                      if (it.station === 'BAR' && !it.isArchived) {
                        flatList.push({
                          ...it,
                          sectionName: section.name,
                          categoryName: `${cat.name} · ${sub.name}`,
                          basePrice: Number(it.basePrice || 0),
                          finalPrice: Number(it.finalPrice ?? it.basePrice ?? 0),
                          stockQuantity: Number(it.stockQuantity ?? it.stockItem?.currentStock ?? 50),
                          availableStock: Number(it.availableStock ?? it.stockItem?.currentStock ?? 50),
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
      console.warn('Failed to load Bar station items:', err);
      if (!silent) {
        showToast(err.message || 'Failed to load bar items', 'danger');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchBarItems();

    const unsubMenuUpdated = onSocketEvent('menu.updated', (payload: any) => {
      if (payload && (payload.action === 'item_availability' || payload.action === 'stock_changed') && payload.itemId) {
        setItems((prev) =>
          prev.map((it) => {
            if (it.id === payload.itemId) {
              const nextAvailable = payload.details?.isAvailable !== undefined ? Boolean(payload.details.isAvailable) : it.isAvailable;
              const nextStock = payload.details?.currentStock ?? payload.details?.stockQuantity ?? it.stockQuantity;
              const nextAvailStock = payload.details?.availableStock ?? it.availableStock;
              return {
                ...it,
                isAvailable: nextAvailable,
                stockQuantity: nextStock,
                availableStock: nextAvailStock,
              };
            }
            return it;
          })
        );
      } else {
        fetchBarItems(true);
      }
    });

    return () => {
      unsubMenuUpdated();
    };
  }, [fetchBarItems]);

  const handleOpenStockIn = (item: FlatMenuItem) => {
    setStockInModalItem(item);
    setStockInQuantity(item.stockQuantity && item.stockQuantity > 0 ? item.stockQuantity : 50);
  };

  const handleOpenEditStock = (item: FlatMenuItem) => {
    setEditStockModalItem(item);
    setEditStockQuantity(item.stockQuantity !== undefined ? item.stockQuantity : 50);
  };

  const handleConfirmEditStock = async () => {
    if (!editStockModalItem || updatingIds.has(editStockModalItem.id)) return;
    const itemId = editStockModalItem.id;
    const qty = Math.max(0, Math.floor(Number(editStockQuantity) || 0));
    const isCurrentlyAvail = editStockModalItem.isAvailable;
    const nextAvailable = isCurrentlyAvail ? (qty > 0) : false;

    setUpdatingIds((prev) => new Set(prev).add(itemId));
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              isAvailable: nextAvailable,
              stockQuantity: qty,
              availableStock: nextAvailable ? qty : 0,
            }
          : it
      )
    );

    try {
      const res = await api.setItemAvailability(itemId, nextAvailable, qty);
      if (res && res.success) {
        showToast(`Stock for ${editStockModalItem.name} updated to ${qty}`, 'success');
        setEditStockModalItem(null);
      } else {
        throw new Error(res?.error?.message || 'Update failed');
      }
    } catch (err: any) {
      fetchBarItems(true);
      showToast(err.message || 'Failed to update stock', 'danger');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleConfirmStockIn = async () => {
    if (!stockInModalItem || updatingIds.has(stockInModalItem.id)) return;
    const itemId = stockInModalItem.id;
    const qty = Math.max(1, Math.floor(Number(stockInQuantity)));

    setUpdatingIds((prev) => new Set(prev).add(itemId));
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, isAvailable: true, stockQuantity: qty, availableStock: qty } : it))
    );

    try {
      const res = await api.setItemAvailability(itemId, true, qty);
      if (res && res.success) {
        showToast(`${stockInModalItem.name} marked Stock In with quantity ${qty}`, 'success');
        setStockInModalItem(null);
      } else {
        throw new Error(res?.error?.message || 'Update failed');
      }
    } catch (err: any) {
      fetchBarItems(true);
      showToast(err.message || 'Failed to update stock in', 'danger');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleConfirmStockOut = async () => {
    if (!stockOutModalItem || updatingIds.has(stockOutModalItem.id)) return;
    const itemId = stockOutModalItem.id;

    setUpdatingIds((prev) => new Set(prev).add(itemId));
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, isAvailable: false } : it))
    );

    try {
      const res = await api.setItemAvailability(itemId, false);
      if (res && res.success) {
        showToast(`${stockOutModalItem.name} marked Stock Out (Underlying stock preserved)`, 'warning');
        setStockOutModalItem(null);
      } else {
        throw new Error(res?.error?.message || 'Update failed');
      }
    } catch (err: any) {
      fetchBarItems(true);
      showToast(err.message || 'Failed to mark stock out', 'danger');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
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
      if (selectedCategory !== 'all' && it.categoryName !== selectedCategory) {
        return false;
      }
      if (statusFilter === 'available' && !it.isAvailable) return false;
      if (statusFilter === 'unavailable' && it.isAvailable) return false;

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
            <Wine size={24} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text-main flex items-center gap-2">
              Bar Stock Management
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Control bar inventory and availability in real time with preserved stock tracking
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
            onClick={() => fetchBarItems()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border-main dark:border-white/10 text-text-muted hover:text-text-main bg-bg-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Refresh Bar Stock"
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
            placeholder="Search bar items by name or category..."
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

      {/* Grid of Bar Items */}
      {loading ? (
        <div className="py-24 text-center text-text-muted flex flex-col items-center justify-center gap-2">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-xs font-bold">Loading Bar Menu Stock...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border-main dark:border-white/10 p-12 text-center text-text-muted space-y-2">
          <Wine size={32} className="mx-auto text-text-muted/40" />
          <h4 className="text-sm font-bold text-text-main">No Bar Items Found</h4>
          <p className="text-xs max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all' || statusFilter !== 'all'
              ? 'No bar items match your current filter criteria.'
              : 'No Bar station items exist in the menu catalog.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isUpdating = updatingIds.has(item.id);
            const isAvailable = item.isAvailable;
            const stockQty = item.stockQuantity ?? 50;
            const availQty = item.availableStock ?? stockQty;
            const isLowStock = isAvailable && availQty > 0 && availQty <= 10;

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
                      <Wine size={22} className="text-text-muted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-primary dark:text-amber-400 uppercase tracking-wider truncate">
                        {item.categoryName || 'Bar Drink'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                            <CheckCircle2 size={11} /> In Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 shrink-0">
                            <AlertCircle size={11} /> Stock Out
                          </span>
                        )}
                        {canControl && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditStock(item)}
                            title={`Edit stock quantity for ${item.name}`}
                            className="p-1 rounded-md text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-text-main truncate mt-0.5" title={item.name}>
                      {item.name}
                    </h4>

                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs font-mono font-bold text-text-main">
                        ₹{item.finalPrice ?? item.basePrice}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-border-main dark:border-white/10 text-text-main">
                          Stock: {stockQty}
                        </span>
                        {isLowStock && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            Low ({availQty})
                          </span>
                        )}
                      </div>
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
                    onClick={() => {
                      if (isAvailable) {
                        setStockOutModalItem(item);
                      } else {
                        handleOpenStockIn(item);
                      }
                    }}
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

      {/* Stock Out Confirmation Modal */}
      {stockOutModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-bg-surface border border-border-main dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-main">
                  Mark "{stockOutModalItem.name}" as Stock Out?
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  This will keep all already-accepted items unaffected, but automatically mark all unaccepted orders as Stock Out (₹0) and update menu availability. Underlying stock ({stockOutModalItem.stockQuantity ?? 50}) will remain preserved.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-main dark:border-white/5">
              <button
                type="button"
                disabled={updatingIds.has(stockOutModalItem.id)}
                onClick={() => setStockOutModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border border-border-main dark:border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingIds.has(stockOutModalItem.id)}
                onClick={handleConfirmStockOut}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                {updatingIds.has(stockOutModalItem.id) ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm Stock Out</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock In Replenish Modal */}
      {stockInModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-bg-surface border border-border-main dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-text-main">
                  Stock In: {stockInModalItem.name}
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Underlying preserved stock is <strong className="text-text-main font-mono">{stockInModalItem.stockQuantity ?? 50}</strong>. Confirm this quantity or enter a replenished amount to make this item available for future orders.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-main">
                Available Stock Quantity
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={stockInQuantity}
                onChange={(e) => setStockInQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3.5 py-2.5 bg-bg-surface border border-border-main dark:border-white/10 rounded-xl text-sm font-mono font-bold text-text-main focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Enter stock quantity (e.g. 50)"
              />
              <p className="text-[11px] text-text-muted">
                Must be a positive whole number. Past Stock-Out items will remain unaffected.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-main dark:border-white/5">
              <button
                type="button"
                disabled={updatingIds.has(stockInModalItem.id)}
                onClick={() => setStockInModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border border-border-main dark:border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingIds.has(stockInModalItem.id) || !stockInQuantity || stockInQuantity < 1}
                onClick={handleConfirmStockIn}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {updatingIds.has(stockInModalItem.id) ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Confirm Stock In</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Edit Stock Quantity Modal */}
      {editStockModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-bg-surface border border-border-main dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Pencil size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-text-main truncate">
                  Edit Stock: {editStockModalItem.name}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {editStockModalItem.isAvailable
                    ? 'Currently Available on Customer Portal'
                    : 'Currently Stock Out (Hidden from Customer Portal)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditStockModalItem(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-main">
                  Stock Quantity
                </label>
                <span className="text-[11px] text-text-muted">
                  Current: <strong className="font-mono text-text-main">{editStockModalItem.stockQuantity ?? 50}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditStockQuantity((prev) => Math.max(0, prev - 1))}
                  className="w-10 h-10 rounded-xl border border-border-main dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main font-black text-sm flex items-center justify-center transition-colors cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editStockQuantity}
                  onChange={(e) => setEditStockQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="flex-1 px-3.5 py-2.5 bg-bg-surface border border-border-main dark:border-white/10 rounded-xl text-center text-base font-mono font-bold text-text-main focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => setEditStockQuantity((prev) => prev + 1)}
                  className="w-10 h-10 rounded-xl border border-border-main dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main font-black text-sm flex items-center justify-center transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Quick delta adjustment chips */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {[10, 25, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEditStockQuantity(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                      editStockQuantity === preset
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'bg-black/5 dark:bg-white/5 text-text-muted hover:text-text-main border-transparent'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {!editStockModalItem.isAvailable && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  ℹ️ This item is currently marked <strong>Stock Out</strong>. The new quantity will be saved as the preserved inventory count without exposing the item until you toggle <strong>Stock In</strong>.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-main dark:border-white/5">
              <button
                type="button"
                disabled={updatingIds.has(editStockModalItem.id)}
                onClick={() => setEditStockModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border border-border-main dark:border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingIds.has(editStockModalItem.id) || editStockQuantity < 0}
                onClick={handleConfirmEditStock}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {updatingIds.has(editStockModalItem.id) ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Stock</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
