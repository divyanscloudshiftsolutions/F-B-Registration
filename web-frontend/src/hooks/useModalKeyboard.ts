import { useEffect, useCallback } from 'react';

export interface UseModalKeyboardOptions {
  isOpen: boolean;
  onConfirm?: () => void | Promise<void>;
  onClose?: () => void;
  isSubmitting?: boolean;
  confirmDisabled?: boolean;
  allowInTextarea?: boolean;
}

/**
 * Standardized modal keyboard hook for Pegs N Bottles Enter Concept.
 * - Enter: Executes primary confirm action (guarded against active textarea/inputs & submitting state)
 * - Escape: Closes/cancels the modal
 */
export function useModalKeyboard({
  isOpen,
  onConfirm,
  onClose,
  isSubmitting = false,
  confirmDisabled = false,
  allowInTextarea = false,
}: UseModalKeyboardOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl) {
        const tagName = activeEl.tagName?.toUpperCase();
        if (!allowInTextarea && (tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
          return;
        }
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (onClose && !isSubmitting) {
          onClose();
        }
      } else if (event.key === 'Enter') {
        if (!confirmDisabled && !isSubmitting && onConfirm) {
          // If active element is an explicit Cancel button, don't override its click
          if (activeEl?.getAttribute('data-modal-action') === 'cancel') {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onConfirm();
        }
      }
    },
    [isOpen, onConfirm, onClose, isSubmitting, confirmDisabled, allowInTextarea]
  );

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);
}
