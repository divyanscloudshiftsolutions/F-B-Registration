import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { MenuItem } from '../../types';
import { VegBadge } from '../customer/VegBadge';
import { MenuItemDrawer } from './MenuItemDrawer';
import { CategoryManagerModal } from './CategoryManagerModal';
import { GstManagementModal } from './GstManagementModal';
import { formatImageUrl } from '../../utils/imageUrl';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  UtensilsCrossed,
  Plus,
  Layers,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Archive,
  X,
  RotateCcw,
  RefreshCw,
  Wine,
  Package,
  Tag,
} from 'lucide-react';

export const MenuCatalogManager: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';
  const canManage = isAdmin || isManager;

  const [menu, setMenu] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedItemToEdit, setSelectedItemToEdit] = useState<MenuItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isGstModalOpen, setIsGstModalOpen] = useState<boolean>(false);

  // Deletion confirm modal
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchMenu = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await api.getMenu(true);
      setMenu(data);
    } catch (err: any) {
      console.warn('Failed to load menu in admin:', err);
      setFetchError(err.message || 'Failed to load menu catalog from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
    const handleGlobalRefresh = () => fetchMenu();
    window.addEventListener('app:global-refresh', handleGlobalRefresh);
    return () => {
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
    };
  }, []);

  const handleToggleAvailability = async (itemId: string, currentAvailability: boolean) => {
    setTogglingId(itemId);
    try {
      const newStatus = !currentAvailability;
      await api.setItemAvailability(itemId, newStatus);
      setMenu((prevSections) =>
        prevSections.map((sec) => ({
          ...sec,
          categories: (sec.categories || []).map((cat: any) => ({
            ...cat,
            items: (cat.items || []).map((i: any) => (i.id === itemId ? { ...i, isAvailable: newStatus } : i)),
          })),
        }))
      );
      setFeedback(`Item marked ${newStatus ? 'IN STOCK' : '86 / SOLD OUT'}!`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback(`Failed to update item: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenCreateDrawer = () => {
    setSelectedItemToEdit(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (item: MenuItem) => {
    setSelectedItemToEdit(item);
    setIsDrawerOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteMenuItem(deletingItem.id);
      setFeedback(res.message || 'Item deleted successfully!');
      setTimeout(() => setFeedback(null), 4000);
      setDeletingItem(null);
      await fetchMenu();
    } catch (err: any) {
      setFeedback(`Failed to delete item: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Flatten items for table display
  const allItems: any[] = [];
  menu.forEach((sec: any) => {
    (sec.categories || []).forEach((cat: any) => {
      (cat.items || []).forEach((item: any) => {
        allItems.push({
          ...item,
          sectionId: sec.id,
          sectionSlug: sec.slug,
          sectionName: sec.name,
          categoryName: cat.name,
        });
      });
    });
  });

  const filteredItems = allItems.filter((i) => {
    if (stationFilter !== 'ALL' && i.station !== stationFilter) return false;
    if (sectionFilter !== 'ALL' && i.sectionSlug !== sectionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = i.name.toLowerCase().includes(q);
      const matchesCat = (i.categoryName || '').toLowerCase().includes(q);
      const matchesDesc = (i.description || '').toLowerCase().includes(q);
      if (!matchesName && !matchesCat && !matchesDesc) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">Menu Catalog & Pricing Management</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Create items, configure offers, maintain categories, and toggle live 86 availability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-purple-600 dark:text-[#D4AF37]" />
              Categories
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsGstModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Tag className="w-4 h-4 text-zinc-700 dark:text-[#D4AF37]" />
              GST and Charges
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenCreateDrawer}
              className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-zinc-950 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Menu Item
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
            feedback.toLowerCase().startsWith('failed')
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {feedback.toLowerCase().startsWith('failed') ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search menu catalog by name, category, or description"
            placeholder="Search by name, category, or ingredients..."
            className="w-full text-xs pl-10 pr-9 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search query"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Section Filter Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          {['ALL', 'eat', 'drink', 'merchandise'].map((sec) => (
            <button
              key={sec}
              onClick={() => setSectionFilter(sec)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all capitalize cursor-pointer ${
                sectionFilter === sec
                  ? 'bg-purple-600 text-white dark:bg-[#D4AF37] dark:text-zinc-950 shadow-xs font-extrabold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {sec === 'ALL' ? 'All Sections' : sec}
            </button>
          ))}
        </div>

        {/* Station Filter Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          {['ALL', 'KITCHEN', 'BAR', 'DESSERT'].map((st) => (
            <button
              key={st}
              onClick={() => setStationFilter(st)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                stationFilter === st
                  ? 'bg-purple-600 text-white dark:bg-[#D4AF37] dark:text-zinc-950 shadow-xs font-extrabold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th scope="col" className="p-3.5 w-14">Image</th>
                <th scope="col" className="p-3.5">Item Name & Details</th>
                <th scope="col" className="p-3.5">Category</th>
                <th scope="col" className="p-3.5">Station</th>
                <th scope="col" className="p-3.5">Pricing & Offers</th>
                <th scope="col" className="p-3.5 text-center">86 Switch</th>
                <th scope="col" className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="p-3.5">
                      <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="p-3.5">
                      <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 mb-1" />
                      <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="p-3.5">
                      <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="p-3.5">
                      <div className="h-4 w-14 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="p-3.5">
                      <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="h-7 w-20 rounded-xl bg-zinc-200 dark:bg-zinc-800 mx-auto" />
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="h-7 w-14 rounded-xl bg-zinc-200 dark:bg-zinc-800 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : fetchError ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">Unable to Load Menu Catalog</p>
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-md mx-auto">
                      {fetchError}
                    </p>
                    <button
                      type="button"
                      onClick={fetchMenu}
                      className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Loading
                    </button>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    {sectionFilter === 'eat' ? (
                      <UtensilsCrossed className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    ) : sectionFilter === 'drink' ? (
                      <Wine className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    ) : sectionFilter === 'merchandise' ? (
                      <Package className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    ) : (
                      <UtensilsCrossed className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    )}
                    <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                      {sectionFilter === 'eat'
                        ? 'No food items found'
                        : sectionFilter === 'drink'
                        ? 'No bar beverage items found'
                        : sectionFilter === 'merchandise'
                        ? 'No merchandise items available'
                        : 'No menu items found'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {sectionFilter === 'merchandise' && !searchQuery
                        ? 'The merchandise catalog currently has no products configured.'
                        : 'Try adjusting your search query, station, or section filter.'}
                    </p>
                    {(searchQuery || sectionFilter !== 'ALL' || stationFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSectionFilter('ALL');
                          setStationFilter('ALL');
                        }}
                        className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-bold text-purple-700 dark:text-[#D4AF37] bg-purple-50 dark:bg-[#D4AF37]/10 hover:bg-purple-100 dark:hover:bg-[#D4AF37]/20 border border-purple-200 dark:border-[#D4AF37]/30 transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isAvail = item.isAvailable !== false;
                  const isToggling = togglingId === item.id;
                  const numBasePrice = Number(item.basePrice);
                  const numFinalPrice = Number(item.finalPrice ?? item.basePrice);
                  const hasDiscount = numFinalPrice < numBasePrice;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      {/* Image Thumbnail */}
                      <td className="p-3.5">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0">
                          {item.image ? (
                            <img
                              src={formatImageUrl(item.image)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Food';
                              }}
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
                      </td>

                      {/* Item Details */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          {item.foodType && <VegBadge type={item.foodType} size="sm" />}
                          <span className="font-bold text-zinc-900 dark:text-white">{item.name}</span>
                          {item.isFeatured && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-100 dark:bg-[#D4AF37]/15 text-purple-700 dark:text-[#D4AF37] border border-purple-200 dark:border-[#D4AF37]/30">
                              Featured
                            </span>
                          )}
                          {item.isPopular && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                              Popular
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p
                            tabIndex={0}
                            title={item.description}
                            className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 max-w-xs mt-0.5 cursor-help hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          >
                            {item.description}
                          </p>
                        )}
                        {item.variants && item.variants.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.variants.map((v: any) => (
                              <span
                                key={v.id || v.name}
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                              >
                                {v.name} ({Number(v.priceDelta) >= 0 ? `+₹${v.priceDelta}` : `-₹${Math.abs(Number(v.priceDelta))}`})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-3.5">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
                          {item.categoryName}
                        </span>
                        {item.subcategory?.name && (
                          <span className="text-[10px] text-zinc-400">↳ {item.subcategory.name}</span>
                        )}
                      </td>

                      {/* Station */}
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-semibold text-[10px]">
                          {item.station}
                        </span>
                      </td>

                      {/* Pricing */}
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          {hasDiscount ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-400 line-through">₹{numBasePrice.toFixed(2)}</span>
                              <span className="text-xs font-black text-purple-700 dark:text-[#D4AF37]">
                                ₹{numFinalPrice.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-zinc-900 dark:text-white">
                              ₹{numBasePrice.toFixed(2)}
                            </span>
                          )}
                          {hasDiscount && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {item.discountMode === 'PERCENTAGE'
                                ? `${item.discountValue}% OFF`
                                : `-₹${item.discountValue}`}
                            </span>
                          )}
                          {item.gstTaxTag && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 mt-1 self-start">
                              {item.gstTaxTag.name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Availability Switch */}
                      <td className="p-3.5 text-center">
                        <button
                          disabled={isToggling || !canManage}
                          onClick={() => handleToggleAvailability(item.id, isAvail)}
                          aria-pressed={isAvail}
                          aria-label={`Toggle availability for ${item.name}. Currently ${isAvail ? 'In Stock' : '86 Sold Out'}`}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            isAvail
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-400'
                          } disabled:opacity-50`}
                        >
                          {isToggling ? 'Updating...' : isAvail ? 'In Stock' : '86 Sold Out'}
                        </button>
                      </td>

                      {/* Row Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditDrawer(item)}
                              aria-label={`Edit ${item.name}`}
                              title={`Edit ${item.name}`}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-purple-600 dark:hover:text-[#D4AF37] hover:bg-purple-50 dark:hover:bg-[#D4AF37]/15 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setDeletingItem(item)}
                              aria-label={`Delete ${item.name}`}
                              title={`Delete ${item.name}`}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Drawer for Item Add/Edit */}
      <MenuItemDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        itemToEdit={selectedItemToEdit}
        isAdmin={isAdmin}
        onItemSaved={fetchMenu}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoryCreatedOrUpdated={fetchMenu}
      />

      {/* Dynamic GST and Charges Management Modal */}
      <GstManagementModal
        isOpen={isGstModalOpen}
        onClose={() => setIsGstModalOpen(false)}
        onAssignmentsUpdated={() => {
          fetchMenu();
        }}
      />{/* Delete / Archive Confirmation Dialog */}
      {deletingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
              <Archive className="w-5 h-5" />
            </div>

            <div>
              <h3 id="delete-dialog-title" className="text-base font-black text-zinc-900 dark:text-white">Delete or Archive Menu Item?</h3>
              <div id="delete-dialog-desc">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Are you sure you want to remove <strong className="text-zinc-900 dark:text-white font-bold">{deletingItem.name}</strong>?
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  • If this item has historical orders, it will be <strong>safely archived</strong> (hidden from all menus while preserving historical records).<br />
                  • If it has zero orders, it will be <strong>permanently deleted</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MenuCatalogManager;
