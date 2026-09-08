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
  Edit3,
  Eye,
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
  UploadCloud,
  ChevronLeft,
  ChevronRight,
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
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Product Details View Modal State
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);

  // Pagination State (10 products per page)
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedItemToEdit, setSelectedItemToEdit] = useState<MenuItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isGstModalOpen, setIsGstModalOpen] = useState<boolean>(false);

  // Deletion confirm modal
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Image Preview & Edit Dialog
  const [imageModalItem, setImageModalItem] = useState<MenuItem | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState<string>('');
  const [isModalUploading, setIsModalUploading] = useState<boolean>(false);
  const [isModalSaving, setIsModalSaving] = useState<boolean>(false);
  const [modalImageError, setModalImageError] = useState<string | null>(null);

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

  // Auto-open Edit Drawer if editItemId is in URL parameters
  useEffect(() => {
    if (menu.length === 0) return;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('editItemId');
      if (editId) {
        for (const sec of menu) {
          for (const cat of (sec as any).categories || []) {
            const found = (cat.items || []).find((it: any) => String(it.id) === String(editId));
            if (found) {
              setSelectedItemToEdit(found);
              setIsDrawerOpen(true);
              const cleanUrl = window.location.pathname;
              window.history.replaceState({}, '', cleanUrl);
              return;
            }
          }
        }
      }
    }
  }, [menu]);

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

  // Image Dialog Handlers
  const handleOpenImageModal = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setImageModalItem(item);
    setModalImageUrl(item.image || '');
    setModalImageError(null);
  };

  const handleCloseImageModal = () => {
    setImageModalItem(null);
    setModalImageUrl('');
    setModalImageError(null);
  };

  const handleModalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsModalUploading(true);
    setModalImageError(null);
    try {
      const uploadedUrl = await api.uploadMenuImage(file);
      setModalImageUrl(uploadedUrl);
    } catch (err: any) {
      setModalImageError(err.message || 'Failed to upload image file');
    } finally {
      setIsModalUploading(false);
    }
  };

  const handleModalSearchImage = () => {
    if (!imageModalItem) return;
    const query = imageModalItem.name.trim();
    if (!query) return;

    const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
    if (typeof window !== 'undefined') {
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleModalAutoPaste = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setModalImageUrl(text.trim());
        }
      } catch {
        // Clipboard read permission denied or not supported
      }
    }
  };

  const handleModalSaveImage = async () => {
    if (!imageModalItem) return;
    setModalImageError(null);

    const trimmedUrl = modalImageUrl.trim();
    if (trimmedUrl && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('/uploads/')) {
      setModalImageError('Please enter a valid HTTPS or HTTP image URL');
      return;
    }

    setIsModalSaving(true);
    try {
      await api.updateMenuItem(imageModalItem.id, {
        image: trimmedUrl || null,
      });

      // Update in-place in state for immediate reflection without page reload
      setMenu((prevMenu) =>
        prevMenu.map((sec) => ({
          ...sec,
          categories: (sec.categories || []).map((cat: any) => ({
            ...cat,
            items: (cat.items || []).map((it: any) =>
              it.id === imageModalItem.id ? { ...it, image: trimmedUrl || null } : it
            ),
          })),
        }))
      );

      setFeedback(`Image updated for ${imageModalItem.name}`);
      setTimeout(() => setFeedback(null), 3000);
      handleCloseImageModal();
    } catch (err: any) {
      setModalImageError(err.message || 'Failed to update image');
    } finally {
      setIsModalSaving(false);
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
          sectionName: sec.slug === 'eat' ? 'Food' : sec.name,
          categoryName: cat.name,
          subcategory: item.subcategory || (cat.subcategories || []).find((s: any) => s.id === item.subcategoryId),
        });
      });
    });
    // Unassigned items directly under section:
    (sec.items || []).forEach((item: any) => {
      allItems.push({
        ...item,
        sectionId: sec.id,
        sectionSlug: sec.slug,
        sectionName: sec.slug === 'eat' ? 'Food' : sec.name,
        categoryName: 'None',
        subcategory: null,
      });
    });
  });

  // Check if directed to edit a specific product from Customer Portal (or URL query)
  useEffect(() => {
    if (typeof window !== 'undefined' && allItems.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('editItemId');
      if (editId) {
        const target = allItems.find((i) => i.id === editId);
        if (target) {
          handleOpenEditDrawer(target);
          // Clean the query param to prevent re-triggering on subsequent actions
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
    }
  }, [allItems.length]);

  const filteredItems = allItems.filter((i) => {
    if (sectionFilter !== 'ALL' && i.sectionSlug !== sectionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cleanQ = q.replace(/[-\s_]/g, '');

      // 1. Name & Description
      const matchesName = i.name.toLowerCase().includes(q);
      const matchesDesc = (i.description || '').toLowerCase().includes(q);

      // 2. Category & Subcategory
      const matchesCat = (i.categoryName || '').toLowerCase().includes(q);
      const matchesSubcat = (i.subcategory?.name || '').toLowerCase().includes(q);

      // 3. Dietary Classification (FoodType: VEG, NON_VEG, EGG, VEGAN)
      let matchesDietary = false;
      if (i.foodType) {
        const ft = i.foodType.toLowerCase();
        const cleanFt = ft.replace(/[_-\s]/g, '');
        if (cleanQ === 'veg' || cleanQ === 'vegetarian') {
          matchesDietary = ft === 'veg' || ft === 'vegan';
        } else if (cleanQ === 'nonveg' || cleanQ === 'nonvegetarian') {
          matchesDietary = ft === 'non_veg';
        } else if (cleanQ === 'egg' || cleanQ === 'eggetarian') {
          matchesDietary = ft === 'egg';
        } else if (cleanQ === 'vegan') {
          matchesDietary = ft === 'vegan';
        } else {
          matchesDietary = ft.includes(q) || cleanFt.includes(cleanQ);
        }
      }

      // 4. Product Tags & Allergens
      const matchesTags = Array.isArray(i.tags) && i.tags.some((t: string) => t.toLowerCase().includes(q));
      const matchesAllergens = Array.isArray(i.allergens) && i.allergens.some((a: string) => a.toLowerCase().includes(q));

      // 5. Preparation Station / Area
      const matchesStation =
        (i.station || '').toLowerCase().includes(q) ||
        (i.station === 'KITCHEN' && 'kitchen'.includes(q)) ||
        (i.station === 'BAR' && 'bar'.includes(q)) ||
        (i.station === 'CASHIER' && ('front desk'.includes(q) || 'cashier'.includes(q)));

      // 6. Variants
      const matchesVariants = Array.isArray(i.variants) && i.variants.some((v: any) => v.name.toLowerCase().includes(q));

      if (
        !matchesName &&
        !matchesDesc &&
        !matchesCat &&
        !matchesSubcat &&
        !matchesDietary &&
        !matchesTags &&
        !matchesAllergens &&
        !matchesStation &&
        !matchesVariants
      ) {
        return false;
      }
    }
    return true;
  });

  // Pagination Calculations (10 products per page)
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sectionFilter]);

  // Clamp current page if total pages decreases (e.g. after item deletion)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const getPaginationItems = (current: number, total: number): (number | string)[] => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

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
              {sec === 'ALL' ? 'All Sections' : sec === 'eat' ? 'Food' : sec}
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
                <th scope="col" className="p-3.5">Preparation Area</th>
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
                        : 'Try adjusting your search query or section filter.'}
                    </p>
                    {(searchQuery || sectionFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSectionFilter('ALL');
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
                paginatedItems.map((item) => {
                  const isAvail = item.isAvailable !== false;
                  const isToggling = togglingId === item.id;
                  const numBasePrice = Number(item.basePrice);
                  const numFinalPrice = Number(item.finalPrice ?? item.basePrice);
                  const hasDiscount = numFinalPrice < numBasePrice;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      {/* Image Thumbnail (Clickable to Preview / Edit) */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={(e) => handleOpenImageModal(item, e)}
                          title={`Edit / Preview image for ${item.name}`}
                          aria-label={`Edit / Preview image for ${item.name}`}
                          className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 hover:border-purple-400 dark:hover:border-[#D4AF37] hover:scale-105 transition-all cursor-pointer group"
                        >
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
                            <ImageIcon className="w-4 h-4 text-zinc-400 group-hover:text-purple-600 dark:group-hover:text-[#D4AF37] transition-colors" />
                          )}
                        </button>
                      </td>

                      {/* Item Details */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailItem(item)}
                          className="text-left group/item cursor-pointer w-full focus:outline-none"
                          title={`Click to view details for ${item.name}`}
                        >
                          <div className="flex items-center gap-1.5">
                            {item.foodType && <VegBadge type={item.foodType} size="sm" />}
                            <span className="font-bold text-zinc-900 dark:text-white group-hover/item:text-purple-600 dark:group-hover/item:text-[#D4AF37] transition-colors">{item.name}</span>
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
                              className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 max-w-xs mt-0.5 group-hover/item:text-zinc-700 dark:group-hover/item:text-zinc-300 transition-colors"
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
                        </button>
                      </td>

                      {/* Category */}
                      <td className="p-3.5">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
                          {item.categoryName || 'None'}
                        </span>
                        {item.subcategory?.name ? (
                          <span className="text-[10px] text-zinc-400">↳ {item.subcategory.name}</span>
                        ) : (
                          <span className="text-[10px] text-zinc-400/80 italic">None</span>
                        )}
                      </td>

                      {/* Station */}
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-semibold text-[10px]">
                          {item.station === 'KITCHEN' ? 'Kitchen' : item.station === 'BAR' ? 'Bar' : item.station === 'CASHIER' ? 'Front Desk' : item.station}
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
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItem(item)}
                            aria-label={`View details for ${item.name}`}
                            title={`View details for ${item.name}`}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-purple-600 dark:hover:text-[#D4AF37] hover:bg-purple-50 dark:hover:bg-[#D4AF37]/15 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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

        {/* Pagination Bar (10 items per page) */}
        {filteredItems.length > 0 && (
          <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Showing <span className="font-bold text-zinc-900 dark:text-white">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-zinc-900 dark:text-white">
                {Math.min(endIndex, filteredItems.length)}
              </span>{' '}
              of <span className="font-bold text-zinc-900 dark:text-white">{filteredItems.length}</span> products
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {/* Previous Button */}
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {getPaginationItems(currentPage, totalPages).map((page, idx) => {
                  if (page === '...') {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className="w-8 h-8 flex items-center justify-center text-xs text-zinc-400 font-bold"
                      >
                        ...
                      </span>
                    );
                  }
                  const pageNum = page as number;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={`page-${pageNum}`}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                        isActive
                          ? 'bg-purple-600 text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                          : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              {/* Next Button */}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
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
      />

      {/* Image Preview & Edit Dialog (z-[60] to remain above side navigation and all layers) */}
      {imageModalItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-dialog-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-5">
            {/* Dialog Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 id="image-dialog-title" className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-600 dark:text-[#D4AF37]" />
                  Product Image — {imageModalItem.name}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Preview, upload a local file, or paste a direct image URL
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseImageModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error banner if any */}
            {modalImageError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalImageError}</span>
              </div>
            )}

            {/* Large Image Preview (Perfect Square, complete image contained without cropping, blurred background) */}
            <div className="w-full max-w-[320px] sm:max-w-[360px] mx-auto aspect-square rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-2 relative group shadow-inner">
              {modalImageUrl ? (
                <>
                  {/* Subtle blurred background of the same image filling the square frame */}
                  <img
                    src={formatImageUrl(modalImageUrl)}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-60 dark:opacity-40 pointer-events-none"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  {/* Gentle dark overlay to keep foreground image visually prominent and contrast clean */}
                  <div className="absolute inset-0 bg-black/10 dark:bg-black/25 pointer-events-none" />
                  {/* Sharp original foreground image fully contained without cropping */}
                  <img
                    src={formatImageUrl(modalImageUrl)}
                    alt={imageModalItem.name}
                    className="relative z-10 w-full h-full object-contain object-center drop-shadow-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Invalid+Image+URL';
                    }}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-500 relative z-10">
                  <ImageIcon className="w-12 h-12 stroke-[1.5]" />
                  <span className="text-xs font-semibold">No image currently assigned</span>
                </div>
              )}
            </div>

            {/* Action Buttons: 1. Upload Image, 2. Search Image */}
            <div className="flex flex-wrap gap-2.5">
              {/* 1. Upload Image from local file */}
              <input
                type="file"
                id="menu-catalog-image-upload"
                accept="image/*"
                onChange={handleModalFileUpload}
                className="hidden"
              />
              <label
                htmlFor="menu-catalog-image-upload"
                className="flex-1 min-w-[130px] px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-[#D4AF37] dark:hover:border-[#D4AF37]/50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isModalUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-[#D4AF37]" />
                ) : (
                  <UploadCloud className="w-4 h-4 text-purple-600 dark:text-[#D4AF37]" />
                )}
                <span>{isModalUploading ? 'Uploading...' : 'Upload Image'}</span>
              </label>

              {/* 2. Search Image on Google Images */}
              <button
                type="button"
                onClick={handleModalSearchImage}
                title="Search product image on Google"
                className="flex-1 min-w-[130px] px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-[#D4AF37] dark:hover:border-[#D4AF37]/50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Search className="w-4 h-4 text-purple-600 dark:text-[#D4AF37]" />
                <span>Search Image</span>
              </button>
            </div>

            {/* Direct Image URL (HTTPS) Input with Auto-Paste on Click/Focus */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Direct Image URL (HTTPS)
                </label>
                {modalImageUrl && (
                  <button
                    type="button"
                    onClick={() => setModalImageUrl('')}
                    className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <input
                type="url"
                placeholder="Click to auto-paste or enter HTTPS image URL..."
                value={modalImageUrl}
                onChange={(e) => setModalImageUrl(e.target.value)}
                onClick={handleModalAutoPaste}
                onFocus={handleModalAutoPaste}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
              />
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                Tip: Copy an image link from Google Images, then click inside this field to auto-paste.
              </span>
            </div>

            {/* Dialog Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                disabled={isModalSaving}
                onClick={handleCloseImageModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isModalSaving || isModalUploading}
                onClick={handleModalSaveImage}
                className="px-5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 dark:bg-[#D4AF37] dark:hover:bg-[#c5a030] text-white dark:text-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isModalSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Product Details View Modal */}
      {selectedDetailItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-product-detail-title"
          onClick={() => setSelectedDetailItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl max-h-[90vh] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col cursor-default text-zinc-900 dark:text-zinc-100"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/80 dark:bg-zinc-900/60">
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedDetailItem.foodType && (
                  <VegBadge type={selectedDetailItem.foodType} size="sm" />
                )}
                <h3 id="admin-product-detail-title" className="text-base sm:text-lg font-black text-zinc-900 dark:text-white truncate">
                  {selectedDetailItem.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      const itemToEdit = selectedDetailItem;
                      setSelectedDetailItem(null);
                      handleOpenEditDrawer(itemToEdit);
                    }}
                    title="Edit Product"
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 hover:bg-purple-200 dark:bg-[#D4AF37]/15 dark:hover:bg-[#D4AF37]/25 text-purple-700 dark:text-[#D4AF37] border border-purple-300 dark:border-[#D4AF37]/30 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDetailItem(null)}
                  aria-label="Close product details"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Product Image: Aspect-square contained container with blurred background fill */}
              {selectedDetailItem.image || selectedDetailItem.imageUrl ? (
                <div
                  className="relative w-full aspect-square max-h-72 sm:max-h-80 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-inner"
                >
                  <img
                    src={formatImageUrl(selectedDetailItem.image || selectedDetailItem.imageUrl)}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-30 pointer-events-none"
                  />
                  <img
                    src={formatImageUrl(selectedDetailItem.image || selectedDetailItem.imageUrl)}
                    alt={selectedDetailItem.name}
                    className="relative z-10 max-h-full max-w-full object-contain p-3 drop-shadow-md"
                  />
                </div>
              ) : (
                <div className="w-full h-44 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 gap-1.5">
                  <span className="text-3xl select-none" role="img" aria-label="No image">🍽️</span>
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No Image</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">No product image uploaded</span>
                </div>
              )}

              {/* Price & Status Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                <div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-bold block">
                    Pricing
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-lg sm:text-xl font-black text-purple-700 dark:text-[#D4AF37]">
                      ₹{Number(selectedDetailItem.finalPrice ?? selectedDetailItem.basePrice ?? 0).toFixed(2)}
                    </span>
                    {Number(selectedDetailItem.finalPrice ?? selectedDetailItem.basePrice) < Number(selectedDetailItem.basePrice ?? 0) && (
                      <span className="text-xs text-zinc-400 line-through">
                        ₹{Number(selectedDetailItem.basePrice).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedDetailItem.isAvailable === false ? (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                      Sold Out
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                      In Stock
                    </span>
                  )}
                  {Number(selectedDetailItem.finalPrice ?? selectedDetailItem.basePrice) < Number(selectedDetailItem.basePrice ?? 0) && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                      {selectedDetailItem.discountMode === 'PERCENTAGE'
                        ? `${selectedDetailItem.discountValue}% OFF`
                        : `₹${selectedDetailItem.discountValue} OFF`}
                    </span>
                  )}
                  {selectedDetailItem.isFeatured && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                      Featured
                    </span>
                  )}
                  {selectedDetailItem.isPopular && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-[#D4AF37]/15 text-amber-800 dark:text-[#D4AF37] border border-amber-200 dark:border-[#D4AF37]/30">
                      Popular
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Description
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  {selectedDetailItem.description?.trim() || 'N/A'}
                </p>
              </div>

              {/* Administrative & Technical Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Section */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Section
                  </span>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.sectionSlug === 'eat'
                      ? 'Food'
                      : selectedDetailItem.sectionName || (selectedDetailItem.sectionSlug ? selectedDetailItem.sectionSlug.toUpperCase() : 'N/A')}
                  </span>
                </div>

                {/* Category */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Category
                  </span>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.categoryName || selectedDetailItem.category?.name || 'N/A'}
                  </span>
                </div>

                {/* Subcategory */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Subcategory
                  </span>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.subcategory?.name || selectedDetailItem.subcategoryName
                      ? (selectedDetailItem.subcategory?.name || selectedDetailItem.subcategoryName)
                      : selectedDetailItem.subcategoryId
                      ? 'N/A'
                      : 'None'}
                  </span>
                </div>

                {/* Dietary Classification */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Dietary Classification
                  </span>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.foodType
                      ? selectedDetailItem.foodType === 'VEG'
                        ? 'Vegetarian (Veg)'
                        : selectedDetailItem.foodType === 'NON_VEG'
                        ? 'Non-Vegetarian (Non-Veg)'
                        : selectedDetailItem.foodType === 'EGG'
                        ? 'Contains Egg'
                        : selectedDetailItem.foodType === 'VEGAN'
                        ? 'Vegan'
                        : selectedDetailItem.foodType
                      : 'N/A'}
                  </span>
                </div>

                {/* Preparation Area / Station */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Preparation Area
                  </span>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.station === 'KITCHEN'
                      ? 'Kitchen'
                      : selectedDetailItem.station === 'BAR'
                      ? 'Bar'
                      : selectedDetailItem.station === 'CASHIER'
                      ? 'Front Desk / Cashier'
                      : selectedDetailItem.station || 'N/A'}
                  </span>
                </div>

                {/* Prep Time */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Prep Time
                  </span>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.preparationTime !== undefined && selectedDetailItem.preparationTime !== null
                      ? `${selectedDetailItem.preparationTime} mins`
                      : 'N/A'}
                  </span>
                </div>

                {/* GST Tax Tag */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    GST Tax Tag
                  </span>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.gstTaxTag?.name
                      ? `${selectedDetailItem.gstTaxTag.name} (${selectedDetailItem.gstTaxTag.percentage}%)`
                      : selectedDetailItem.taxRate !== undefined && selectedDetailItem.taxRate !== null
                      ? `${selectedDetailItem.taxRate}% GST${selectedDetailItem.hsnCode ? ` (HSN: ${selectedDetailItem.hsnCode})` : ''}`
                      : 'None'}
                  </span>
                </div>

                {/* Allergens */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Allergens
                  </span>
                  {selectedDetailItem.allergens && selectedDetailItem.allergens.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedDetailItem.allergens.map((a: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px]">
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">None</span>
                  )}
                </div>

                {/* Tags */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Tags
                  </span>
                  {selectedDetailItem.tags && selectedDetailItem.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedDetailItem.tags.map((t: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-purple-50 dark:bg-zinc-800 text-purple-700 dark:text-[#D4AF37] text-[10px] font-semibold">
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">None</span>
                  )}
                </div>
              </div>

              {/* Variants (if present) */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60 space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Available Variants
                </span>
                {selectedDetailItem.variants && selectedDetailItem.variants.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedDetailItem.variants.map((v: any) => (
                      <span
                        key={v.id || v.name}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-zinc-700"
                      >
                        {v.name} ({Number(v.priceDelta) >= 0 ? `+₹${v.priceDelta}` : `-₹${Math.abs(Number(v.priceDelta))}`})
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-400">None</span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-zinc-400 font-mono">
                ID: {selectedDetailItem.id}
              </span>
              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      const itemToEdit = selectedDetailItem;
                      setSelectedDetailItem(null);
                      handleOpenEditDrawer(itemToEdit);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Product</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDetailItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation Dialog */}
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
