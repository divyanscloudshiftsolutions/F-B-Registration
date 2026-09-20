import React, { useState, useEffect } from 'react';
import { VegBadge } from './VegBadge';
import { Minus, Plus, X, Check, AlertCircle } from 'lucide-react';

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

interface ProductCustomizerProps {
  item: CustomizerItem | null;
  open: boolean;
  onClose: () => void;
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
  onClose,
  onAddToCart,
}) => {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [mods, setMods] = useState<Record<string, string[]>>({});
  const [instructions, setInstructions] = useState('');
  const [qty, setQty] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open && item) {
      setVariantId(item.variants && item.variants.length > 0 ? item.variants[0].id : null);
      setMods({});
      setInstructions('');
      setQty(1);
      setValidationError(null);
    }
  }, [open, item]);

  if (!open || !item) return null;

  const variants = item.variants || [];
  const modifierGroups = item.modifierGroups || [];
  const isBarItem =
    (item.station && item.station.toUpperCase() === 'BAR') ||
    (item.sectionSlug && item.sectionSlug.toLowerCase() === 'bar') ||
    item.foodType === 'BEVERAGE' ||
    item.foodType === 'ALCOHOLIC' ||
    item.foodType === 'NON_ALCOHOLIC';

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

  const effectiveBasePrice = Number(item.finalPrice ?? item.basePrice) || 0;
  const variantDelta = selectedVariant ? Number(selectedVariant.priceDelta || 0) : 0;
  const unitPrice = Math.round((effectiveBasePrice + variantDelta + modAdditions) * 100) / 100;
  const grandTotal = Math.round((unitPrice * qty) * 100) / 100;

  const handleAdd = () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25 dark:bg-black/80 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border/80 dark:border-white/10 flex items-start justify-between">
          <div className="flex items-start gap-2.5">
            <VegBadge type={item.foodType} size="md" className="mt-1" />
            <div>
              <h3 className="font-bold text-lg text-text-primary dark:text-white leading-tight">{item.name}</h3>
              {item.description && (
                <p className="text-xs text-text-muted dark:text-zinc-400 mt-1 line-clamp-2">{item.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-text-muted hover:text-text-primary dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Variants / Sizes */}
          {variants.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">
                Choose Portion / Size
              </label>
              <div className="space-y-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all cursor-pointer ${
                      variantId === v.id
                        ? 'border-primary bg-primary/10 font-semibold text-primary dark:border-[#D4AF37] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
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
                ))}
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
                onClick={() => setQty((q) => q + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border/80 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-text-primary dark:text-white transition-colors cursor-pointer"
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
            onClick={handleAdd}
            className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-black text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-between cursor-pointer"
          >
            <span>Add to Cart</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
