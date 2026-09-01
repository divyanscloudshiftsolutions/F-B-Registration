import React from 'react';
import { VegBadge } from './VegBadge';
import { Star, Sparkles, Plus } from 'lucide-react';
import type { CustomizerItem } from './ProductCustomizer';

interface MenuItemCardProps {
  item: CustomizerItem & {
    isAvailable?: boolean;
    popular?: boolean;
    featured?: boolean;
    imageUrl?: string;
  };
  onOpenCustomizer: (item: CustomizerItem) => void;
  onDirectAdd: (item: CustomizerItem) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  onOpenCustomizer,
  onDirectAdd,
}) => {
  const hasModifiers =
    (item.variants && item.variants.length > 0) ||
    (item.modifierGroups && item.modifierGroups.length > 0);
  const isAvailable = item.isAvailable !== false;

  const handleClick = () => {
    if (!isAvailable) return;
    if (hasModifiers) {
      onOpenCustomizer(item);
    } else {
      onDirectAdd(item);
    }
  };

  return (
    <div className="flex gap-3.5 p-3.5 rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829]/70 bg-white shadow-xs hover:border-[#8D6CE5]/30 transition-all">
      {/* Item Details */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <VegBadge type={item.foodType} size="sm" />
            {item.popular && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#8D6CE5]/10 text-[#8D6CE5]">
                <Star className="w-2.5 h-2.5 fill-current" /> Popular
              </span>
            )}
            {item.featured && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500">
                <Sparkles className="w-2.5 h-2.5" /> Signature
              </span>
            )}
          </div>
          <h4 className="font-bold text-sm text-text-primary dark:text-white leading-tight">{item.name}</h4>
          {item.description && (
            <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
          )}
        </div>

        <div className="mt-2 text-sm font-bold text-[#8D6CE5] dark:text-[#A78BFA]">
          {hasModifiers ? `from ₹${item.basePrice}` : `₹${item.basePrice}`}
        </div>
      </div>

      {/* Right Side / Image & Action */}
      <div className="w-24 shrink-0 flex flex-col items-center justify-between">
        <div className="w-20 h-16 rounded-xl bg-gradient-to-br from-[#8D6CE5]/20 via-[#8D6CE5]/10 to-indigo-500/10 flex items-center justify-center text-xs font-semibold text-[#8D6CE5]/60 overflow-hidden">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg">🍽️</span>
          )}
        </div>

        {!isAvailable ? (
          <span className="mt-2 text-[11px] font-semibold px-2 py-1 rounded-md border border-rose-500/30 text-rose-500">
            Sold Out
          </span>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            className="mt-2 w-full py-1 px-2.5 rounded-lg border border-[#8D6CE5] text-[#8D6CE5] hover:bg-[#8D6CE5] hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs"
          >
            {hasModifiers ? 'ADD +' : 'ADD'}
          </button>
        )}
      </div>
    </div>
  );
};
