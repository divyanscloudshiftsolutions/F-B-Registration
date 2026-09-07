import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import type { GstTaxTag, MenuItem } from '../../types';
import {
  X,
  Plus,
  ArrowRight,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  Loader2,
  Tag,
  Check,
  Percent,
  Receipt,
  Save,
  Trash2,
  Info,
} from 'lucide-react';

interface GstManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignmentsUpdated?: () => void;
}

interface NewTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (tag: GstTaxTag) => void;
  existingTags: GstTaxTag[];
}

const NewTagModal: React.FC<NewTagModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  existingTags,
}) => {
  const [name, setName] = useState('');
  const [percentRate, setPercentRate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(percentRate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setError('Please enter a valid rate between 0 and 100%');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a tag name (e.g., 7% GST)');
      return;
    }

    // Normalized rate fraction comparison for uniqueness
    const normalizedRate = rateNum / 100;
    const canonicalRate = parseFloat(normalizedRate.toFixed(4));
    const isDuplicate = existingTags.some((t) => {
      const tagRate = Number(t.rate);
      return (
        Math.abs(tagRate - normalizedRate) < 0.00001 ||
        parseFloat(tagRate.toFixed(4)) === canonicalRate
      );
    });

    if (isDuplicate) {
      setError('This GST percentage already exists.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await api.createGstTaxTag({
        name: name.trim(),
        rate: normalizedRate,
      });
      onCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create GST Tax Tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <Tag className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-white">Create New GST Tax Tag</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-xs font-semibold bg-rose-950/40 border border-rose-800/40 text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1">
              Tag Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 7% GST, 12% GST, Luxury Tax"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1">
              Effective Tax Rate (%) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                placeholder="7.00"
                value={percentRate}
                onChange={(e) => setPercentRate(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-xs font-bold rounded-xl border border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
              <span className="absolute right-3 top-2.5 text-xs font-bold text-zinc-400">%</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-black bg-[#D4AF37] hover:bg-[#c49f30] text-zinc-950 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Tag
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const GstManagementModal: React.FC<GstManagementModalProps> = ({
  isOpen,
  onClose,
  onAssignmentsUpdated,
}) => {
  const [tags, setTags] = useState<GstTaxTag[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | string>('ALL');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isNewTagModalOpen, setIsNewTagModalOpen] = useState(false);

  // Bulk Move Confirmation Dialog State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Tag Deletion Confirmation Dialog State
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeletingTag, setIsDeletingTag] = useState(false);

  // Deletion Result Popup State
  const [showDeleteResultModal, setShowDeleteResultModal] = useState(false);
  const [deleteResultData, setDeleteResultData] = useState<{
    tagName: string;
    rate: string;
    affectedCount: number;
    fallbackTagName: string;
  } | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Venue Charge Configuration States
  const [scEnabled, setScEnabled] = useState<boolean>(true);
  const [scPercent, setScPercent] = useState<number>(5);
  const [roundingEnabled, setRoundingEnabled] = useState<boolean>(true);
  const [isSavingCharges, setIsSavingCharges] = useState<boolean>(false);

  const confirmYesBtnRef = useRef<HTMLButtonElement>(null);
  const deleteConfirmBtnRef = useRef<HTMLButtonElement>(null);
  const deleteResultOkBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedTags, assignments, billingCfg] = await Promise.all([
        api.getGstTaxTags(),
        api.getGstAssignments(),
        api.getBillingConfig().catch(() => null),
      ]);
      setTags(fetchedTags);
      setAllItems(assignments);

      if (billingCfg) {
        setScEnabled(billingCfg.scEnabled ?? true);
        setScPercent(Number(billingCfg.scRate || 0.05) * 100);
        setRoundingEnabled(billingCfg.roundingEnabled ?? true);
      }

      if (fetchedTags.length > 0) {
        if (!selectedTagId || !fetchedTags.some((t) => t.id === selectedTagId)) {
          const defaultTag = fetchedTags.find((t) => t.name === '5% GST') || fetchedTags[0];
          setSelectedTagId(defaultTag.id);
        }
      }
      setSelectedItemIds(new Set());
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load GST tax assignments and charges' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCharges = async () => {
    setIsSavingCharges(true);
    try {
      await api.updateBillingConfig({
        scEnabled,
        scRate: Number(scPercent) / 100,
        roundingEnabled,
      });
      setFeedback({ type: 'success', message: 'Service charge & cash rounding settings saved successfully!' });
      if (onAssignmentsUpdated) {
        onAssignmentsUpdated();
      }
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save charge settings' });
    } finally {
      setIsSavingCharges(false);
    }
  };

  // Keyboard navigation for Bulk Move Confirmation Dialog
  useEffect(() => {
    if (!showConfirmModal) return;
    const timer = setTimeout(() => {
      confirmYesBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowConfirmModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showConfirmModal]);

  // Keyboard navigation for Tag Deletion Confirmation Dialog
  useEffect(() => {
    if (!showDeleteConfirmModal) return;
    const timer = setTimeout(() => {
      deleteConfirmBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDeleteConfirmModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDeleteConfirmModal]);

  // Keyboard navigation for Deletion Result Popup
  useEffect(() => {
    if (!showDeleteResultModal) return;
    const timer = setTimeout(() => {
      deleteResultOkBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        setShowDeleteResultModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDeleteResultModal]);

  const currentTag = tags.find((t) => t.id === selectedTagId);
  const targetTagRate = currentTag ? (Number(currentTag.rate) * 100).toFixed(0) : '0';
  const isNoGst =
    !currentTag ||
    Number(currentTag.rate) === 0 ||
    currentTag.name.trim().toLowerCase() === 'no gst';

  // Authoritative actual product assignment count for a given GST tag
  const getTagAssignmentCount = (tagId: string) => {
    return allItems.filter((i) => (i.gstTaxTagId || i.gstTaxTag?.id) === tagId).length;
  };

  // Authoritative total assignable products count for the 'All' tab (catalog items outside target tag)
  const getAllAssignableCount = () => {
    return allItems.filter((i) => (i.gstTaxTagId || i.gstTaxTag?.id) !== selectedTagId).length;
  };

  // Target tag switching handler: selects target tag on the right side, clears search, resets selection
  // and resets sourceFilter to 'ALL' if it was pointing to the new target tag
  const handleSwitchTargetTag = (tagId: string) => {
    setSelectedTagId(tagId);
    setSearchQuery('');
    setSelectedItemIds(new Set());
    if (sourceFilter === tagId) {
      setSourceFilter('ALL');
    }
  };

  // Source filter switching handler: selects source filter tab on the left side, clears search, and resets selection
  // MUST NEVER change selectedTagId (targetTagId)
  const handleSelectSourceFilter = (newSourceFilter: 'ALL' | string) => {
    setSourceFilter(newSourceFilter);
    setSearchQuery('');
    setSelectedItemIds(new Set());
  };

  // Visible source tabs: all tags EXCEPT the currently selected targetTagId
  const visibleSourceTags = useMemo(() => {
    return tags.filter((t) => t.id !== selectedTagId);
  }, [tags, selectedTagId]);

  // Partition items into Target Tag (Right)
  const itemsInTarget = useMemo(() => {
    return allItems.filter(
      (i) => (i.gstTaxTagId || i.gstTaxTag?.id) === selectedTagId
    );
  }, [allItems, selectedTagId]);

  // Available source items for the left panel before search:
  // - If sourceFilter === 'ALL' or matches targetTag: all items in catalog EXCEPT those already assigned to selectedTagId
  // - If sourceFilter is a specific tagId: only items assigned to that specific tagId
  const availableSourceItems = useMemo(() => {
    if (sourceFilter === 'ALL' || sourceFilter === selectedTagId) {
      return allItems.filter((i) => (i.gstTaxTagId || i.gstTaxTag?.id) !== selectedTagId);
    }
    return allItems.filter((i) => (i.gstTaxTagId || i.gstTaxTag?.id) === sourceFilter);
  }, [allItems, selectedTagId, sourceFilter]);

  // Filter available source items based on search query across current source context:
  const filteredOutsideItems = useMemo(() => {
    if (!searchQuery.trim()) return availableSourceItems;
    const q = searchQuery.toLowerCase().trim();
    const normalizedQ = q.replace(/[-_]/g, ' ');

    return availableSourceItems.filter((i) => {
      const itemTagId = i.gstTaxTagId || i.gstTaxTag?.id;
      const itemTag = tags.find((t) => t.id === itemTagId) || i.gstTaxTag;
      const rawTagName = itemTag?.name ? itemTag.name : (itemTagId ? 'GST Tag' : 'No GST');
      const tagName = rawTagName.toLowerCase();
      const normalizedTagName = tagName.replace(/[-_]/g, ' ');

      const rateVal = itemTag?.rate !== undefined ? Number(itemTag.rate) : 0;
      const ratePct = `${(rateVal * 100).toFixed(0)}%`;
      const ratePctWithGst = `${ratePct} gst`;
      const rateNumStr = `${(rateVal * 100).toFixed(0)}`;

      const matchesProductName = i.name.toLowerCase().includes(q);
      const matchesCategory = i.category?.name ? i.category.name.toLowerCase().includes(q) : false;
      const matchesTagName =
        tagName.includes(q) ||
        normalizedTagName.includes(normalizedQ);
      const matchesTagRate =
        ratePct.includes(q) ||
        ratePctWithGst.includes(q) ||
        (q.length > 0 && rateNumStr === q);

      return matchesProductName || matchesCategory || matchesTagName || matchesTagRate;
    });
  }, [availableSourceItems, searchQuery, tags]);

  // Checkbox helpers
  const handleToggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredOutsideItems.map((i) => i.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedItemIds.has(id));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Trigger bulk confirm
  const handleInitiateMove = () => {
    if (selectedItemIds.size === 0 || !selectedTagId) return;
    setShowConfirmModal(true);
  };

  // Perform bulk assignment transaction
  const handleExecuteMove = async () => {
    if (selectedItemIds.size === 0 || !selectedTagId) return;
    setIsAssigning(true);
    setShowConfirmModal(false);
    try {
      const itemIdsArray = Array.from(selectedItemIds);
      const res = await api.bulkAssignGstTaxTag(selectedTagId, itemIdsArray);
      const targetTagObj = tags.find((t) => t.id === selectedTagId) || res.targetTag || currentTag;

      setFeedback({
        type: 'success',
        message: `Successfully updated ${res.count} products to ${targetTagObj?.name || 'Target Tag'}!`,
      });

      // Update local state instantaneously without page reload
      setAllItems((prev) =>
        prev.map((item) =>
          selectedItemIds.has(item.id)
            ? {
                ...item,
                gstTaxTagId: targetTagObj?.id || selectedTagId,
                gstTaxTag: targetTagObj,
              }
            : item
        )
      );
      setSelectedItemIds(new Set());

      if (onAssignmentsUpdated) {
        onAssignmentsUpdated();
      }
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to move products' });
    } finally {
      setIsAssigning(false);
    }
  };


  // Delete GST Tag Execution
  const handleExecuteDeleteTag = async () => {
    if (!selectedTagId || isNoGst) return;
    setIsDeletingTag(true);
    try {
      const res = await api.deleteGstTaxTag(selectedTagId);
      const deletedTag = currentTag;

      // Remove deleted tag and reassign products locally
      setTags((prev) => prev.filter((t) => t.id !== selectedTagId));
      setAllItems((prev) =>
        prev.map((item) =>
          item.gstTaxTagId === selectedTagId
            ? {
                ...item,
                gstTaxTagId: res.fallbackTag.id,
                gstTaxTag: res.fallbackTag,
              }
            : item
        )
      );

      // Automatically point to fallback tag
      setSelectedTagId(res.fallbackTag.id);
      setSourceFilter('ALL');
      setSelectedItemIds(new Set());
      setSearchQuery('');

      setShowDeleteConfirmModal(false);

      // Open Deletion Result Popup
      setDeleteResultData({
        tagName: deletedTag?.name || 'GST Tag',
        rate: targetTagRate,
        affectedCount: res.affectedProductsCount,
        fallbackTagName: res.fallbackTag.name || 'No GST',
      });
      setShowDeleteResultModal(true);

      if (onAssignmentsUpdated) {
        onAssignmentsUpdated();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete GST Tax Tag' });
      setShowDeleteConfirmModal(false);
      await loadData();
    } finally {
      setIsDeletingTag(false);
    }
  };

  // Items staged to be moved
  const stagedItems = allItems.filter((i) => selectedItemIds.has(i.id));

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-6xl w-[96vw] shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">GST and Charges</h2>
              <p className="text-xs text-zinc-400">
                Dynamic GST tax brackets, hospitality service charge, and commercial cash rounding
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                : 'bg-rose-950/40 border-rose-800/40 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {feedback.message}
          </div>
        )}

        {/* Modal Scrollable Body */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
            Loading GST tax brackets, service charges & menu products...
          </div>
        ) : (
          <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-6 min-h-0">
            {/* SECTION 1: GST TAX TAGS MANAGEMENT */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    GST Tax Tags
                  </h3>
                </div>
                <span className="text-[11px] text-zinc-400">
                  Select a target GST tax tag and bulk-move products into that GST assignment
                </span>
              </div>

              {/* Two-Panel Body (Desktop: Strict Horizontal LEFT -> RIGHT Side-by-Side) */}
              <div className="h-[440px] flex flex-col md:flex-row items-stretch gap-4">
                {/* LEFT PANEL: Available Products (Outside Target Tag) */}
                <div className="flex-1 min-w-0 flex flex-col bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">
                        Available Products
                      </h3>
                      <span className="text-[11px] text-zinc-400">
                        {searchQuery.trim()
                          ? `${filteredOutsideItems.length} matching search`
                          : `${availableSourceItems.length} products available to assign to ${currentTag?.name || 'Target GST'}`}
                      </span>
                    </div>
                  </div>

                  {/* Left-Side Source Filter Tabs (All + Visible GST Tag Tabs, Target strictly excluded) */}
                  <div className="mb-2.5 shrink-0">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                      {/* 'All' Tab */}
                      <button
                        key="source-filter-all"
                        type="button"
                        onClick={() => handleSelectSourceFilter('ALL')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          sourceFilter === 'ALL'
                            ? 'bg-[#D4AF37] text-zinc-950 border-[#D4AF37] shadow-md shadow-[#D4AF37]/20 font-black'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                        }`}
                      >
                        <span>All</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                            sourceFilter === 'ALL' ? 'bg-zinc-950 text-[#D4AF37]' : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {getAllAssignableCount()}
                        </span>
                      </button>

                      {/* GST Tag Tabs (Target Tag is strictly excluded from source selection) */}
                      {visibleSourceTags.map((tag) => {
                        const isSourceActive = sourceFilter === tag.id;
                        const actualAssignedCount = getTagAssignmentCount(tag.id);

                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleSelectSourceFilter(tag.id)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                              isSourceActive
                                ? 'bg-[#D4AF37] text-zinc-950 border-[#D4AF37] shadow-md shadow-[#D4AF37]/20 font-black'
                                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                            }`}
                          >
                            <span>{tag.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                isSourceActive ? 'bg-zinc-950 text-[#D4AF37]' : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {actualAssignedCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Search input (Available Products Search) */}
                  <div className="relative mb-2 shrink-0">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      aria-label="Search available products by name, category, or GST tag"
                      placeholder={`Search products or GST tags to assign to ${currentTag?.name || 'Target GST'}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Select All Toggle Bar */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 mb-2 bg-zinc-900/80 rounded-lg border border-zinc-800/80 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      disabled={filteredOutsideItems.length === 0}
                      className="flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                    >
                      {filteredOutsideItems.length > 0 &&
                      filteredOutsideItems.every((i) => selectedItemIds.has(i.id)) ? (
                        <CheckSquare className="w-4 h-4 text-[#D4AF37]" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-500" />
                      )}
                      <span>Select All</span>
                    </button>
                    <span className="text-[11px] font-semibold text-zinc-400">
                      {selectedItemIds.size} of {filteredOutsideItems.length} selected
                    </span>
                  </div>

                  {/* Product Checklist */}
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {filteredOutsideItems.length === 0 ? (
                      <div className="text-center py-10 text-zinc-500 text-xs px-4">
                        {searchQuery.trim() ? (
                          <span>
                            No products matching <strong className="text-zinc-300 font-bold">"{searchQuery}"</strong> available to assign to {currentTag?.name || 'Target GST'}.
                          </span>
                        ) : (
                          <span>No products available to assign to {currentTag?.name || 'Target GST'}. All products may already be assigned to this tag.</span>
                        )}
                      </div>
                    ) : (
                      filteredOutsideItems.map((item) => {
                        const isSelected = selectedItemIds.has(item.id);
                        const itemTagId = item.gstTaxTagId || item.gstTaxTag?.id;
                        const itemTag = tags.find((t) => t.id === itemTagId) || item.gstTaxTag;
                        const tagLabel = itemTag ? itemTag.name : 'No GST';

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleItem(item.id)}
                            className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-white'
                                : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <button
                                type="button"
                                aria-label={`Select ${item.name}`}
                                className="text-zinc-400 hover:text-white"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-[#D4AF37]" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-500" />
                                )}
                              </button>
                              <div className="truncate">
                                <span className="text-xs font-bold block truncate">{item.name}</span>
                                <span className="text-[10px] text-zinc-400">
                                  {item.category?.name || 'Menu Item'} • ₹{Number(item.finalPrice ?? item.basePrice).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <span
                              title={`Currently assigned to ${tagLabel}`}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 whitespace-nowrap"
                            >
                              {tagLabel}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* CENTER: Move Action Button */}
                <div className="shrink-0 flex flex-row md:flex-col items-center justify-center gap-2 self-center px-1">
                  <button
                    type="button"
                    onClick={handleInitiateMove}
                    disabled={selectedItemIds.size === 0 || isAssigning}
                    title="Move selected products to target tag"
                    className={`p-3.5 rounded-xl border flex items-center justify-center font-bold text-xs shadow-lg transition-all cursor-pointer ${
                      selectedItemIds.size > 0
                        ? 'bg-[#D4AF37] hover:bg-[#c49f30] text-zinc-950 border-[#D4AF37] scale-105 active:scale-95'
                        : 'bg-zinc-800 text-zinc-600 border-zinc-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <ArrowRight className="w-5 h-5 hidden md:block" />
                    <span className="md:hidden">Move to Tag ({selectedItemIds.size})</span>
                  </button>
                  <span className="text-[10px] font-bold text-zinc-400 hidden md:block text-center whitespace-nowrap">
                    {selectedItemIds.size > 0 ? `${selectedItemIds.size} selected` : 'Select items'}
                  </span>
                </div>

                {/* RIGHT PANEL: Current Target Tag & Products */}
                <div className="flex-1 min-w-0 flex flex-col bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 overflow-hidden">
                  <div className="space-y-3 mb-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">
                        Target GST Tag
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsNewTagModalOpen(true)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New GST Tag
                      </button>
                    </div>

                    {/* Target Tag Dropdown & Delete Button */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <select
                          value={selectedTagId}
                          onChange={(e) => handleSwitchTargetTag(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-black rounded-lg border border-zinc-700 bg-zinc-900 text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] cursor-pointer"
                        >
                          {tags.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name} ({(Number(tag.rate) * 100).toFixed(0)}% Tax) — {getTagAssignmentCount(tag.id)} items
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isNoGst) return;
                          setShowDeleteConfirmModal(true);
                        }}
                        disabled={isNoGst || isDeletingTag}
                        title={
                          isNoGst
                            ? 'Base tag "No GST" cannot be deleted'
                            : `Delete ${currentTag?.name}`
                        }
                        className={`px-3 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
                          isNoGst
                            ? 'bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                            : 'bg-rose-950/30 hover:bg-rose-900/50 border-rose-800/50 text-rose-400 hover:text-rose-200 active:scale-95'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400">
                      <span className="font-bold text-zinc-300">Products under {currentTag?.name || 'Target GST'}</span>
                      <span className="font-bold text-white">{itemsInTarget.length} items</span>
                    </div>
                  </div>

                  {/* Items currently in Target Tag */}
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {itemsInTarget.length === 0 ? (
                      <div className="text-center py-10 text-zinc-500 text-xs">
                        No products currently assigned to {currentTag?.name}
                      </div>
                    ) : (
                      itemsInTarget.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 flex items-center justify-between"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="text-xs font-bold text-white block truncate">{item.name}</span>
                            <span className="text-[10px] text-zinc-400">
                              {item.category?.name || 'Menu Item'} • ₹{Number(item.finalPrice ?? item.basePrice).toFixed(2)}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 whitespace-nowrap">
                            {targetTagRate}% GST
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2 & 3: VENUE CHARGE CONFIGURATION */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Venue Charge Configuration
                  </h3>
                </div>
                <span className="text-[11px] text-zinc-400">
                  Venue hospitality service charge and commercial rounding applied to subtotals
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SERVICE CHARGE SECTION */}
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-white block">Service Charge (SC)</span>
                      <p className="text-[11px] text-zinc-400">Venue hospitality service charge applied on subtotal</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scEnabled}
                        onChange={(e) => setScEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-700 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                    </label>
                  </div>

                  {scEnabled && (
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-900">
                      <label className="text-xs text-zinc-400 font-semibold">Charge Rate (%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={scPercent}
                        onChange={(e) => setScPercent(Number(e.target.value))}
                        className="w-24 px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-700 bg-zinc-900 text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      />
                      <span className="text-xs text-zinc-400">%</span>
                    </div>
                  )}
                </div>

                {/* COMMERCIAL CASH ROUNDING SECTION */}
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-white block">Commercial Cash Rounding</span>
                      <p className="text-[11px] text-zinc-400">Round payable totals to nearest integer rupee</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roundingEnabled}
                        onChange={(e) => setRoundingEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-700 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/90 shrink-0">
          <span className="text-[11px] text-zinc-400">
            GST tags snapshot on orders. Service charge and rounding apply venue-wide on final bill.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSaveCharges}
              disabled={isSavingCharges}
              className="px-4 py-2 text-xs font-black bg-[#D4AF37] hover:bg-[#c49f30] text-zinc-950 rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSavingCharges ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Charges
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* BULK MOVE CONFIRMATION DIALOG */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 animate-fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-move-title"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="confirm-move-title" className="text-sm font-black text-white">
                    Move Products?
                  </h3>
                  <p className="text-xs text-zinc-400">
                    You are about to move the following {stagedItems.length} product(s) to <strong className="text-white">{currentTag?.name}</strong>:
                  </p>
                </div>
              </div>

              {/* Product Summary List */}
              <div className="max-h-52 overflow-y-auto rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2.5">
                {stagedItems.map((item) => {
                  const currentItemTag = tags.find((t) => t.id === item.gstTaxTagId);
                  const prevLabel = currentItemTag ? currentItemTag.name : 'No GST';
                  return (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-zinc-900 last:border-0">
                      <div>
                        <span className="font-bold text-zinc-200 block truncate">{item.name}</span>
                        <span className="text-[10px] text-zinc-400">Current GST: {prevLabel}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                        <span className="font-black text-[#D4AF37]">{currentTag?.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-semibold">Target GST:</span>
                <span className="font-black text-[#D4AF37]">{currentTag?.name}</span>
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Future orders of these items will apply {targetTagRate}% GST. Settled and ongoing historical records remain completely unaffected.
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isAssigning}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  No
                </button>
                <button
                  ref={confirmYesBtnRef}
                  type="button"
                  onClick={handleExecuteMove}
                  disabled={isAssigning}
                  className="px-5 py-2 text-xs font-black bg-[#D4AF37] hover:bg-[#c49f30] text-zinc-950 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Yes, Move
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAG DELETION CONFIRMATION DIALOG */}
        {showDeleteConfirmModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 animate-fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-tag-title"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="delete-tag-title" className="text-sm font-black text-white">
                    Delete GST Tag: {currentTag?.name}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Rate: <span className="text-white font-bold">{targetTagRate}%</span> • Assigned Products: <span className="text-white font-bold">{itemsInTarget.length}</span>
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/30 text-xs text-rose-300 font-medium leading-relaxed">
                Products currently assigned to this GST tag will be moved to No GST. Are you sure you want to delete this GST tag?
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmModal(false)}
                  disabled={isDeletingTag}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  ref={deleteConfirmBtnRef}
                  type="button"
                  onClick={handleExecuteDeleteTag}
                  disabled={isDeletingTag}
                  className="px-5 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isDeletingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETION RESULT POPUP */}
        {showDeleteResultModal && deleteResultData && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 animate-fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-result-title"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="delete-result-title" className="text-sm font-black text-white">
                    GST Tag Deleted
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Operation completed successfully
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs leading-relaxed">
                <p className="text-zinc-200">
                  The GST tag <strong className="text-white font-bold">{deleteResultData.tagName}</strong> has been deleted successfully.
                </p>
                <p className="text-zinc-400">
                  <span className="text-[#D4AF37] font-bold">{deleteResultData.affectedCount}</span> product(s) previously assigned to this tag have been moved to <strong className="text-white font-bold">{deleteResultData.fallbackTagName}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-zinc-800">
                <button
                  ref={deleteResultOkBtnRef}
                  type="button"
                  onClick={() => setShowDeleteResultModal(false)}
                  className="px-5 py-2 text-xs font-black bg-[#D4AF37] hover:bg-[#c49f30] text-zinc-950 rounded-xl transition-colors cursor-pointer shadow-lg"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NEW GST TAG CREATION MODAL */}
        <NewTagModal
          isOpen={isNewTagModalOpen}
          onClose={() => setIsNewTagModalOpen(false)}
          existingTags={tags}
          onCreated={(newTag) => {
            setTags((prev) => [...prev, newTag]);
            setSelectedTagId(newTag.id);
            setFeedback({
              type: 'success',
              message: `Created new tax bracket ${newTag.name} (${(Number(newTag.rate) * 100).toFixed(0)}%)`,
            });
            setTimeout(() => setFeedback(null), 3000);
          }}
        />
      </div>
    </div>,
    document.body
  );
};
