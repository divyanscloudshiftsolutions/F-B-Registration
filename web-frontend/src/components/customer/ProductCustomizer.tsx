import React, { useState, useEffect } from 'react';
import { VegBadge } from './VegBadge';
import { Minus, Plus, X } from 'lucide-react';

export interface CustomizerItem {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  foodType: string;
  station: string;
  sectionSlug?: string;
  variants?: Array<{
    id: string;
    name: string;
    priceDelta: number;
  }>;
  modifierGroups?: Array<{
    id: string;
    name: string;
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
  const [mods, setMods] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (open && item) {
      setVariantId(item.variants && item.variants.length > 0 ? item.variants[0].id : null);
      setMods({});
      setInstructions('');
      setQty(1);
    }
  }, [open, item]);

  if (!open || !item) return null;

  const variants = item.variants || [];
  const modifierGroups = item.modifierGroups || [];

  const selectedVariant = variants.find((v) => v.id === variantId);
  const modAdditions = modifierGroups.reduce((sum, g) => {
    const optId = mods[g.id];
    const opt = g.options.find((o) => o.id === optId);
    return sum + (opt ? opt.priceDelta : 0);
  }, 0);

  const unitPrice = item.basePrice + (selectedVariant ? selectedVariant.priceDelta : 0) + modAdditions;
  const grandTotal = unitPrice * qty;

  const handleAdd = () => {
    const selectedMods = modifierGroups
      .map((g) => {
        const optId = mods[g.id];
        const opt = g.options.find((o) => o.id === optId);
        if (!opt) return null;
        return {
          groupId: g.id,
          groupName: g.name,
          optionId: opt.id,
          optionName: opt.name,
          priceDelta: opt.priceDelta,
        };
      })
      .filter(Boolean) as Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      priceDelta: number;
    }>;

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl dark:bg-[#1A1829] bg-white border border-[#8D6CE5]/20 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#8D6CE5]/15 flex items-start justify-between">
          <div className="flex items-start gap-2.5">
            <VegBadge type={item.foodType} className="mt-1" />
            <div>
              <h3 className="font-bold text-lg text-text-primary dark:text-white leading-tight">{item.name}</h3>
              {item.description && (
                <p className="text-xs text-text-muted mt-1 line-clamp-2">{item.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#8D6CE5]/10 text-text-muted hover:text-text-primary transition-colors"
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
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                      variantId === v.id
                        ? 'border-[#8D6CE5] bg-[#8D6CE5]/10 font-semibold text-[#8D6CE5]'
                        : 'border-[#8D6CE5]/15 hover:border-[#8D6CE5]/40 text-text-primary dark:text-zinc-200'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span className="text-xs">
                      {v.priceDelta === 0 ? `₹${item.basePrice}` : `+₹${v.priceDelta}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modifier Groups */}
          {modifierGroups.map((g) => (
            <div key={g.id}>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">
                {g.name}
              </label>
              <div className="space-y-2">
                {g.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMods((prev) => ({ ...prev, [g.id]: opt.id }))}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                      mods[g.id] === opt.id
                        ? 'border-[#8D6CE5] bg-[#8D6CE5]/10 font-semibold text-[#8D6CE5]'
                        : 'border-[#8D6CE5]/15 hover:border-[#8D6CE5]/40 text-text-primary dark:text-zinc-200'
                    }`}
                  >
                    <span>{opt.name}</span>
                    {opt.priceDelta > 0 && (
                      <span className="text-xs text-text-muted">+₹{opt.priceDelta}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Special Cooking Instructions */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
              Special Cooking Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Less spicy, no onions, extra crispy..."
              maxLength={200}
              rows={2}
              className="w-full text-xs p-3 rounded-xl border border-[#8D6CE5]/20 bg-transparent dark:text-white placeholder:text-text-muted/60 focus:outline-none focus:border-[#8D6CE5]"
            />
          </div>

          {/* Quantity Stepper */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[#8D6CE5]/15 dark:bg-[#141225]/40 bg-zinc-50">
            <span className="text-xs font-medium text-text-primary dark:text-zinc-300">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#8D6CE5]/30 hover:bg-[#8D6CE5]/10 text-text-primary dark:text-white transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center font-bold text-sm text-[#8D6CE5]">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#8D6CE5]/30 hover:bg-[#8D6CE5]/10 text-text-primary dark:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-[#8D6CE5]/15 dark:bg-[#141225]/50 bg-white">
          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-3 px-4 rounded-xl bg-[#8D6CE5] hover:bg-[#7B59D8] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-between"
          >
            <span>Add to Cart</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
