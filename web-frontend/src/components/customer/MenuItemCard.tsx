import React from 'react';
import { VegBadge } from './VegBadge';
import { Star, Sparkles, Plus, Minus } from 'lucide-react';
import { formatImageUrl } from '../../utils/imageUrl';
import type { CustomizerItem } from './ProductCustomizer';

interface MenuItemCardProps {
  item: CustomizerItem & {
    isAvailable?: boolean;
    popular?: boolean;
    featured?: boolean;
    imageUrl?: string;
  };
  cartQuantity?: number;
  variant?: 'menu' | 'home';
  isOrderingDisabled?: boolean;
  onOpenCustomizer: (item: CustomizerItem) => void;
  onDirectAdd: (item: CustomizerItem) => void;
  onIncrement?: (item: CustomizerItem) => void;
  onDecrement?: (item: CustomizerItem) => void;
  onOpenDetails?: (item: any) => void;
  onOpenImageModal?: (imageUrl: string, itemName: string) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  cartQuantity = 0,
  variant = 'menu',
  isOrderingDisabled = false,
  onOpenCustomizer,
  onDirectAdd,
  onIncrement,
  onDecrement,
  onOpenDetails,
  onOpenImageModal,
}) => {
  const hasModifiers =
    (item.variants && item.variants.length > 0) ||
    (item.modifierGroups && item.modifierGroups.length > 0);
  const isAvailable = item.isAvailable !== false;
  const stockQty = (item as any).stockQuantity ?? 50;
  const availableStock = (item as any).availableStock !== undefined ? Number((item as any).availableStock) : stockQty;
  const isLowStock = isAvailable && availableStock > 0 && availableStock <= 10;
  const isOutOfStock = !isAvailable || availableStock <= 0;
  const isMaxReached = isAvailable && cartQuantity >= availableStock;

  const isPopular = Boolean(item.popular ?? (item as any).isPopular);
  const isFeatured = Boolean(item.featured ?? (item as any).isFeatured ?? (item as any).isSignature ?? (item as any).signature);
  const displayImage = (item as any).image || item.imageUrl;
  const numBasePrice = Number(item.basePrice);
  const numFinalPrice = Number((item as any).finalPrice ?? item.basePrice);
  const hasDiscount = numFinalPrice < numBasePrice;

  const handleAddClick = () => {
    if (isOutOfStock || isOrderingDisabled) return;
    if (hasModifiers) {
      onOpenCustomizer(item);
    } else {
      onDirectAdd(item);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOrderingDisabled || isMaxReached) return;
    if (onIncrement) {
      onIncrement(item);
    } else if (hasModifiers) {
      onOpenCustomizer(item);
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

  // Compact Menu Product Card with 1:1 Square Image
  return (
    <div
      onClick={() => onOpenDetails?.(item)}
      className="flex flex-col justify-between p-1.5 xs:p-2 sm:p-2.5 md:p-3 rounded-xl xs:rounded-2xl border border-primary/25 hover:border-primary/60 dark:border-[#D4AF37]/35 dark:hover:border-[#E5C158] bg-white dark:bg-[#18181B] shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer w-full select-none"
    >
      {/* 1:1 Square Image Container */}
      <div className="relative w-full aspect-square rounded-lg xs:rounded-xl bg-zinc-100 dark:bg-white/5 border border-border/50 dark:border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
        {displayImage ? (
          <img src={formatImageUrl(displayImage)} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl xs:text-3xl sm:text-4xl select-none" role="img" aria-label={item.name}>
            🍽️
          </span>
        )}

        {/* Veg / Non-Veg Dietary Badge: Stable anchored positioning */}
        {item.foodType && (
          <div className="absolute top-1 left-1 xs:top-1.5 xs:left-1.5 z-10 pointer-events-none bg-white/95 dark:bg-black/85 rounded-md p-0.5 backdrop-blur-xs shadow-xs border border-black/5 dark:border-white/10 flex items-center justify-center">
            <VegBadge type={item.foodType} size="sm" />
          </div>
        )}

        {/* Low Stock Badge on Image */}
        {isLowStock && (
          <div className="absolute top-1 right-1 xs:top-1.5 xs:right-1.5 z-10 pointer-events-none">
            <span className="text-[8px] xs:text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-500 text-white shadow-xs backdrop-blur-xs">
              Only {availableStock} left
            </span>
          </div>
        )}

        {/* Popular / Signature Tag overlay */}
        {(isPopular || isFeatured) && (
          <div className="absolute bottom-1 left-1 xs:bottom-1.5 xs:left-1.5 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-0.5 text-[8px] xs:text-[8.5px] sm:text-[9px] font-bold px-1 xs:px-1.5 sm:px-2 py-0.5 rounded-md bg-black/80 text-white dark:bg-[#D4AF37] dark:text-black shadow-xs backdrop-blur-xs">
              {isFeatured ? 'Signature' : 'Popular'}
            </span>
          </div>
        )}
      </div>

      {/* Card Info: Below square image */}
      <div className="pt-1 xs:pt-1.5 sm:pt-2 flex flex-col justify-between flex-1 min-w-0">
        <div>
          <h4 className="font-bold text-[11px] xs:text-xs sm:text-sm text-text-primary dark:text-white truncate leading-tight" title={item.name}>
            {item.name}
          </h4>
        </div>

        {/* Price & Add Action Row */}
        <div className="mt-1 xs:mt-1.5 sm:mt-2 flex items-center justify-between gap-1 pt-0.5 xs:pt-1 sm:pt-1.5 border-t border-border/40 dark:border-white/5">
          <div className="min-w-0 flex items-baseline gap-0.5 xs:gap-1">
            <span className="text-[11px] xs:text-xs sm:text-sm md:text-base font-extrabold text-primary dark:text-[#D4AF37] truncate">
              ₹{numFinalPrice}
            </span>
            {hasDiscount && (
              <span className="text-[9px] xs:text-[10px] sm:text-xs text-text-muted dark:text-zinc-500 line-through truncate">
                ₹{numBasePrice}
              </span>
            )}
          </div>

          <div className="shrink-0">
            {isOutOfStock ? (
              <span className="text-[8.5px] xs:text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                Out of Stock
              </span>
            ) : cartQuantity > 0 ? (
              <div className="flex items-center gap-0.5 xs:gap-1 sm:gap-1.5 px-1 xs:px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border border-primary text-primary dark:border-[#D4AF37] dark:text-[#D4AF37] bg-primary/10 dark:bg-[#D4AF37]/10 shadow-2xs">
                <button
                  type="button"
                  onClick={handleDecrement}
                  aria-label={`Decrease quantity of ${item.name}`}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full hover:bg-primary/20 dark:hover:bg-[#D4AF37]/20 transition-colors cursor-pointer"
                >
                  <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
                <span className="text-[10px] xs:text-[11px] sm:text-xs font-black min-w-[8px] xs:min-w-[10px] sm:min-w-[12px] text-center">
                  {cartQuantity}
                </span>
                <button
                  type="button"
                  disabled={isOrderingDisabled || isMaxReached}
                  onClick={handleIncrement}
                  aria-label={`Increase quantity of ${item.name}`}
                  title={isMaxReached ? `Only ${availableStock} available in stock` : undefined}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full hover:bg-primary/20 dark:hover:bg-[#D4AF37]/20 transition-colors cursor-pointer ${
                    isOrderingDisabled || isMaxReached ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''
                  }`}
                >
                  <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isOrderingDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddClick();
                }}
                aria-label={`Add ${item.name} to order`}
                title={isOrderingDisabled ? 'Ordering is closed (15 minutes or less remaining in session)' : undefined}
                className={`h-5 xs:h-6 sm:h-7 px-2 xs:px-2.5 sm:px-3 rounded-full border font-extrabold text-[9.5px] xs:text-[10px] sm:text-xs transition-colors flex items-center justify-center gap-0.5 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isOrderingDisabled
                    ? 'border-border/60 bg-black/5 dark:bg-white/5 text-text-muted dark:text-zinc-500 opacity-60 cursor-not-allowed pointer-events-none'
                    : 'border-primary text-primary hover:bg-primary hover:text-white dark:border-[#D4AF37] dark:text-[#D4AF37] dark:hover:bg-[#D4AF37] dark:hover:text-black focus-visible:outline-primary dark:focus-visible:outline-[#D4AF37]'
                }`}
              >
                {isOrderingDisabled ? 'CLOSED' : hasModifiers ? 'ADD +' : 'ADD'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
