import React from 'react';
import { VegBadge } from './VegBadge';
import { Star, Sparkles, Plus, Minus } from 'lucide-react';
import type { CustomizerItem } from './ProductCustomizer';

interface MenuItemCardProps {
  item: CustomizerItem & {
    isAvailable?: boolean;
    popular?: boolean;
    featured?: boolean;
    imageUrl?: string;
  };
  cartQuantity?: number;
  onOpenCustomizer: (item: CustomizerItem) => void;
  onDirectAdd: (item: CustomizerItem) => void;
  onIncrement?: (item: CustomizerItem) => void;
  onDecrement?: (item: CustomizerItem) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  cartQuantity = 0,
  onOpenCustomizer,
  onDirectAdd,
  onIncrement,
  onDecrement,
}) => {
  const hasModifiers =
    (item.variants && item.variants.length > 0) ||
    (item.modifierGroups && item.modifierGroups.length > 0);
  const isAvailable = item.isAvailable !== false;

  const handleAddClick = () => {
    if (!isAvailable) return;
    if (hasModifiers) {
      onOpenCustomizer(item);
    } else {
      onDirectAdd(item);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasModifiers) {
      onOpenCustomizer(item);
    } else if (onIncrement) {
      onIncrement(item);
    } else {
      onDirectAdd(item);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDecrement) {
      onDecrement(item);
    }
  };

  return (
    <div className="flex gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] shadow-xs hover:shadow-md hover:border-primary/40 dark:hover:border-[#D4AF37]/40 transition-all duration-200">
      {/* Item Details */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {item.foodType && <VegBadge type={item.foodType} size="sm" />}
            {item.popular && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]">
                <Star className="w-2.5 h-2.5 fill-current" /> Popular
              </span>
            )}
            {item.featured && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Sparkles className="w-2.5 h-2.5" /> Signature
              </span>
            )}
          </div>
          <h4 className="font-bold text-sm sm:text-base text-text-primary dark:text-white leading-tight">
            {item.name}
          </h4>
          {item.description && (
            <p className="text-xs text-text-muted dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm sm:text-base font-extrabold text-primary dark:text-[#D4AF37]">
            {hasModifiers ? `from ₹${item.basePrice}` : `₹${item.basePrice}`}
          </span>
          {hasModifiers && (
            <span className="text-[10px] text-text-muted dark:text-zinc-400 font-medium">
              Customizable
            </span>
          )}
        </div>
      </div>

      {/* Right Side: Image + Add / Quantity Stepper */}
      <div className="w-24 sm:w-28 shrink-0 flex flex-col items-center justify-between">
        <div className="w-20 sm:w-24 h-16 sm:h-20 rounded-xl bg-primary/5 dark:bg-white/5 border border-border/60 dark:border-white/10 flex items-center justify-center text-xs font-semibold text-text-muted overflow-hidden">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl select-none" role="img" aria-label={item.name}>
              🍽️
            </span>
          )}
        </div>

        {!isAvailable ? (
          <span className="mt-2 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
            Sold Out
          </span>
        ) : cartQuantity > 0 ? (
          /* Live in-card quantity stepper */
          <div className="mt-2 w-full flex items-center justify-between bg-primary/10 dark:bg-[#D4AF37]/15 rounded-xl border border-primary/30 dark:border-[#D4AF37]/30 p-0.5">
            <button
              type="button"
              onClick={handleDecrement}
              aria-label={`Decrease quantity of ${item.name}`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-primary dark:text-[#D4AF37] hover:bg-primary/20 dark:hover:bg-[#D4AF37]/20 transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-extrabold text-primary dark:text-[#D4AF37] px-1">
              {cartQuantity}
            </span>
            <button
              type="button"
              onClick={handleIncrement}
              aria-label={`Increase quantity of ${item.name}`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-primary dark:text-[#D4AF37] hover:bg-primary/20 dark:hover:bg-[#D4AF37]/20 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Initial Add Button with >= 44px touch area */
          <button
            type="button"
            onClick={handleAddClick}
            aria-label={`Add ${item.name} to order`}
            className="mt-2 w-full min-h-[36px] py-1.5 px-3 rounded-xl border border-primary text-primary hover:bg-primary hover:text-white dark:border-[#D4AF37] dark:text-[#D4AF37] dark:hover:bg-[#D4AF37] dark:hover:text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:focus-visible:outline-[#D4AF37]"
          >
            {hasModifiers ? 'ADD +' : 'ADD'}
          </button>
        )}
      </div>
    </div>
  );
};
