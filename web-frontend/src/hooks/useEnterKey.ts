import { useEffect, useRef } from 'react';

export interface UseEnterKeyOptions {
  /**
   * Whether the listener is currently enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * If true, prevents the default browser behavior on Enter keydown
   * @default true
   */
  preventDefault?: boolean;

  /**
   * If true, stops propagation of the keydown event
   * @default false
   */
  stopPropagation?: boolean;

  /**
   * If true, allows triggering even when the active element is a <textarea>
   * Strictly false by default per Enter Concept standard
   * @default false
   */
  allowInTextarea?: boolean;

  /**
   * If true, ignores Enter when any HTML modifier key (Shift, Ctrl, Alt, Meta) is pressed
   * @default true
   */
  ignoreWithModifiers?: boolean;

  /**
   * Guard condition; if true, Enter key press will be ignored (e.g., during API submission or when disabled)
   */
  disabled?: boolean;

  /**
   * Optional target container or element ref. If omitted, listens globally on window.
   */
  targetRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Reusable hook for the Pegs N Bottles "Enter Concept" standard.
 * Safely handles Enter key triggers while protecting form textareas,
 * submission state, and native modifier inputs.
 */
export const useEnterKey = (
  handler: (event: KeyboardEvent) => void,
  options: UseEnterKeyOptions = {}
) => {
  const {
    enabled = true,
    preventDefault = true,
    stopPropagation = false,
    allowInTextarea = false,
    ignoreWithModifiers = true,
    disabled = false,
    targetRef,
  } = options;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;

      // Ignore if modifier keys are pressed (e.g., Shift+Enter, Ctrl+Enter) unless specifically configured
      if (ignoreWithModifiers && (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)) {
        return;
      }

      // Check active focused element to protect multi-line textareas and contentEditable editors
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl) {
        const tagName = activeEl.tagName?.toUpperCase();
        const isContentEditable = activeEl.isContentEditable;

        if (!allowInTextarea && (tagName === 'TEXTAREA' || isContentEditable)) {
          return;
        }

        // If active element is a native submit button or clickable button, allow standard native click if already focused
        if (tagName === 'BUTTON' && activeEl.getAttribute('type') === 'submit') {
          return;
        }
      }

      if (preventDefault) {
        event.preventDefault();
      }
      if (stopPropagation) {
        event.stopPropagation();
      }

      handlerRef.current(event);
    };

    const target = targetRef ? targetRef.current : window;
    if (!target) return;

    target.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      target.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [enabled, disabled, preventDefault, stopPropagation, allowInTextarea, ignoreWithModifiers, targetRef]);
};
