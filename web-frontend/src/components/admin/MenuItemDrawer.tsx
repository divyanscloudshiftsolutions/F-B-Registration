import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { MenuItem, MenuSection, MenuCategory, MenuSubcategory, FoodType, Station, DiscountMode, GstTaxTag } from '../../types';
import { VegBadge } from '../customer/VegBadge';
import { formatImageUrl } from '../../utils/imageUrl';
import {
  X,
  Save,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  UploadCloud,
  Link as LinkIcon,
  Sparkles,
  Lock,
  Tag,
  Check,
  ImageIcon,
  Search,
} from 'lucide-react';

interface MenuItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit?: MenuItem | null;
  isAdmin: boolean;
  onItemSaved: () => void;
}

export const MenuItemDrawer: React.FC<MenuItemDrawerProps> = ({
  isOpen,
  onClose,
  itemToEdit,
  isAdmin,
  onItemSaved,
}) => {
  const isEditMode = Boolean(itemToEdit);

  // Reference catalog data
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [subcategories, setSubcategories] = useState<MenuSubcategory[]>([]);

  // Form State
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [foodType, setFoodType] = useState<FoodType | ''>('VEG');
  const [station, setStation] = useState<Station>('KITCHEN');
  const [preparationTime, setPreparationTime] = useState<number>(10);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [isPopular, setIsPopular] = useState<boolean>(false);

  // Pricing & Offers
  const [basePrice, setBasePrice] = useState<string>('');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('AMOUNT');
  const [discountValue, setDiscountValue] = useState<string>('0');
  const [gstTags, setGstTags] = useState<GstTaxTag[]>([]);
  const [selectedGstTaxTagId, setSelectedGstTaxTagId] = useState<string>('');

  // Image State
  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // Variants & Modifiers
  const [variants, setVariants] = useState<Array<{ id?: string; name: string; priceDelta: string; sortOrder?: number }>>([]);
  const [modifierGroups, setModifierGroups] = useState<
    Array<{
      id?: string;
      name: string;
      isRequired: boolean;
      isMulti: boolean;
      options: Array<{ id?: string; name: string; priceDelta: string; sortOrder?: number }>;
    }>
  >([]);

  // UI state
  const [activeTab, setActiveTab] = useState<'details' | 'pricing' | 'image' | 'customization'>('details');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline Subcategory Creation State
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState<boolean>(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState<string>('');
  const [isSubmittingSubcategory, setIsSubmittingSubcategory] = useState<boolean>(false);

  const handleCreateSubcategoryInline = async () => {
    if (!newSubcategoryName.trim() || !selectedCategoryId) return;
    setIsSubmittingSubcategory(true);
    setErrorMsg(null);
    try {
      const created = await api.createSubcategory({
        categoryId: selectedCategoryId,
        name: newSubcategoryName.trim(),
      });
      setCategories((prev) =>
        prev.map((c) =>
          c.id === selectedCategoryId
            ? { ...c, subcategories: [...(c.subcategories || []), created] }
            : c
        )
      );
      setSubcategories((prev) => [...prev, created]);
      setSelectedSubcategoryId(created.id);
      setNewSubcategoryName('');
      setIsCreatingSubcategory(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create subcategory');
    } finally {
      setIsSubmittingSubcategory(false);
    }
  };

  // Load catalog sections, categories, and GST tags
  useEffect(() => {
    if (!isOpen) return;
    const fetchCatalog = async () => {
      setIsLoadingCatalog(true);
      try {
        const [secs, cats, tags] = await Promise.all([
          api.getSections(),
          api.getCategories(),
          api.getGstTaxTags(),
        ]);
        setSections(secs);
        setCategories(cats);
        setGstTags(tags);
      } catch (err: any) {
        console.warn('Failed to load menu metadata:', err);
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    fetchCatalog();
  }, [isOpen]);

  // Populate or reset form
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setActiveTab('details');

    if (itemToEdit) {
      setName(itemToEdit.name || '');
      setDescription(itemToEdit.description || '');
      setSelectedSectionId(itemToEdit.sectionId || '');
      setSelectedCategoryId(itemToEdit.categoryId || '');
      setSelectedSubcategoryId(itemToEdit.subcategoryId || '');
      setSelectedGstTaxTagId(itemToEdit.gstTaxTagId || itemToEdit.gstTaxTag?.id || '');
      setFoodType(itemToEdit.foodType || 'VEG');
      setStation(itemToEdit.station || 'KITCHEN');
      setPreparationTime(itemToEdit.preparationTime ?? 10);
      setIsAvailable(itemToEdit.isAvailable ?? true);
      setIsFeatured(itemToEdit.isFeatured ?? false);
      setIsPopular(itemToEdit.isPopular ?? false);

      setBasePrice(String(itemToEdit.basePrice ?? ''));
      setDiscountMode((itemToEdit.discountMode as DiscountMode) || 'AMOUNT');
      setDiscountValue(String(itemToEdit.discountValue ?? '0'));

      setImageUrl(itemToEdit.image || '');
      setImageTab(itemToEdit.image && itemToEdit.image.startsWith('http') ? 'url' : 'upload');

      setVariants(
        (itemToEdit.variants || []).map((v) => ({
          id: v.id,
          name: v.name,
          priceDelta: String(v.priceDelta),
          sortOrder: v.sortOrder,
        }))
      );

      setModifierGroups(
        (itemToEdit.modifierGroups || []).map((g) => ({
          id: g.id,
          name: g.name,
          isRequired: g.isRequired,
          isMulti: g.isMulti,
          options: (g.options || []).map((o) => ({
            id: o.id,
            name: o.name,
            priceDelta: String(o.priceDelta),
            sortOrder: o.sortOrder,
          })),
        }))
      );
    } else {
      // Reset defaults
      setName('');
      setDescription('');
      setSelectedSectionId('');
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
      setSelectedGstTaxTagId('');
      setFoodType('VEG');
      setStation('KITCHEN');
      setPreparationTime(10);
      setIsAvailable(true);
      setIsFeatured(false);
      setIsPopular(false);
      setBasePrice('');
      setDiscountMode('AMOUNT');
      setDiscountValue('0');
      setImageUrl('');
      setImageTab('upload');
      setVariants([]);
      setModifierGroups([]);
    }
  }, [isOpen, itemToEdit]);

  // Set default GST tag if none selected on new item
  useEffect(() => {
    if (!itemToEdit && gstTags.length > 0 && !selectedGstTaxTagId) {
      const def = gstTags.find((t) => t.name === '5% GST') || gstTags[0];
      if (def) setSelectedGstTaxTagId(def.id);
    }
  }, [itemToEdit, gstTags, selectedGstTaxTagId]);

  // Update subcategories list when selected category changes
  useEffect(() => {
    if (!selectedCategoryId) {
      setSubcategories([]);
      setSelectedSubcategoryId('');
      setIsCreatingSubcategory(false);
      setNewSubcategoryName('');
      return;
    }
    const cat = categories.find((c) => c.id === selectedCategoryId);
    if (cat) {
      setSelectedSectionId(cat.sectionId);
      setSubcategories(cat.subcategories || []);
      // If currently selected subcategory doesn't belong to this category, reset it
      if (selectedSubcategoryId && !(cat.subcategories || []).some((s) => s.id === selectedSubcategoryId)) {
        setSelectedSubcategoryId('');
      }
    }
  }, [selectedCategoryId, categories]);

  // Compute live price & offer previews
  const numBase = parseFloat(basePrice) || 0;
  const numDisc = parseFloat(discountValue) || 0;
  let finalNetPrice = numBase;
  let savingsAmount = 0;
  let savingsPercent = 0;

  if (numBase > 0) {
    if (discountMode === 'PERCENTAGE') {
      const cappedPercent = Math.min(100, Math.max(0, numDisc));
      savingsAmount = Math.round((numBase * (cappedPercent / 100)) * 100) / 100;
      finalNetPrice = Math.max(0, Math.round((numBase - savingsAmount) * 100) / 100);
      savingsPercent = cappedPercent;
    } else {
      savingsAmount = Math.min(numBase, Math.max(0, numDisc));
      finalNetPrice = Math.max(0, Math.round((numBase - savingsAmount) * 100) / 100);
      savingsPercent = Math.round((savingsAmount / numBase) * 100);
    }
  }

  // Handle local image file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setErrorMsg(null);
    try {
      const uploadedUrl = await api.uploadMenuImage(file);
      setImageUrl(uploadedUrl);
    } catch (err: any) {
      setErrorMsg(err.message || 'Image upload failed');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Open Google Images search in user's default browser based primarily on Product Name
  const handleSearchImage = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter a Product Name first to search for images');
      setActiveTab('details');
      return;
    }

    // Product Name is the primary search term. Use concise keywords from description only if helpful
    let query = trimmedName;
    const trimmedDesc = description.trim();
    if (trimmedDesc && trimmedDesc.length > 0 && trimmedDesc.length <= 40) {
      // If description is brief and specific, append it cleanly
      query = `${trimmedName} ${trimmedDesc}`;
    }

    const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
    if (typeof window !== 'undefined') {
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Automatically paste clipboard content into the Direct Image URL input field on click/focus
  const handleAutoPasteImageUrl = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const trimmed = text.trim();
          setImageUrl(trimmed);
        }
      } catch (err) {
        // Fallback: If clipboard read permission is blocked or denied, normal focus/manual paste remains available
      }
    }
  };

  // Add Variant
  const handleAddVariant = () => {
    setVariants((prev) => [...prev, { name: '', priceDelta: '0' }]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Add Modifier Group
  const handleAddModifierGroup = () => {
    setModifierGroups((prev) => [
      ...prev,
      {
        name: '',
        isRequired: false,
        isMulti: false,
        options: [{ name: '', priceDelta: '0' }],
      },
    ]);
  };

  const handleRemoveModifierGroup = (groupIndex: number) => {
    setModifierGroups((prev) => prev.filter((_, idx) => idx !== groupIndex));
  };

  const handleAddOptionToGroup = (groupIndex: number) => {
    setModifierGroups((prev) =>
      prev.map((g, idx) => (idx === groupIndex ? { ...g, options: [...g.options, { name: '', priceDelta: '0' }] } : g))
    );
  };

  const handleRemoveOptionFromGroup = (groupIndex: number, optionIndex: number) => {
    setModifierGroups((prev) =>
      prev.map((g, idx) =>
        idx === groupIndex ? { ...g, options: g.options.filter((_, oIdx) => oIdx !== optionIndex) } : g
      )
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Item name is required');
      setActiveTab('details');
      return;
    }
    if (!selectedCategoryId) {
      setErrorMsg('Category selection is required');
      setActiveTab('details');
      return;
    }

    if (selectedSubcategoryId && !selectedCategoryId) {
      setErrorMsg('Cannot select a subcategory without selecting a category first');
      setActiveTab('details');
      return;
    }

    if (!isEditMode && (!basePrice || numBase <= 0)) {
      setErrorMsg('A valid base price greater than 0 is required');
      setActiveTab('pricing');
      return;
    }

    // Validate Variants
    for (const v of variants) {
      if (!v.name.trim()) {
        setErrorMsg('All variants must have a name');
        setActiveTab('customization');
        return;
      }
    }

    // Validate Modifiers
    for (const g of modifierGroups) {
      if (!g.name.trim()) {
        setErrorMsg('All modifier groups must have a name');
        setActiveTab('customization');
        return;
      }
      for (const o of g.options) {
        if (!o.name.trim()) {
          setErrorMsg(`All options in modifier group "${g.name}" must have a name`);
          setActiveTab('customization');
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim(),
        categoryId: selectedCategoryId,
        subcategoryId: selectedCategoryId ? (selectedSubcategoryId || null) : null,
        foodType: foodType || null,
        station,
        image: imageUrl.trim() || null,
        preparationTime: Number(preparationTime) || 10,
        isAvailable,
        isFeatured,
        isPopular,
        variants: variants.map((v, idx) => ({
          ...(v.id ? { id: v.id } : {}),
          name: v.name.trim(),
          priceDelta: parseFloat(v.priceDelta) || 0,
          sortOrder: idx,
        })),
        modifierGroups: modifierGroups.map((g) => ({
          ...(g.id ? { id: g.id } : {}),
          name: g.name.trim(),
          isRequired: g.isRequired,
          isMulti: g.isMulti,
          options: g.options.map((o, optIdx) => ({
            ...(o.id ? { id: o.id } : {}),
            name: o.name.trim(),
            priceDelta: parseFloat(o.priceDelta) || 0,
            sortOrder: optIdx,
          })),
        })),
      };

      // Only include basePrice and discount fields if Admin
      if (isAdmin) {
        payload.basePrice = numBase;
        payload.discountMode = discountMode;
        payload.discountValue = numDisc;
      }

      payload.gstTaxTagId = selectedGstTaxTagId || null;

      if (isEditMode && itemToEdit) {
        await api.updateMenuItem(itemToEdit.id, payload);
      } else {
        await api.createMenuItem(payload);
      }

      onItemSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save menu item');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => !isSaving && onClose()}
      />

      {/* Slide-over Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-drawer-title"
        className="relative z-10 w-full max-w-2xl bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full overflow-hidden animate-slide-left"
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/70">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-[#D4AF37]">
              {isEditMode ? 'Catalog Management' : 'New Item Creation'}
            </span>
            <h2 id="menu-drawer-title" className="text-base font-black text-zinc-900 dark:text-white">
              {isEditMode ? `Edit Menu Item: ${itemToEdit?.name}` : 'Create New Menu Item'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 px-4 sm:px-6 pt-2 gap-2 overflow-x-auto">
          {[
            { id: 'details', label: '1. Basic Details' },
            { id: 'pricing', label: '2. Pricing & Offers' },
            { id: 'image', label: '3. Product Image' },
            { id: 'customization', label: '4. Variants & Modifiers' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600 dark:border-[#D4AF37] dark:text-[#D4AF37] bg-white dark:bg-zinc-900 shadow-sm'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl text-xs font-bold flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* TAB 1: BASIC DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Truffle Mushroom Risotto, Old Fashioned"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Hierarchy: Category & Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={selectedCategoryId}
                    onChange={(e) => {
                      const newCatId = e.target.value;
                      setSelectedCategoryId(newCatId);
                      setSelectedSubcategoryId('');
                      const foundCat = categories.find((c) => c.id === newCatId);
                      if (foundCat && foundCat.section) {
                        const sSlug = foundCat.section.slug?.toLowerCase();
                        if (sSlug === 'eat') {
                          setStation('KITCHEN');
                        } else if (sSlug === 'drink') {
                          setStation('BAR');
                        } else if (sSlug === 'merchandise') {
                          setStation('CASHIER');
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((cat) => {
                      const secDisplay =
                        cat.section?.slug === 'eat' || cat.section?.name?.toLowerCase() === 'eat'
                          ? 'Food'
                          : cat.section?.name || 'Section';
                      return (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({secDisplay})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                      <span>Subcategory (Optional)</span>
                      {!selectedCategoryId && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                          (Disabled)
                        </span>
                      )}
                    </label>
                    {selectedCategoryId && !isCreatingSubcategory && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingSubcategory(true)}
                        className="text-[11px] font-semibold text-purple-600 dark:text-[#D4AF37] hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        New Subcategory
                      </button>
                    )}
                  </div>

                  {isCreatingSubcategory ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={newSubcategoryName}
                        onChange={(e) => setNewSubcategoryName(e.target.value)}
                        placeholder="New subcategory name..."
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-purple-400 dark:border-[#D4AF37] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateSubcategoryInline();
                          } else if (e.key === 'Escape') {
                            setIsCreatingSubcategory(false);
                            setNewSubcategoryName('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={!newSubcategoryName.trim() || isSubmittingSubcategory}
                        onClick={handleCreateSubcategoryInline}
                        className="px-2.5 py-2 rounded-xl bg-purple-600 dark:bg-[#D4AF37] text-white dark:text-black font-bold text-xs hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      >
                        {isSubmittingSubcategory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Add</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingSubcategory}
                        onClick={() => {
                          setIsCreatingSubcategory(false);
                          setNewSubcategoryName('');
                        }}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedSubcategoryId}
                        onChange={(e) => {
                          if (!selectedCategoryId) return;
                          setSelectedSubcategoryId(e.target.value);
                        }}
                        disabled={!selectedCategoryId}
                        title={!selectedCategoryId ? 'Please select a category first to choose a subcategory' : undefined}
                        className={`w-full px-3 py-2 text-xs rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                          !selectedCategoryId
                            ? 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                            : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-700 cursor-pointer'
                        }`}
                      >
                        <option value="">
                          {!selectedCategoryId
                            ? '-- Select Category First --'
                            : subcategories.length === 0
                            ? '-- None / No Subcategories --'
                            : '-- None / General --'}
                        </option>
                        {selectedCategoryId &&
                          subcategories.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name}
                            </option>
                          ))}
                      </select>
                      {!selectedCategoryId && (
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                          Please select a Category first to enable subcategories.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Station & Food Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Preparation Area
                  </label>
                  <select
                    value={station}
                    onChange={(e) => setStation(e.target.value as Station)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="KITCHEN">Kitchen</option>
                    <option value="BAR">Bar</option>
                    <option value="CASHIER">Front Desk / Cashier</option>
                    {station !== 'KITCHEN' && station !== 'BAR' && station !== 'CASHIER' && (
                      <option value={station}>{station}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Dietary Classification
                  </label>
                  <select
                    value={foodType}
                    onChange={(e) => setFoodType(e.target.value as FoodType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="VEG">Vegetarian (Veg)</option>
                    <option value="NON_VEG">Non-Vegetarian (Non-Veg)</option>
                    <option value="EGG">Contains Egg</option>
                    <option value="VEGAN">Vegan</option>
                  </select>
                </div>
              </div>

              {/* Preparation Time & Description */}
              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Preparation Time (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={preparationTime}
                  onChange={(e) => setPreparationTime(Number(e.target.value))}
                  className="w-32 px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Ingredients, culinary notes, sensory description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Badges / Visibility Toggles */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-zinc-300 focus:ring-purple-500"
                  />
                  In Stock (Available)
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-zinc-300 focus:ring-purple-500"
                  />
                  Featured Item
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={isPopular}
                    onChange={(e) => setIsPopular(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-zinc-300 focus:ring-purple-500"
                  />
                  Bestseller / Popular
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & OFFERS */}
          {activeTab === 'pricing' && (
            <div className="space-y-5">
              {!isAdmin && (
                <div className="p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                  <Lock className="w-4 h-4 shrink-0" />
                  Base Price and Discount configuration are locked to Administrator role.
                </div>
              )}

              {/* Base Price and GST Tax Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Base Price (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-400">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      disabled={!isAdmin}
                      placeholder="0.00"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37] disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    GST Tax Tag *
                  </label>
                  <select
                    disabled={!isAdmin}
                    value={selectedGstTaxTagId}
                    onChange={(e) => setSelectedGstTaxTagId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37] disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:opacity-60"
                  >
                    <option value="">None / Inherit Default</option>
                    {gstTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name} ({(Number(tag.rate) * 100).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Offer / Discount Mode Toggle */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600 dark:text-[#D4AF37]" />
                      Catalog Offer & Discount
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Configure fixed ₹ or percentage % discount displayed across customer menus
                    </p>
                  </div>

                  {/* Mode Switcher */}
                  <div className="flex bg-zinc-200 dark:bg-zinc-700 p-0.5 rounded-lg">
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => setDiscountMode('AMOUNT')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                        discountMode === 'AMOUNT'
                          ? 'bg-purple-600 text-white dark:bg-[#D4AF37] dark:text-zinc-950 shadow-sm'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                      }`}
                    >
                      ₹ Amount
                    </button>
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => setDiscountMode('PERCENTAGE')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                        discountMode === 'PERCENTAGE'
                          ? 'bg-purple-600 text-white dark:bg-[#D4AF37] dark:text-zinc-950 shadow-sm'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                      }`}
                    >
                      % Percentage
                    </button>
                  </div>
                </div>

                {/* Discount Value Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                      {discountMode === 'AMOUNT' ? 'Discount Amount (₹)' : 'Discount Rate (%)'}
                    </label>
                    <div className="relative w-44">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-400">
                        {discountMode === 'AMOUNT' ? '₹' : '%'}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max={discountMode === 'PERCENTAGE' ? 100 : numBase || undefined}
                        step="0.01"
                        disabled={!isAdmin}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37] disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Synchronized Equivalent Math Preview */}
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Equivalent Savings
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-black text-purple-600 dark:text-[#D4AF37]">
                        Save ₹{savingsAmount.toFixed(2)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        ({savingsPercent}% OFF)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Final Net Price Banner */}
                <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-[#D4AF37]/10 border border-purple-200 dark:border-[#D4AF37]/30 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-purple-900 dark:text-white block">
                      Customer Net Price
                    </span>
                    <span className="text-[10px] text-purple-700 dark:text-zinc-300">
                      Authoritative base price charged in orders and billing
                    </span>
                  </div>
                  <div className="text-right">
                    {savingsAmount > 0 && (
                      <span className="text-xs text-zinc-400 line-through mr-2">
                        ₹{numBase.toFixed(2)}
                      </span>
                    )}
                    <span className="text-lg font-black text-purple-700 dark:text-[#D4AF37]">
                      ₹{finalNetPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRODUCT IMAGE */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-4 pb-2">
                <button
                  type="button"
                  onClick={() => setImageTab('upload')}
                  className={`text-xs font-bold pb-1 transition-colors cursor-pointer ${
                    imageTab === 'upload'
                      ? 'border-b-2 border-purple-600 text-purple-600 dark:border-[#D4AF37] dark:text-[#D4AF37]'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  Upload Local File
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab('url')}
                  className={`text-xs font-bold pb-1 transition-colors cursor-pointer ${
                    imageTab === 'url'
                      ? 'border-b-2 border-purple-600 text-purple-600 dark:border-[#D4AF37] dark:text-[#D4AF37]'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  External Image URL
                </button>
              </div>

              {imageTab === 'upload' ? (
                <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center hover:border-purple-400 dark:hover:border-[#D4AF37]/50 transition-colors">
                  <input
                    type="file"
                    id="menu-item-image-file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="menu-item-image-file"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-[#D4AF37]/15 text-purple-600 dark:text-[#D4AF37] flex items-center justify-center">
                      {isUploadingImage ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <UploadCloud className="w-6 h-6" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {isUploadingImage ? 'Uploading image...' : 'Click to select or drop image'}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      PNG, JPG, WEBP up to 5MB (stored securely in static uploads / S3)
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                    Direct Image URL (HTTPS)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      onClick={handleAutoPasteImageUrl}
                      onFocus={handleAutoPasteImageUrl}
                      className="flex-1 min-w-0 px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={handleSearchImage}
                      title="Search product image"
                      aria-label="Search product image"
                      className="shrink-0 px-3 py-2 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-[#D4AF37] dark:hover:border-[#D4AF37]/50 transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Search Image</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Image Live Preview */}
              {imageUrl && (
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 border border-zinc-200 dark:border-zinc-700">
                    <img
                      src={formatImageUrl(imageUrl)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://placehold.co/100x100?text=Invalid+Image';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block truncate">
                      {imageUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="mt-2 text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Image
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VARIANTS & MODIFIERS */}
          {activeTab === 'customization' && (
            <div className="space-y-6">
              {/* Variants Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                      Item Portions & Variants
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Options such as Half / Full, 30ml / 60ml with specific price adjustments
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="py-1.5 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-purple-600 dark:text-[#D4AF37] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Portion
                  </button>
                </div>

                {variants.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                    No portion variants added (item will be served in standard size).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {variants.map((v, idx) => (
                      <div
                        key={v.id || idx}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 flex items-center gap-3"
                      >
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                            Portion Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 60ml, Full Plate"
                            value={v.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setVariants((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                              );
                            }}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div className="w-32">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                            Price Delta (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="+0.00"
                            value={v.priceDelta}
                            onChange={(e) => {
                              const val = e.target.value;
                              setVariants((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, priceDelta: val } : item))
                              );
                            }}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(idx)}
                          className="p-2 text-zinc-400 hover:text-rose-600 transition-colors mt-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modifier Groups Section */}
              <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                      Customization Modifier Groups
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Add choices like Spice Level, Mixer Option, Extra Cheese, etc.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddModifierGroup}
                    className="py-1.5 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-purple-600 dark:text-[#D4AF37] font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Group
                  </button>
                </div>

                {modifierGroups.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                    No modifier groups configured for this item.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {modifierGroups.map((g, gIdx) => (
                      <div
                        key={g.id || gIdx}
                        className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/20 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="text"
                            placeholder="Group Name (e.g. Spice Level, Mixer)"
                            value={g.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setModifierGroups((prev) =>
                                prev.map((grp, i) => (i === gIdx ? { ...grp, name: val } : grp))
                              );
                            }}
                            className="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                          />

                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              <input
                                type="checkbox"
                                checked={g.isRequired}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  setModifierGroups((prev) =>
                                    prev.map((grp, i) => (i === gIdx ? { ...grp, isRequired: val } : grp))
                                  );
                                }}
                                className="w-3.5 h-3.5 text-purple-600 dark:text-[#D4AF37] focus:ring-purple-500 dark:focus:ring-[#D4AF37] rounded"
                              />
                              Required
                            </label>
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              <input
                                type="checkbox"
                                checked={g.isMulti}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  setModifierGroups((prev) =>
                                    prev.map((grp, i) => (i === gIdx ? { ...grp, isMulti: val } : grp))
                                  );
                                }}
                                className="w-3.5 h-3.5 text-purple-600 dark:text-[#D4AF37] focus:ring-purple-500 dark:focus:ring-[#D4AF37] rounded"
                              />
                              Multi-select
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveModifierGroup(gIdx)}
                              className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Options List */}
                        <div className="space-y-2 pl-3 border-l-2 border-purple-400 dark:border-[#D4AF37]/40">
                          {g.options.map((opt, oIdx) => (
                            <div key={opt.id || oIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Option name (e.g. Tonic, Soda, Mild)"
                                value={opt.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setModifierGroups((prev) =>
                                    prev.map((grp, i) =>
                                      i === gIdx
                                        ? {
                                            ...grp,
                                            options: grp.options.map((o, oi) =>
                                              oi === oIdx ? { ...o, name: val } : o
                                            ),
                                          }
                                        : grp
                                    )
                                  );
                                }}
                                className="flex-1 px-3 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                              />
                              <div className="w-28">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="+₹0.00"
                                  value={opt.priceDelta}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setModifierGroups((prev) =>
                                      prev.map((grp, i) =>
                                        i === gIdx
                                          ? {
                                              ...grp,
                                              options: grp.options.map((o, oi) =>
                                                oi === oIdx ? { ...o, priceDelta: val } : o
                                              ),
                                            }
                                          : grp
                                      )
                                    );
                                  }}
                                  className="w-full px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37] font-bold"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveOptionFromGroup(gIdx, oIdx)}
                                className="p-1 text-zinc-400 hover:text-rose-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => handleAddOptionToGroup(gIdx)}
                            className="text-[11px] font-bold text-purple-600 dark:text-[#D4AF37] hover:underline flex items-center gap-1 pt-1"
                          >
                            <Plus className="w-3 h-3" /> Add Option
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3 sticky bottom-0 bg-white dark:bg-zinc-900 py-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-zinc-950 font-black text-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEditMode ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default MenuItemDrawer;
