import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { MenuSection, MenuCategory } from '../../types';
import { X, Plus, FolderPlus, Layers, Loader2, Check, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [secs, cats] = await Promise.all([api.getSections(), api.getCategories()]);
      setSections(secs);
      setCategories(cats);
      if (secs.length > 0 && !selectedSectionId) {
        setSelectedSectionId(secs[0].id);
      }
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
                  {sec.name}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-zinc-900 dark:text-white">{cat.name}</span>
                        {cat.description && (
                          <span className="text-[11px] text-zinc-400">({cat.description})</span>
                        )}
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        Sort: {cat.sortOrder}
                      </span>
                    </div>

                    {/* Subcategories list */}
                    {cat.subcategories && cat.subcategories.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-3 border-l-2 border-purple-300 dark:border-[#D4AF37]/40">
                        {cat.subcategories.map((sub) => (
                          <span
                            key={sub.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                          >
                            ↳ {sub.name}
                          </span>
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
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
export default CategoryManagerModal;
