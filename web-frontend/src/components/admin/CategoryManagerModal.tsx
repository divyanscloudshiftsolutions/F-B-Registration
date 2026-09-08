import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { MenuSection, MenuCategory, MenuSubcategory } from '../../types';
import { X, Plus, FolderPlus, Layers, Loader2, Check, AlertCircle, Pencil, Trash2 } from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreatedOrUpdated: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoryCreatedOrUpdated,
}) => {
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Category State
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatDesc, setNewCatDesc] = useState<string>('');
  const [newCatSortOrder, setNewCatSortOrder] = useState<number>(1);

  // New Subcategory State
  const [targetCatIdForSub, setTargetCatIdForSub] = useState<string>('');
  const [newSubName, setNewSubName] = useState<string>('');

  // Category Inline Rename State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>('');
  const [isRenamingCat, setIsRenamingCat] = useState<boolean>(false);

  // Subcategory Inline Rename State
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState<string>('');
  const [isRenamingSub, setIsRenamingSub] = useState<boolean>(false);

  const [allProducts, setAllProducts] = useState<any[]>([]);

  // Delete Confirmation Dialog State
  const [deletingItem, setDeletingItem] = useState<{
    type: 'category' | 'subcategory';
    id: string;
    name: string;
    parentCategoryName?: string;
    productCount: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [secs, cats, fullMenu] = await Promise.all([
        api.getSections(),
        api.getCategories(),
        api.getMenu(true),
      ]);
      setSections(secs);
      setCategories(cats);
      if (secs.length > 0 && !selectedSectionId) {
        setSelectedSectionId(secs[0].id);
      }
      const prods: any[] = [];
      (fullMenu || []).forEach((sec: any) => {
        (sec.categories || []).forEach((c: any) => {
          (c.items || []).forEach((it: any) => {
            prods.push(it);
          });
        });
        (sec.items || []).forEach((it: any) => {
          prods.push(it);
        });
      });
      setAllProducts(prods);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load categories' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !selectedSectionId) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      await api.createCategory({
        name: newCatName.trim(),
        sectionId: selectedSectionId,
        description: newCatDesc.trim() || undefined,
        sortOrder: Number(newCatSortOrder) || 1,
      });
      setNewCatName('');
      setNewCatDesc('');
      setFeedback({ type: 'success', message: 'Category created successfully!' });
      await loadData();
      onCategoryCreatedOrUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create category' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !targetCatIdForSub) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      await api.createSubcategory({
        name: newSubName.trim(),
        categoryId: targetCatIdForSub,
      });
      setNewSubName('');
      setFeedback({ type: 'success', message: 'Subcategory created successfully!' });
      await loadData();
      onCategoryCreatedOrUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create subcategory' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Category Inline Rename Handlers
  const handleStartRenameCat = (cat: MenuCategory) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingSubId(null);
  };

  const handleCancelRenameCat = () => {
    setEditingCatId(null);
    setEditingCatName('');
  };

  const handleSaveRenameCat = async (catId: string) => {
    const trimmed = editingCatName.trim();
    if (!trimmed || isRenamingCat) return;

    setIsRenamingCat(true);
    setFeedback(null);
    try {
      await api.updateCategory(catId, { name: trimmed });
      setFeedback({ type: 'success', message: `Category renamed to "${trimmed}"` });
      setEditingCatId(null);
      await loadData();
      onCategoryCreatedOrUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to rename category' });
    } finally {
      setIsRenamingCat(false);
    }
  };

  // Subcategory Inline Rename Handlers
  const handleStartRenameSub = (sub: MenuSubcategory) => {
    setEditingSubId(sub.id);
    setEditingSubName(sub.name);
    setEditingCatId(null);
  };

  const handleCancelRenameSub = () => {
    setEditingSubId(null);
    setEditingSubName('');
  };

  const handleSaveRenameSub = async (subId: string) => {
    const trimmed = editingSubName.trim();
    if (!trimmed || isRenamingSub) return;

    setIsRenamingSub(true);
    setFeedback(null);
    try {
      await api.updateSubcategory(subId, { name: trimmed });
      setFeedback({ type: 'success', message: `Subcategory renamed to "${trimmed}"` });
      setEditingSubId(null);
      await loadData();
      onCategoryCreatedOrUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to rename subcategory' });
    } finally {
      setIsRenamingSub(false);
    }
  };

  // Delete Action Handler (Category or Subcategory)
  const handleConfirmDelete = async () => {
    if (!deletingItem || isDeleting) return;

    setIsDeleting(true);
    setFeedback(null);
    try {
      if (deletingItem.type === 'category') {
        const res = await api.deleteCategory(deletingItem.id);
        setFeedback({ type: 'success', message: res.message || `Category "${deletingItem.name}" deleted successfully!` });
      } else {
        const res = await api.deleteSubcategory(deletingItem.id);
        setFeedback({ type: 'success', message: res.message || `Subcategory "${deletingItem.name}" deleted successfully!` });
      }
      setDeletingItem(null);
      await loadData();
      onCategoryCreatedOrUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const currentSectionCats = categories.filter((c) => c.sectionId === selectedSectionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-[#D4AF37]/10 text-purple-600 dark:text-[#D4AF37] flex items-center justify-center border border-purple-200 dark:border-[#D4AF37]/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="category-modal-title" className="text-base font-black text-zinc-900 dark:text-white">Menu Categories & Subcategories</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Maintain the 4-level catalog hierarchy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
              }`}
            >
              {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedback.message}
            </div>
          )}

          {/* Section Selector Tabs */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
              1. Menu Section
            </label>
            <div className="flex flex-wrap gap-2">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    setSelectedSectionId(sec.id);
                    setTargetCatIdForSub('');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    selectedSectionId === sec.id
                      ? 'bg-purple-600 text-white dark:bg-[#D4AF37] dark:text-zinc-950 shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {sec.slug === 'eat' || sec.name.toLowerCase() === 'eat' ? 'Food' : sec.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create New Category Form */}
            <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-purple-600 dark:text-[#D4AF37]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                  New Category
                </h3>
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Starters, Signature Cocktails"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description for customer view"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={newCatSortOrder}
                    onChange={(e) => setNewCatSortOrder(Number(e.target.value))}
                    className="w-24 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !newCatName.trim()}
                  className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create Category
                </button>
              </form>
            </div>

            {/* Create New Subcategory Form */}
            <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-600 dark:text-[#D4AF37]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                  New Subcategory
                </h3>
              </div>

              <form onSubmit={handleCreateSubcategory} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                    Parent Category *
                  </label>
                  <select
                    required
                    value={targetCatIdForSub}
                    onChange={(e) => setTargetCatIdForSub(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                  >
                    <option value="">-- Select Category --</option>
                    {currentSectionCats.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                    Subcategory Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vegetarian, Single Malts, Gin"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !newSubName.trim() || !targetCatIdForSub}
                  className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 mt-8"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create Subcategory
                </button>
              </form>
            </div>
          </div>

          {/* Current Hierarchy Tree for Selected Section */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Existing Categories & Subcategories ({currentSectionCats.length})
            </h3>

            {isLoading ? (
              <div className="py-8 text-center text-zinc-400 text-xs">Loading categories...</div>
            ) : currentSectionCats.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 text-xs">
                No categories created for this section yet.
              </div>
            ) : (
              <div className="space-y-2">
                {currentSectionCats.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      {editingCatId === cat.id ? (
                        <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                          <input
                            type="text"
                            autoFocus
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveRenameCat(cat.id);
                              } else if (e.key === 'Escape') {
                                handleCancelRenameCat();
                              }
                            }}
                            disabled={isRenamingCat}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-purple-400 dark:border-[#D4AF37] bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 w-full"
                          />
                          <button
                            type="button"
                            disabled={isRenamingCat || !editingCatName.trim()}
                            onClick={() => handleSaveRenameCat(cat.id)}
                            title="Save name"
                            className="p-1 rounded-lg bg-purple-600 dark:bg-[#D4AF37] text-white dark:text-zinc-950 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {isRenamingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            disabled={isRenamingCat}
                            onClick={handleCancelRenameCat}
                            title="Cancel"
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-zinc-900 dark:text-white">{cat.name}</span>
                          {cat.description && (
                            <span className="text-[11px] text-zinc-400">({cat.description})</span>
                          )}
                          <div className="flex items-center gap-0.5 ml-1">
                            <button
                              type="button"
                              onClick={() => handleStartRenameCat(cat)}
                              title="Rename Category"
                              className="p-1 rounded-md text-zinc-400 hover:text-purple-600 dark:hover:text-[#D4AF37] hover:bg-purple-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const count = allProducts.filter((p) => p.categoryId === cat.id).length;
                                setDeletingItem({ type: 'category', id: cat.id, name: cat.name, productCount: count });
                              }}
                              title="Delete Category"
                              className="p-1 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Subcategories list */}
                    {cat.subcategories && cat.subcategories.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-3 border-l-2 border-purple-300 dark:border-[#D4AF37]/40 items-center">
                        {cat.subcategories.map((sub) => (
                          editingSubId === sub.id ? (
                            <div
                              key={sub.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-zinc-800 border border-purple-400 dark:border-[#D4AF37]"
                            >
                              <span className="text-[10px] text-zinc-400">↳</span>
                              <input
                                type="text"
                                autoFocus
                                value={editingSubName}
                                onChange={(e) => setEditingSubName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveRenameSub(sub.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelRenameSub();
                                  }
                                }}
                                disabled={isRenamingSub}
                                className="w-24 text-[11px] font-medium bg-transparent text-zinc-900 dark:text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={isRenamingSub || !editingSubName.trim()}
                                onClick={() => handleSaveRenameSub(sub.id)}
                                title="Save name"
                                className="p-0.5 rounded text-purple-600 dark:text-[#D4AF37] hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50"
                              >
                                {isRenamingSub ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                              </button>
                              <button
                                type="button"
                                disabled={isRenamingSub}
                                onClick={handleCancelRenameSub}
                                title="Cancel"
                                className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <span
                              key={sub.id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                            >
                              <span>↳ {sub.name}</span>
                              <span className="inline-flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                              type="button"
                              onClick={() => handleStartRenameSub(sub)}
                              title="Rename Subcategory"
                              className="p-0.5 rounded text-zinc-400 hover:text-purple-600 dark:hover:text-[#D4AF37] transition-colors cursor-pointer"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const count = allProducts.filter((p) => p.subcategoryId === sub.id).length;
                                setDeletingItem({ type: 'subcategory', id: sub.id, name: sub.name, parentCategoryName: cat.name, productCount: count });
                              }}
                              title="Delete Subcategory"
                              className="p-0.5 rounded text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                              </span>
                            </span>
                          )
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-400 italic mt-1 pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                        No subcategories
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog (Rendered with z-[70] above category manager modal) */}
      {deletingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-cat-dialog-title"
          aria-describedby="delete-cat-dialog-desc"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
              <Trash2 className="w-5 h-5" />
            </div>

            <div>
              <h3 id="delete-cat-dialog-title" className="text-base font-black text-zinc-900 dark:text-white">
                Delete {deletingItem.type === 'category' ? 'Category' : 'Subcategory'}?
              </h3>
              <div id="delete-cat-dialog-desc">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Are you sure you want to delete <strong className="text-zinc-900 dark:text-white font-bold">{deletingItem.name}</strong>?
                </p>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3.5 rounded-xl space-y-1.5">
                  <p className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>
                      {deletingItem.productCount} {deletingItem.productCount === 1 ? 'product' : 'products'} currently assigned
                    </span>
                  </p>
                  {deletingItem.type === 'category' ? (
                    <>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        Deleting this Category will remove the category and child subcategories. <strong>Products themselves will NEVER be deleted</strong> — all {deletingItem.productCount} {deletingItem.productCount === 1 ? 'product' : 'products'} will be preserved and remain accessible under <strong>All Dishes</strong>.
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        You can reassign these products to another Category or Subcategory at any time.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        Deleting this Subcategory removes the subcategory assignment. <strong>Products themselves will NEVER be deleted</strong> — all {deletingItem.productCount} {deletingItem.productCount === 1 ? 'product' : 'products'} will remain safely preserved in <strong>{deletingItem.parentCategoryName || 'the parent category'}</strong> and under <strong>All Dishes</strong>.
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        You can reassign these products to another Subcategory at any time.
                      </p>
                    </>
                  )}
                </div>
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
                onClick={handleConfirmDelete}
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
export default CategoryManagerModal;
