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
  onOrderingBlockedClick?: () => void;
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
  onOrderingBlockedClick,
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
  const isManualAvailable = item.isAvailable !== false;
  const physicalStock = Number((item as any).stockQuantity ?? 50);
  const rawAvailable = (item as any).availableStock !== undefined ? Number((item as any).availableStock) : physicalStock;
  const customerOwnReserved = cartQuantity;
  const effectivePurchasableForCustomer = Math.min(physicalStock, rawAvailable + customerOwnReserved);
  const isPhysicalOutOfStock = !isManualAvailable || physicalStock <= 0;
  const isReservedOutForOthers = !isPhysicalOutOfStock && effectivePurchasableForCustomer <= 0;
  const isLowStock = !isPhysicalOutOfStock && rawAvailable > 0 && rawAvailable < 10;
  const isMaxReached = !isPhysicalOutOfStock && customerOwnReserved >= effectivePurchasableForCustomer;

  const isPopular = Boolean(item.popular ?? (item as any).isPopular);
  const isFeatured = Boolean(item.featured ?? (item as any).isFeatured ?? (item as any).isSignature ?? (item as any).signature);
  const displayImage = (item as any).image || item.imageUrl;
  const numBasePrice = Number(item.basePrice || 0);
  const numFinalPrice = Number((item as any).finalPrice ?? item.basePrice ?? 0);
  const hasDiscount = numBasePrice > 0 && numFinalPrice >= 0 && numFinalPrice < numBasePrice;
  const discountPercentage = hasDiscount
    ? Math.round(((numBasePrice - numFinalPrice) / numBasePrice) * 100)
    : 0;
  const isOfferValid = discountPercentage > 0 && discountPercentage < 100;

  const handleAddClick = () => {
    if (isOrderingDisabled) {
      if (onOrderingBlockedClick) {
        onOrderingBlockedClick();
      }
      return;
    }
    if (isPhysicalOutOfStock || isReservedOutForOthers) return;
    if (hasModifiers) {
      onOpenCustomizer(item);
    } else {
      onDirectAdd(item);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOrderingDisabled) {
      if (onOrderingBlockedClick) {
        onOrderingBlockedClick();
      }
      return;
    }
    if (isMaxReached) return;
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
    if (isOrderingDisabled) {
      if (onOrderingBlockedClick) {
        onOrderingBlockedClick();
      }
      return;
    }
    if (onDecrement) {
      onDecrement(item);
    }
  };

  // Compact Menu Product Card with 1:1 Square Image
  return (
    <div
      onClick={() => onOpenDetails?.(item)}
      className="h-full flex flex-col justify-between p-1.5 xs:p-2 sm:p-2.5 md:p-3 rounded-xl xs:rounded-2xl border border-primary/25 hover:border-primary/60 dark:border-[#D4AF37]/35 dark:hover:border-[#E5C158] bg-white dark:bg-[#18181B] shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer w-full select-none"
    >
      {/* 1:1 Square Image Container */}
      <div className="relative w-full aspect-square shrink-0">
        {/* Inner Image Container with rounded borders and clipping - strictly absolute to isolate intrinsic image height */}
        <div className="absolute inset-0 rounded-lg xs:rounded-xl bg-zinc-100 dark:bg-white/5 border border-border/50 dark:border-white/10 overflow-hidden flex items-center justify-center">
          {displayImage ? (
            <img
              src={formatImageUrl(displayImage)}
              alt={item.name}
              loading="lazy"
              className={`w-full h-full object-cover object-center transition-opacity ${isPhysicalOutOfStock ? 'opacity-60 grayscale-[25%]' : ''}`}
            />
          ) : (
            <span className="text-2xl xs:text-3xl sm:text-4xl select-none" role="img" aria-label={item.name}>
              🍽️
            </span>
          )}

          {/* Out of Stock Overlay on Image */}
          {isPhysicalOutOfStock && (
            <div className="absolute inset-0 bg-black/40 dark:bg-black/55 backdrop-blur-[1px] z-10 flex items-center justify-center p-1 pointer-events-none">
              <span className="text-[8px] xs:text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-rose-600 text-white shadow-xs uppercase tracking-wider text-center">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Left-Side Overlapping Floating Badges (DailyMart-Style) */}
        <div className="absolute top-1.5 xs:top-2 -left-1 xs:-left-1.5 z-20 flex flex-col items-start gap-1 pointer-events-none">
          {/* Dynamic Product Offer / Discount Badge: Upper-Left (50% Overlapping Edge) */}
          {isOfferValid && !isPhysicalOutOfStock && (
            <span className="text-[7.5px] xs:text-[8px] sm:text-[8.5px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950 shadow-md border border-white/20 dark:border-black/20 whitespace-nowrap">
              {discountPercentage}% OFF
            </span>
          )}

          {/* Low Stock Badge: Left-Side (Below Offer Badge, High Contrast) */}
          {isLowStock && !isPhysicalOutOfStock && (
            <span className="text-[7.5px] xs:text-[8px] sm:text-[8.5px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-amber-600 text-white dark:bg-amber-500 dark:text-zinc-950 shadow-md border border-white/20 dark:border-black/20 whitespace-nowrap">
              {rawAvailable} LEFT
            </span>
          )}
        </div>

        {/* Veg / Non-Veg Dietary Badge: Top-Right */}
        {item.foodType && (
          <div className="absolute top-1 right-1 xs:top-1.5 xs:right-1.5 z-10 pointer-events-none bg-white/95 dark:bg-black/85 rounded-md p-0.5 backdrop-blur-xs shadow-xs border border-black/5 dark:border-white/10 flex items-center justify-center">
            <VegBadge type={item.foodType} size="sm" />
          </div>
        )}

        {/* Popular / Signature Tag: Bottom-Right */}
        {(isPopular || isFeatured) && !isPhysicalOutOfStock && (
          <div className="absolute bottom-1 right-1 xs:bottom-1.5 xs:right-1.5 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-0.5 text-[8px] xs:text-[8.5px] sm:text-[9px] font-bold px-1 xs:px-1.5 sm:px-2 py-0.5 rounded-md bg-black/80 text-white dark:bg-[#D4AF37] dark:text-black shadow-xs backdrop-blur-xs">
              {isFeatured ? 'Signature' : 'Popular'}
            </span>
          </div>
        )}
      </div>

      {/* Card Info: Below square image */}
      <div className="pt-1.5 xs:pt-2 sm:pt-2.5 flex flex-col justify-between flex-1 min-w-0">
        <div className="h-8 xs:h-9 sm:h-10 flex items-center overflow-hidden">
          <h4 className="font-bold text-[11px] xs:text-xs sm:text-sm text-text-primary dark:text-white line-clamp-2 leading-tight" title={item.name}>
            {item.name}
          </h4>
        </div>

        {/* Price & Add Action Row */}
        <div className="mt-auto pt-1 xs:pt-1.5 sm:pt-2 flex items-center justify-between gap-1 border-t border-border/40 dark:border-white/5 shrink-0">
          <div className="shrink-0 flex items-baseline gap-0.5 xs:gap-1 min-w-0">
            <span className="text-[11px] xs:text-xs sm:text-sm md:text-base font-extrabold text-primary dark:text-[#D4AF37] whitespace-nowrap">
              ₹{numFinalPrice}
            </span>
            {hasDiscount && (
              <span className="text-[9px] xs:text-[10px] sm:text-xs text-text-muted dark:text-zinc-500 line-through whitespace-nowrap">
                ₹{numBasePrice}
              </span>
            )}
          </div>

          <div className="shrink-0 h-5 xs:h-6 sm:h-7 flex items-center justify-end">
            {isPhysicalOutOfStock ? (
              <span className="h-full inline-flex items-center text-[8px] xs:text-[8.5px] sm:text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 whitespace-nowrap">
                Out of Stock
              </span>
            ) : isOrderingDisabled ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddClick();
                }}
                aria-label={`Ordering locked for ${item.name}`}
                title="Ordering is currently locked"
                className="h-full px-2 xs:px-2.5 sm:px-3 rounded-full border border-border/80 bg-zinc-100 dark:bg-white/10 text-text-muted dark:text-zinc-400 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 font-extrabold text-[9.5px] xs:text-[10px] sm:text-xs transition-colors flex items-center justify-center gap-0.5 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap"
              >
                LOCKED
              </button>
            ) : isReservedOutForOthers && cartQuantity === 0 ? (
              <span className="h-full inline-flex items-center text-[8px] xs:text-[8.5px] sm:text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 whitespace-nowrap">
                Reserved
              </span>
            ) : cartQuantity > 0 ? (
              <div className="h-full flex items-center gap-0.5 xs:gap-1 sm:gap-1.5 px-1 xs:px-1.5 sm:px-2 rounded-full border border-primary text-primary dark:border-[#D4AF37] dark:text-[#D4AF37] bg-primary/10 dark:bg-[#D4AF37]/10 shadow-2xs whitespace-nowrap">
                <button
                  type="button"
                  onClick={handleDecrement}
                  aria-label={`Decrease quantity of ${item.name}`}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full hover:bg-primary/20 dark:hover:bg-[#D4AF37]/20 transition-colors cursor-pointer shrink-0"
                >
                  <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
                <span className="text-[10px] xs:text-[11px] sm:text-xs font-black min-w-[8px] xs:min-w-[10px] sm:min-w-[12px] text-center">
                  {cartQuantity}
                </span>
                <button
                  type="button"
                  disabled={isMaxReached}
                  onClick={handleIncrement}
                  aria-label={`Increase quantity of ${item.name}`}
                  title={isMaxReached ? `Only ${effectivePurchasableForCustomer} available in stock` : undefined}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full hover:bg-primary/20 dark:hover:bg-[#D4AF37]/20 transition-colors cursor-pointer shrink-0 ${
                    isMaxReached ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''
                  }`}
                >
                  <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isReservedOutForOthers}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddClick();
                }}
                aria-label={`Add ${item.name} to order`}
                title={
                  isReservedOutForOthers
                    ? 'Currently reserved in other customers\' carts'
                    : undefined
                }
                className={`h-full px-2 xs:px-2.5 sm:px-3 rounded-full border font-extrabold text-[9.5px] xs:text-[10px] sm:text-xs transition-colors flex items-center justify-center gap-0.5 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap ${
                  isReservedOutForOthers
                    ? 'border-border/60 bg-black/5 dark:bg-white/5 text-text-muted dark:text-zinc-500 opacity-60 cursor-not-allowed pointer-events-none'
                    : 'border-primary text-primary hover:bg-primary hover:text-white dark:border-[#D4AF37] dark:text-[#D4AF37] dark:hover:bg-[#D4AF37] dark:hover:text-black focus-visible:outline-primary dark:focus-visible:outline-[#D4AF37]'
                }`}
              >
                {isReservedOutForOthers ? 'RESERVED' : hasModifiers ? 'ADD +' : 'ADD'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
