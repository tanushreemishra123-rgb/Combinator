import { useEffect, useRef, type RefObject } from 'react';

export interface UseFocusReturnOptions {
  open: boolean;
  triggerId?: string;
  trapFocus?: boolean;
}

export interface UseFocusReturnResult<T extends HTMLElement> {
  overlayRef: RefObject<T | null>;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function resolveTrigger(triggerId?: string): HTMLElement | null {
  if (triggerId !== undefined) {
    const trigger = document.getElementById(triggerId);
    if (trigger !== null) return trigger;
  }
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function useFocusReturn<T extends HTMLElement>({
  open,
  triggerId,
  trapFocus = false,
}: UseFocusReturnOptions): UseFocusReturnResult<T> {
  const overlayRef = useRef<T | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = resolveTrigger(triggerId);
    const overlay = overlayRef.current;
    if (overlay !== null) {
      if (overlay.getAttribute('tabindex') === null) {
        overlay.setAttribute('tabindex', '-1');
      }
      overlay.focus({ preventScroll: true });
    }

    function handleTrapKeyDown(event: KeyboardEvent) {
      if (!trapFocus || event.key !== 'Tab') return;
      const container = overlayRef.current;
      if (container === null) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      const active = document.activeElement;
      const inside = active !== null && container.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last?.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleTrapKeyDown);
    return () => {
      document.removeEventListener('keydown', handleTrapKeyDown);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open, triggerId, trapFocus]);

  return { overlayRef };
}
