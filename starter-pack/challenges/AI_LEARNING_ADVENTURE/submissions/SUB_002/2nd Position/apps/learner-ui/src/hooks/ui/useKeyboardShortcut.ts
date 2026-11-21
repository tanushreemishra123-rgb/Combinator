import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  enabled?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
  if ((shortcut.ctrlKey ?? false) !== event.ctrlKey) return false;
  if ((shortcut.altKey ?? false) !== event.altKey) return false;
  if ((shortcut.shiftKey ?? false) !== event.shiftKey) return false;
  if ((shortcut.metaKey ?? false) !== event.metaKey) return false;
  return true;
}

export function useKeyboardShortcut(
  shortcut: KeyboardShortcut,
  onShortcut: (event: KeyboardEvent) => void,
): void {
  const handlerRef = useRef(onShortcut);
  const { key, ctrlKey, altKey, shiftKey, metaKey, enabled = true } = shortcut;

  useEffect(() => {
    handlerRef.current = onShortcut;
  }, [onShortcut]);

  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, { key, ctrlKey, altKey, shiftKey, metaKey })) return;
      const hasModifier = (ctrlKey ?? false) || (altKey ?? false) || (metaKey ?? false);
      if (!hasModifier && isEditableTarget(event.target)) return;
      event.preventDefault();
      handlerRef.current(event);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, ctrlKey, altKey, shiftKey, metaKey, enabled]);
}
