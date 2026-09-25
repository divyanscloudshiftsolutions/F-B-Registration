import { useState, useCallback } from 'react';

export interface UseRovingSelectionOptions<T> {
  items: T[];
  selectedIndex?: number;
  onSelect?: (item: T, index: number) => void;
  orientation?: 'horizontal' | 'vertical' | 'both';
  columns?: number;
  loop?: boolean;
  enabled?: boolean;
  triggerOnEnter?: boolean;
}

/**
 * Reusable hook for Arrow key navigation and Enter selection across
 * segmented controls, role chips, table grids, and payment methods.
 */
export function useRovingSelection<T>({
  items,
  selectedIndex = 0,
  onSelect,
  orientation = 'horizontal',
  columns = 1,
  loop = true,
  enabled = true,
  triggerOnEnter = true,
}: UseRovingSelectionOptions<T>) {
  const [focusedIndex, setFocusedIndex] = useState<number>(selectedIndex >= 0 ? selectedIndex : 0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent | KeyboardEvent) => {
      if (!enabled || items.length === 0) return;

      const count = items.length;
      let nextIndex = focusedIndex;
      let handled = false;

      const isHorizontal = orientation === 'horizontal' || orientation === 'both';
      const isVertical = orientation === 'vertical' || orientation === 'both';

      switch (event.key) {
        case 'ArrowRight':
          if (isHorizontal) {
            nextIndex = loop ? (focusedIndex + 1) % count : Math.min(count - 1, focusedIndex + 1);
            handled = true;
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            nextIndex = loop ? (focusedIndex - 1 + count) % count : Math.max(0, focusedIndex - 1);
            handled = true;
          }
          break;
        case 'ArrowDown':
          if (isVertical) {
            const step = columns > 1 ? columns : 1;
            nextIndex = focusedIndex + step;
            if (nextIndex >= count) {
              nextIndex = loop ? nextIndex % count : focusedIndex;
            }
            handled = true;
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            const step = columns > 1 ? columns : 1;
            nextIndex = focusedIndex - step;
            if (nextIndex < 0) {
              nextIndex = loop ? (nextIndex + count) % count : focusedIndex;
            }
            handled = true;
          }
          break;
        case 'Home':
          nextIndex = 0;
          handled = true;
          break;
        case 'End':
          nextIndex = count - 1;
          handled = true;
          break;
        case 'Enter':
        case ' ':
          if (triggerOnEnter && focusedIndex >= 0 && focusedIndex < count) {
            event.preventDefault();
            if (onSelect) {
              onSelect(items[focusedIndex], focusedIndex);
            }
            return;
          }
          break;
        default:
          break;
      }

      if (handled) {
        event.preventDefault();
        setFocusedIndex(nextIndex);
        if (onSelect) {
          onSelect(items[nextIndex], nextIndex);
        }
      }
    },
    [enabled, items, focusedIndex, orientation, columns, loop, triggerOnEnter, onSelect]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      tabIndex: index === focusedIndex ? 0 : -1,
      role: 'button',
      'aria-selected': index === selectedIndex,
      onClick: () => {
        setFocusedIndex(index);
        if (onSelect && items[index] !== undefined) {
          onSelect(items[index], index);
        }
      },
      onFocus: () => setFocusedIndex(index),
    }),
    [focusedIndex, selectedIndex, onSelect, items]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getItemProps,
  };
}
