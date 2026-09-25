import React, { useState, useEffect, useRef } from 'react';
import { VegBadge } from './VegBadge';
import { Minus, Plus, X, Check, AlertCircle } from 'lucide-react';
import { useModalKeyboard } from '../../hooks/useModalKeyboard';
import { useRovingSelection } from '../../hooks/useRovingSelection';

export interface CustomizerItem {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  finalPrice?: number;
  discountMode?: string;
  discountValue?: number;
  foodType: string;
  station: string;
  image?: string;
  imageUrl?: string;
  sectionSlug?: string;
  isAvailable?: boolean;
  stockQuantity?: number;
  availableStock?: number;
  variants?: Array<{
    id: string;
    name: string;
    priceDelta: number;
  }>;
  modifierGroups?: Array<{
    id: string;
    name: string;
    isRequired?: boolean;
    isMulti?: boolean;
    options: Array<{
      id: string;
      name: string;
      priceDelta: number;
    }>;
  }>;
}

export interface ProductCustomizerInitialConfig {
  variantId?: string | null;
  variantName?: string | null;
  modifiers?: Array<{
    groupId?: string;
    groupName?: string;
    optionId?: string;
    optionName?: string;
    name?: string;
    priceDelta?: number;
  }> | Record<string, string[]>;
  specialInstructions?: string;
  quantity?: number;
}

interface ProductCustomizerProps {
  item: CustomizerItem | null;
  open: boolean;
  initialConfig?: ProductCustomizerInitialConfig | null;
  existingCartQuantity?: number;
  onClose: () => void;
  isOrderingDisabled?: boolean;
  onAddToCart: (configuredItem: {
    menuItemId: string;
    name: string;
    sectionSlug?: string;
    variantId?: string | null;
    variantName?: string | null;
    modifiers: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      priceDelta: number;
    }>;
    specialInstructions?: string;
    quantity: number;
    unitPrice: number;
    station: string;
    foodType: string;
  }) => void;
}

export const ProductCustomizer: React.FC<ProductCustomizerProps> = ({
  item,
  open,
  initialConfig,
  existingCartQuantity = 0,
  onClose,
  isOrderingDisabled = false,
  onAddToCart,
}) => {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [mods, setMods] = useState<Record<string, string[]>>({});
  const [instructions, setInstructions] = useState('');
  const [qty, setQty] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Swipe-down to dismiss state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartScrollTop = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && item) {
      const currentKey = `${item.id}-${JSON.stringify(initialConfig || {})}`;
      if (initializedKeyRef.current !== currentKey) {
        initializedKeyRef.current = currentKey;

        // 1. Resolve initial variant
        let resolvedVariantId: string | null = null;
        if (item.variants && item.variants.length > 0) {
          if (initialConfig?.variantId) {
            const match = item.variants.find((v) => v.id === initialConfig.variantId);
            if (match) resolvedVariantId = match.id;
          }
          if (!resolvedVariantId && initialConfig?.variantName) {
            const match = item.variants.find(
              (v) => v.name.toLowerCase() === initialConfig.variantName?.toLowerCase()
            );
            if (match) resolvedVariantId = match.id;
          }
          if (!resolvedVariantId) {
            resolvedVariantId = item.variants[0].id;
          }
        }
        setVariantId(resolvedVariantId);

        // 2. Resolve initial modifiers
        const initialModsMap: Record<string, string[]> = {};
        if (initialConfig?.modifiers && item.modifierGroups) {
          if (Array.isArray(initialConfig.modifiers)) {
            initialConfig.modifiers.forEach((mod) => {
              let targetGroup = item.modifierGroups?.find(
                (g) =>
                  (mod.groupId && g.id === mod.groupId) ||
                  (mod.groupName && g.name.toLowerCase() === mod.groupName.toLowerCase())
              );

              if (!targetGroup) {
                const optName = mod.optionName || mod.name;
                if (optName) {
                  targetGroup = item.modifierGroups?.find((g) =>
                    g.options.some((o) => o.name.toLowerCase() === optName.toLowerCase())
                  );
                }
              }

              if (targetGroup) {
                const optName = mod.optionName || mod.name;
                const matchedOption = targetGroup.options.find(
                  (o) =>
                    (mod.optionId && o.id === mod.optionId) ||
                    (optName && o.name.toLowerCase() === optName.toLowerCase())
                );
                if (matchedOption) {
                  if (!initialModsMap[targetGroup.id]) {
                    initialModsMap[targetGroup.id] = [];
                  }
                  if (!initialModsMap[targetGroup.id].includes(matchedOption.id)) {
                    initialModsMap[targetGroup.id].push(matchedOption.id);
                  }
                }
              }
            });
          } else if (typeof initialConfig.modifiers === 'object') {
            Object.assign(initialModsMap, initialConfig.modifiers);
          }
        }
        setMods(initialModsMap);

        // 3. Resolve initial instructions & quantity
        setInstructions(initialConfig?.specialInstructions || '');
        setQty(
          initialConfig?.quantity && initialConfig.quantity > 0 ? initialConfig.quantity : 1
        );
        setValidationError(null);
        setDragY(0);
        setIsDragging(false);
        setIsClosing(false);
      }
    } else if (!open) {
      initializedKeyRef.current = null;
    }
  }, [open, item, initialConfig]);

  const variants = item?.variants || [];
  const modifierGroups = item?.modifierGroups || [];
  const isBarItem = item
    ? (item.station && item.station.toUpperCase() === 'BAR') ||
      (item.sectionSlug && item.sectionSlug.toLowerCase() === 'bar') ||
      item.foodType === 'BEVERAGE' ||
      item.foodType === 'ALCOHOLIC' ||
      item.foodType === 'NON_ALCOHOLIC'
    : false;

  const selectedVariant = variants.find((v) => v.id === variantId);

  // Identify missing required modifier groups
  const missingRequiredGroups = modifierGroups.filter(
    (g) => g.isRequired && (!mods[g.id] || mods[g.id].length === 0)
  );
  const isFormValid = missingRequiredGroups.length === 0;

  const toggleModifier = (
    group: { id: string; isRequired?: boolean; isMulti?: boolean },
    optionId: string
  ) => {
    setValidationError(null);
    setMods((prev) => {
      const current = prev[group.id] || [];
      const isMulti = group.isMulti ?? true;

      if (!isMulti) {
        // Single select (radio behavior)
        if (current.includes(optionId)) {
          return group.isRequired ? prev : { ...prev, [group.id]: [] };
        }
        return { ...prev, [group.id]: [optionId] };
      } else {
        // Multi select (checkbox behavior)
        if (current.includes(optionId)) {
          return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
        } else {
          return { ...prev, [group.id]: [...current, optionId] };
        }
      }
    });
  };

  const modAdditions = modifierGroups.reduce((sum, g) => {
    const selectedOptionIds = mods[g.id] || [];
    const groupSum = selectedOptionIds.reduce((gSum, optId) => {
      const opt = g.options.find((o) => o.id === optId);
      return gSum + (opt ? Number(opt.priceDelta || 0) : 0);
    }, 0);
    return sum + groupSum;
  }, 0);

  const effectiveBasePrice = item ? Number(item.finalPrice ?? item.basePrice) || 0 : 0;
  const variantDelta = selectedVariant ? Number(selectedVariant.priceDelta || 0) : 0;
  const unitPrice = Math.round((effectiveBasePrice + variantDelta + modAdditions) * 100) / 100;
  const grandTotal = Math.round((unitPrice * qty) * 100) / 100;

  const isManualAvailable = item ? item.isAvailable !== false : true;
  const physicalStock = item?.stockQuantity !== undefined ? Number(item.stockQuantity) : 50;
  const rawAvailable = item?.availableStock !== undefined ? Number(item.availableStock) : physicalStock;
  const customerOwnReserved = existingCartQuantity;
  const effectivePurchasableForCustomer = Math.min(physicalStock, rawAvailable + customerOwnReserved);
  const isPhysicalOutOfStock = !isManualAvailable || physicalStock <= 0;
  const isReservedOutForOthers = !isPhysicalOutOfStock && effectivePurchasableForCustomer <= 0;
  const remainingToAdd = Math.max(0, effectivePurchasableForCustomer - (initialConfig ? 0 : customerOwnReserved));
  const isLowStock = !isPhysicalOutOfStock && rawAvailable > 0 && rawAvailable <= 10;
  const isOutOfStock = isPhysicalOutOfStock;
  const maxAllowedQty = Math.max(1, effectivePurchasableForCustomer);

  const handleAdd = () => {
    if (!item || isOrderingDisabled || isPhysicalOutOfStock || isReservedOutForOthers) return;
    if (!isFormValid) {
      const names = missingRequiredGroups.map((g) => g.name).join(', ');
      setValidationError(`Please make a selection for: ${names}`);
      return;
    }

    const selectedMods = modifierGroups.flatMap((g) => {
      const selectedOptionIds = mods[g.id] || [];
      return selectedOptionIds
        .map((optId) => {
          const opt = g.options.find((o) => o.id === optId);
          if (!opt) return null;
          return {
            groupId: g.id,
            groupName: g.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: Number(opt.priceDelta || 0),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    });

    if (!initialConfig && qty > remainingToAdd) {
      setValidationError(`Only ${remainingToAdd} additional units available in stock.`);
      return;
    }

    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      sectionSlug: item.sectionSlug || 'eat',
      variantId: selectedVariant ? selectedVariant.id : null,
      variantName: selectedVariant ? selectedVariant.name : null,
      modifiers: selectedMods,
      specialInstructions: instructions.trim() ? instructions.trim() : undefined,
      quantity: qty,
      unitPrice,
      station: item.station,
      foodType: item.foodType,
    });

    onClose();
  };

  const selectedVariantIndex = variants.findIndex((v) => v.id === variantId);
  const variantRoving = useRovingSelection({
    items: variants,
    selectedIndex: selectedVariantIndex >= 0 ? selectedVariantIndex : 0,
    orientation: 'vertical',
    enabled: open && variants.length > 0,
    onSelect: (v) => setVariantId(v.id),
  });

  useModalKeyboard({
    isOpen: open && !!item,
    onConfirm: handleAdd,
    onClose,
    confirmDisabled: isOrderingDisabled || isPhysicalOutOfStock || isReservedOutForOthers,
    allowInTextarea: false, // In textarea, Enter adds newline
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartScrollTop.current = scrollRef.current ? scrollRef.current.scrollTop : 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    const currentScrollTop = scrollRef.current ? scrollRef.current.scrollTop : 0;

    // Only allow downward drag when scroll is at top
    if (deltaY > 0 && currentScrollTop <= 0 && touchStartScrollTop.current <= 0) {
      setDragY(deltaY);
      setIsDragging(true);
    } else if (isDragging && deltaY <= 0) {
      setDragY(0);
      setIsDragging(false);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 70) {
      setIsClosing(true);
      setTimeout(() => {
        setDragY(0);
        setIsDragging(false);
        setIsClosing(false);
        onClose();
      }, 200);
    } else {
      setDragY(0);
      setIsDragging(false);
    }
    touchStartY.current = null;
  };

  const backdropOpacity = isClosing
    ? 0
    : isDragging
    ? Math.max(0.15, 1 - dragY / 400)
    : 1;

  if (!open || !item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        opacity: backdropOpacity,
        transition: isDragging ? 'none' : 'opacity 0.22s ease-out',
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: isDragging ? `translateY(${dragY}px)` : isClosing ? 'translateY(100%)' : 'translateY(0)',
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col will-change-transform"
      >
        {/* Mobile Drag Pill Handle */}
        <div className="w-full pt-2.5 pb-0.5 flex justify-center sm:hidden cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        {/* Header */}
        <div className="p-4 pt-2 sm:pt-4 border-b border-border/80 dark:border-white/10 flex items-start justify-between">
          <div className="flex items-start gap-2.5">
            <VegBadge type={item.foodType} size="md" className="mt-1" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-text-primary dark:text-white leading-tight">{item.name}</h3>
                {isLowStock && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    Only {rawAvailable} left
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-text-muted dark:text-zinc-400 mt-1 line-clamp-2">{item.description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customizer"
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-text-muted hover:text-text-primary dark:hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div ref={scrollRef} className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Variants / Sizes */}
          {variants.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">
                Choose Portion / Size
              </label>
              <div 
                className="space-y-2 focus:outline-none"
                onKeyDown={variantRoving.handleKeyDown}
              >
                {variants.map((v, idx) => {
                  const itemProps = variantRoving.getItemProps(idx);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      tabIndex={itemProps.tabIndex}
                      onClick={() => setVariantId(v.id)}
                      onFocus={itemProps.onFocus}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all cursor-pointer ${
                        variantId === v.id
                          ? 'border-primary bg-primary/10 font-semibold text-primary dark:border-[#D4AF37] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] ring-1 ring-primary/40'
                          : 'border-border/80 dark:border-white/10 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 text-text-primary dark:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                            variantId === v.id
                              ? 'bg-primary border-primary text-white dark:bg-[#D4AF37] dark:border-[#D4AF37]'
                              : 'border-zinc-300 dark:border-zinc-600 bg-transparent'
                          }`}
                        >
                          {variantId === v.id && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-black" />
                          )}
                        </div>
                        <span className="truncate">{v.name}</span>
                      </div>
                      <span className="text-xs shrink-0">
                        {Number(v.priceDelta) === 0 ? `₹${Number(item.basePrice).toFixed(2)}` : `+₹${Number(v.priceDelta).toFixed(2)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modifier Groups */}
          {modifierGroups.map((g) => {
            const isMulti = g.isMulti ?? true;
            const selectedIds = mods[g.id] || [];
            return (
              <div key={g.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-text-primary dark:text-zinc-200 uppercase tracking-wider block">
                      {g.name}
                    </label>
                    {g.isRequired && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        selectedIds.length > 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}>
                        {selectedIds.length > 0 ? 'Selected' : 'Required'}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-text-muted dark:text-zinc-400">
                    {isMulti
                      ? 'Choose multiple (optional)'
                      : g.isRequired
                      ? 'Select 1 (required)'
                      : 'Select 1 (optional)'}
                  </span>
                </div>
                <div className="space-y-2">
                  {g.options.map((opt) => {
                    const isSelected = selectedIds.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleModifier(g, opt.id)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary bg-primary/10 font-semibold text-primary dark:border-[#D4AF37] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                            : 'border-border/80 dark:border-white/10 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 text-text-primary dark:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded ${
                              isMulti ? 'rounded-md' : 'rounded-full'
                            } border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-primary border-primary text-white dark:bg-[#D4AF37] dark:border-[#D4AF37] dark:text-black'
                                : 'border-zinc-300 dark:border-zinc-600 bg-transparent'
                            }`}
                          >
                            {isSelected && (
                              isMulti ? (
                                <Check className="w-3 h-3 stroke-[3]" />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-black" />
                              )
                            )}
                          </div>
                          <span className="truncate">{opt.name}</span>
                        </div>
                        <span className="text-xs shrink-0">
                          {Number(opt.priceDelta) > 0 ? `+₹${Number(opt.priceDelta).toFixed(2)}` : 'Free'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Instructions */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
              {isBarItem ? 'Special Instructions' : 'Special Cooking Instructions'}
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={
                isBarItem
                  ? 'e.g., less ice, no ice, extra chilled...'
                  : 'e.g., Less spicy, no onions, extra crispy...'
              }
              maxLength={200}
              rows={2}
              className="w-full text-xs p-3 rounded-xl border border-border/80 dark:border-white/10 bg-transparent text-text-primary dark:text-white placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:border-[#D4AF37] dark:focus:ring-[#D4AF37]/20 transition-all"
            />
          </div>

          {/* Quantity Stepper */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/80 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
            <span className="text-xs font-medium text-text-primary dark:text-zinc-300">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border/80 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-text-primary dark:text-white transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center font-bold text-sm text-primary dark:text-[#D4AF37]">{qty}</span>
              <button
                type="button"
                disabled={
                  isOrderingDisabled ||
                  (initialConfig ? qty >= effectivePurchasableForCustomer : (remainingToAdd <= 0 || qty >= remainingToAdd))
                }
                onClick={() =>
                  setQty((q) =>
                    initialConfig
                      ? Math.min(effectivePurchasableForCustomer, q + 1)
                      : Math.min(remainingToAdd, q + 1)
                  )
                }
                title={
                  (initialConfig ? qty >= effectivePurchasableForCustomer : (remainingToAdd <= 0 || qty >= remainingToAdd))
                    ? `Only ${initialConfig ? effectivePurchasableForCustomer : remainingToAdd} available in stock`
                    : undefined
                }
                className={`w-8 h-8 rounded-lg flex items-center justify-center border border-border/80 dark:border-white/10 text-text-primary dark:text-white transition-colors cursor-pointer ${
                  isOrderingDisabled ||
                  (initialConfig ? qty >= effectivePurchasableForCustomer : (remainingToAdd <= 0 || qty >= remainingToAdd))
                    ? 'opacity-30 cursor-not-allowed pointer-events-none'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] space-y-2">
          {validationError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
          <button
            type="button"
            disabled={isOrderingDisabled || isPhysicalOutOfStock || isReservedOutForOthers}
            onClick={handleAdd}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-between cursor-pointer ${
              isOrderingDisabled || isPhysicalOutOfStock || isReservedOutForOthers
                ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 opacity-60 cursor-not-allowed pointer-events-none'
                : 'bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-black text-white hover:shadow-lg'
            }`}
          >
            <span>
              {isPhysicalOutOfStock
                ? 'Currently Out of Stock'
                : isReservedOutForOthers
                ? 'Reserved by Other Customers'
                : isOrderingDisabled
                ? 'Ordering Closed (15m Cutoff)'
                : 'Add to Cart'}
            </span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
