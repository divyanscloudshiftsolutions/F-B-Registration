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

  const checkScroll = () => {
    const el = rowRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
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
  }, [children]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;
    const scrollAmount = Math.max(300, el.clientWidth * 0.75);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-3 relative">
      {/* Capacity Group Section Heading */}
      <div className="flex items-center justify-between border-b border-border-main/50 pb-2 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#8D6CE5] shadow-sm shadow-[#8D6CE5]/50" />
          <h3 className="text-sm font-black text-text-main uppercase tracking-wider">
            {capacity} {capacity === 1 ? 'Seat Table' : 'Seats Tables'}
          </h3>
        </div>
        <span className="px-3 py-0.5 rounded-full bg-[#8D6CE5]/10 border border-[#8D6CE5]/30 text-[#8D6CE5] text-[10px] font-mono font-extrabold">
          {tableCount} {tableCount === 1 ? 'Table' : 'Tables'}
        </span>
      </div>

      {/* Row Container with Glass Edge Arrows */}
      <div className="relative flex items-center group">
        {/* Circular Left Arrow Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="absolute -left-4 z-30 w-10 h-10 rounded-full glass-panel bg-bg-surface/90 hover:bg-[#8D6CE5] border border-[#8D6CE5]/40 text-[#8D6CE5] hover:text-white shadow-xl hover:shadow-[#8D6CE5]/30 flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
            aria-label="Scroll Left"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Scrollable Row (No Visible Scrollbar) */}
        <div
          ref={rowRef}
          className="flex items-center gap-5 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x no-scrollbar w-full"
        >
          {children}
        </div>

        {/* Circular Right Arrow Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="absolute -right-4 z-30 w-10 h-10 rounded-full glass-panel bg-bg-surface/90 hover:bg-[#8D6CE5] border border-[#8D6CE5]/40 text-[#8D6CE5] hover:text-white shadow-xl hover:shadow-[#8D6CE5]/30 flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
            aria-label="Scroll Right"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
};
