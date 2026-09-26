import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SeatingRowProps {
  capacity: number;
  tableCount: number;
  children: React.ReactNode;
}

export const SeatingRow: React.FC<SeatingRowProps> = ({ capacity, tableCount, children }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [shouldScroll, setShouldScroll] = useState(false);

  const checkScroll = () => {
    const el = rowRef.current;
    if (!el) return;

    // Accurate overflow check based on scrollWidth vs clientWidth
    const isOverflowing = el.scrollWidth > el.clientWidth + 5;
    setShouldScroll(isOverflowing);

    if (isOverflowing) {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    } else {
      setCanScrollLeft(false);
      setCanScrollRight(false);
    }
  };

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    checkScroll();
    const timer = setTimeout(checkScroll, 100);

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [children, tableCount]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;
    const scrollAmount = Math.max(260, el.clientWidth * 0.75);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-2.5 sm:space-y-4 py-2.5 sm:py-4 md:py-6 first:pt-0 border-b border-border-sidebar/30 last:border-b-0 relative">
      {/* Capacity Group Section Heading */}
      <div className="flex items-center justify-between border-b border-border-sidebar/40 pb-1.5 sm:pb-2 px-1">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full dark:bg-[#D4AF37] bg-primary" />
          <h3 className="text-xs sm:text-xs md:text-sm font-black text-text-primary uppercase tracking-wider sm:tracking-widest leading-none">
            {capacity} {capacity === 1 ? 'Seat Table' : 'Seats Tables'}
          </h3>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="px-2.5 sm:px-3 py-0.5 rounded-full dark:bg-[#D4AF37]/10 bg-primary/10 dark:border-[#D4AF37]/30 border-primary/20 dark:text-[#D4AF37] text-primary text-[9px] sm:text-[10px] font-mono font-black">
            {tableCount} {tableCount === 1 ? 'Table' : 'Tables'}
          </span>
          {shouldScroll && (
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border transition-all flex items-center justify-center ${
                  canScrollLeft
                    ? 'text-text-main hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95 border-zinc-200 dark:border-white/15 cursor-pointer shadow-xs'
                    : 'text-text-muted border-zinc-200/50 dark:border-white/5 opacity-30 cursor-not-allowed'
                }`}
                aria-label="Scroll Left"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border transition-all flex items-center justify-center ${
                  canScrollRight
                    ? 'text-text-main hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95 border-zinc-200 dark:border-white/15 cursor-pointer shadow-xs'
                    : 'text-text-muted border-zinc-200/50 dark:border-white/5 opacity-30 cursor-not-allowed'
                }`}
                aria-label="Scroll Right"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row Container */}
      <div className="relative">
        {/* Horizontal Scrollable Row */}
        <div
          ref={rowRef}
          className="pt-1 pb-2 sm:pb-3 w-full flex items-center gap-3 sm:gap-5 overflow-x-auto scroll-smooth snap-x no-scrollbar"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
