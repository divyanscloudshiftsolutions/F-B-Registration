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
  const isPopular = Boolean(item.popular ?? (item as any).isPopular);
  const isFeatured = Boolean(item.featured ?? (item as any).isFeatured ?? (item as any).isSignature ?? (item as any).signature);
  const displayImage = (item as any).image || item.imageUrl;
  const numBasePrice = Number(item.basePrice);
  const numFinalPrice = Number((item as any).finalPrice ?? item.basePrice);
  const hasDiscount = numFinalPrice < numBasePrice;

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

  // Home Page Variant: Preserved original right-side image layout
  if (variant === 'home') {
    return (
      <div
        onClick={() => onOpenDetails?.(item)}
        className="flex gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border border-primary/30 hover:border-primary/70 dark:border-[#D4AF37]/55 dark:hover:border-[#E5C158] bg-white dark:bg-[#18181B] shadow-xs dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] hover:shadow-md transition-all duration-200 cursor-pointer h-full min-h-[160px] sm:min-h-[165px]"
      >
        {/* Item Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between overflow-hidden">
          <div>
            {/* Badge & Tag Container */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-h-[20px] mb-1 relative z-10">
              {item.foodType && <VegBadge type={item.foodType} size="sm" />}
              {isPopular && (
                <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 dark:bg-[#D4AF37]/15 dark:text-[#E5C158] dark:border-[#D4AF37]/30 shrink-0">
                  <Star className="w-2.5 h-2.5 fill-current" /> Popular
                </span>
              )}
              {isFeatured && (
                <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 dark:bg-[#D4AF37]/15 dark:text-[#E5C158] dark:border-[#D4AF37]/30 shrink-0">
                  <Sparkles className="w-2.5 h-2.5" /> Signature
                </span>
              )}
            </div>
            <h4 className="font-bold text-sm sm:text-base text-text-primary dark:text-white leading-snug line-clamp-1">
              {item.name}
            </h4>
            <p className="text-xs text-text-muted dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed min-h-[2.25rem]">
              {item.description || '\u00A0'}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-1.5 sm:gap-2">
            {hasDiscount ? (
              <>
                <span className="text-sm sm:text-base font-extrabold text-primary dark:text-[#D4AF37]">
                  {hasModifiers ? `from ₹${numFinalPrice}` : `₹${numFinalPrice}`}
                </span>
                <span className="text-xs text-text-muted dark:text-zinc-500 line-through">
                  ₹{numBasePrice}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {item.discountMode === 'PERCENTAGE'
                    ? `${item.discountValue}% OFF`
                    : `₹${item.discountValue} OFF`}
                </span>
              </>
            ) : (
              <span className="text-sm sm:text-base font-extrabold text-primary dark:text-[#D4AF37]">
                {hasModifiers ? `from ₹${numBasePrice}` : `₹${numBasePrice}`}
              </span>
            )}
            {hasModifiers && (
              <span className="text-[10px] text-text-muted dark:text-zinc-400 font-medium">
                Customizable
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Image + Add / Quantity Stepper */}
        <div className="w-22 sm:w-26 shrink-0 flex flex-col items-center justify-between">
          <div
            onClick={(e) => {
              if (displayImage) {
                e.stopPropagation();
                onOpenImageModal?.(displayImage, item.name);
              }
            }}
            title={displayImage ? `View full image of ${item.name}` : undefined}
            className={`w-20 sm:w-24 h-16 sm:h-20 rounded-xl bg-zinc-100 dark:bg-white/5 border border-border/60 dark:border-white/10 flex items-center justify-center text-xs font-semibold text-text-muted overflow-hidden relative group/img ${
              displayImage ? 'cursor-pointer hover:border-primary/60 dark:hover:border-[#D4AF37]/60 hover:scale-105 transition-all' : ''
            }`}
          >
            {displayImage ? (
              <>
                <img src={formatImageUrl(displayImage)} alt={item.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 dark:group-hover/img:bg-black/35 transition-colors flex items-center justify-center pointer-events-none">
                  <span className="opacity-0 group-hover/img:opacity-100 text-[9px] bg-white/95 dark:bg-black/85 text-text-primary dark:text-white px-1.5 py-0.5 rounded-md shadow-xs font-bold transition-opacity">
                    Zoom
                  </span>
                </div>
              </>
            ) : (
              <span className="text-2xl select-none" role="img" aria-label={item.name}>
                🍽️
              </span>
            )}
          </div>

          {!isAvailable ? (
            <span className="mt-2 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
              Out of Stock
            </span>
          ) : cartQuantity > 0 ? (
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddClick();
              }}
              aria-label={`Add ${item.name} to order`}
              className="mt-2 w-full min-h-[36px] py-1.5 px-3 rounded-xl border border-primary text-primary hover:bg-primary hover:text-white dark:border-[#D4AF37] dark:text-[#D4AF37] dark:hover:bg-[#D4AF37] dark:hover:text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:focus-visible:outline-[#D4AF37]"
            >
              {hasModifiers ? 'ADD +' : 'ADD'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Menu Card Template: Image Left, Top Badges, Title, Description, Bottom Price (Left) & Pill Stepper/Add (Right)
  return (
    <div
      onClick={() => onOpenDetails?.(item)}
      className="flex gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-2xl border border-primary/30 hover:border-primary/70 dark:border-[#D4AF37]/40 dark:hover:border-[#E5C158] bg-white dark:bg-[#18181B] shadow-xs dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] hover:shadow-md transition-all duration-200 cursor-pointer h-full"
    >
      {/* Left Side: Food Image Container with gold/subtle border */}
      <div
        onClick={(e) => {
          if (displayImage) {
            e.stopPropagation();
            onOpenImageModal?.(displayImage, item.name);
          }
        }}
        title={displayImage ? `View full image of ${item.name}` : undefined}
        className={`w-20 h-20 sm:w-22 sm:h-22 shrink-0 rounded-xl bg-zinc-100 dark:bg-white/5 border border-border/60 dark:border-[#D4AF37]/35 flex items-center justify-center text-xs font-semibold text-text-muted overflow-hidden relative group/img ${
          displayImage ? 'cursor-pointer hover:border-primary/60 dark:hover:border-[#D4AF37] hover:scale-105 transition-all' : ''
        }`}
      >
        {displayImage ? (
          <>
            <img src={formatImageUrl(displayImage)} alt={item.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 dark:group-hover/img:bg-black/35 transition-colors flex items-center justify-center pointer-events-none">
              <span className="opacity-0 group-hover/img:opacity-100 text-[9px] bg-white/95 dark:bg-black/85 text-text-primary dark:text-white px-1.5 py-0.5 rounded-md shadow-xs font-bold transition-opacity">
                Zoom
              </span>
            </div>
          </>
        ) : (
          <span className="text-xl select-none" role="img" aria-label={item.name}>
            🍽️
          </span>
        )}
      </div>

      {/* Right Side: Details & Action Row */}
      <div className="flex-1 min-w-0 flex flex-col justify-between overflow-hidden">
        <div>
          {/* Badge & Tag Container (VegBadge + Popular / Signature Badge) */}
          <div className="flex items-center gap-1.5 flex-wrap min-h-[16px] mb-0.5 relative z-10">
            {item.foodType && <VegBadge type={item.foodType} size="sm" />}
            {isPopular && (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 dark:bg-[#D4AF37]/15 dark:text-[#E5C158] dark:border-[#D4AF37]/30 shrink-0">
                <Star className="w-2.5 h-2.5 fill-current" /> Popular
              </span>
            )}
            {isFeatured && (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 dark:bg-[#D4AF37]/15 dark:text-[#E5C158] dark:border-[#D4AF37]/30 shrink-0">
                <Sparkles className="w-2.5 h-2.5" /> Signature
              </span>
            )}
          </div>

          {/* Item Name */}
          <h4 className="font-bold text-sm sm:text-base text-text-primary dark:text-white leading-snug line-clamp-1">
            {item.name}
          </h4>

          {/* Item Description (Render only if present, eliminating empty gaps) */}
          {item.description ? (
            <p className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 mt-0.5 line-clamp-2 leading-snug">
              {item.description}
            </p>
          ) : null}
        </div>

        {/* Bottom Action Row: Price (Left) & Capsule Stepper / Add Button (Right) */}
        <div className="mt-1.5 flex items-center justify-between gap-2 pt-0.5">
          {/* Price Container */}
          <div className="flex flex-wrap items-baseline gap-1.5">
            {hasDiscount ? (
              <>
                <span className="text-sm sm:text-base font-extrabold text-primary dark:text-[#D4AF37]">
                  {hasModifiers ? `from ₹${numFinalPrice}` : `₹${numFinalPrice}`}
                </span>
                <span className="text-[10px] sm:text-[11px] text-text-muted dark:text-zinc-500 line-through">
                  ₹{numBasePrice}
                </span>
              </>
            ) : (
              <span className="text-sm sm:text-base font-extrabold text-primary dark:text-[#D4AF37]">
                {hasModifiers ? `from ₹${numBasePrice}` : `₹${numBasePrice}`}
              </span>
            )}
            {hasModifiers && (
              <span className="text-[9px] sm:text-[10px] text-text-muted dark:text-zinc-400 font-medium">
                Customizable
              </span>
            )}
          </div>

          {/* Capsule Stepper / Add Action */}
          <div className="shrink-0">
            {!isAvailable ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                Out of Stock
              </span>
            ) : cartQuantity > 0 ? (
              /* Capsule Stepper with - qty + */
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-primary text-primary dark:border-[#D4AF37] dark:text-[#D4AF37] bg-primary/10 dark:bg-[#D4AF37]/10 shadow-2xs">
                <button
                  type="button"
                  onClick={handleDecrement}
                  aria-label={`Decrease quantity of ${item.name}`}
                  className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full hover:bg-primary/20 dark:hover:bg-[#D4AF37]/20 transition-colors cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-black min-w-[14px] text-center">
                  {cartQuantity}
                </span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  aria-label={`Increase quantity of ${item.name}`}
                  className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full hover:bg-primary/20 dark:hover:bg-[#D4AF37]/20 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              /* Capsule Add Button */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddClick();
                }}
                aria-label={`Add ${item.name} to order`}
                className="min-h-[28px] py-0.5 px-3 rounded-full border border-primary text-primary hover:bg-primary hover:text-white dark:border-[#D4AF37] dark:text-[#D4AF37] dark:hover:bg-[#D4AF37] dark:hover:text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:focus-visible:outline-[#D4AF37]"
              >
                {hasModifiers ? 'ADD +' : 'ADD'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
