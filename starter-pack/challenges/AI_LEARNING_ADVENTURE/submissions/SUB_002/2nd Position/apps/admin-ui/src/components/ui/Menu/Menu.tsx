import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

import { cx } from '../cx';
import styles from './Menu.module.scss';

interface MenuContextValue {
  open: boolean;
  positioned: boolean;
  position: { top: number; left: number };
  toggleMenu: () => void;
  closeMenu: (focusTrigger?: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext(component: string): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error(`${component} must be used within Menu`);
  }
  return context;
}

export interface MenuProps {
  align?: 'start' | 'end';
  children: ReactNode;
}

export function Menu({ align = 'end', children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback((focusTrigger = false) => {
    setOpen(false);
    setPositioned(false);
    if (focusTrigger) {
      triggerRef.current?.focus();
    }
  }, []);

  const toggleMenu = useCallback(() => {
    setOpen((previous) => !previous);
    setPositioned(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const margin = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();

    let left = align === 'end' ? triggerRect.right - contentRect.width : triggerRect.left;
    left = Math.min(Math.max(left, margin), Math.max(margin, window.innerWidth - contentRect.width - margin));

    let top = triggerRect.bottom + 4;
    if (top + contentRect.height > window.innerHeight - margin) {
      top = Math.max(margin, triggerRect.top - contentRect.height - 4);
    }

    setPosition({ top, left });
    setPositioned(true);
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
      const target = event.target as Node;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
      setPositioned(false);
    };
    const handleViewportChange = () => {
      setOpen(false);
      setPositioned(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [open]);

  return (
    <MenuContext.Provider value={{ open, positioned, position, toggleMenu, closeMenu, triggerRef, contentRef }}>
      <div className={styles.root}>{children}</div>
    </MenuContext.Provider>
  );
}

export interface MenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function MenuTrigger({ className, children, onClick, ...rest }: MenuTriggerProps) {
  const { open, toggleMenu, triggerRef } = useMenuContext('MenuTrigger');

  return (
    <button
      type="button"
      ref={triggerRef}
      aria-haspopup="menu"
      aria-expanded={open}
      className={cx(styles.trigger, className)}
      onClick={(event) => {
        onClick?.(event);
        toggleMenu();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface MenuContentProps {
  className?: string;
  children: ReactNode;
}

export function MenuContent({ className, children }: MenuContentProps) {
  const { open, positioned, position, closeMenu, contentRef } = useMenuContext('MenuContent');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !positioned) return;
    const firstItem = contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)');
    firstItem?.focus();
  }, [open, positioned, contentRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const content = contentRef.current;
    if (!content) return;
    const items = Array.from(content.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
    if (items.length === 0) return;
    const currentIndex = items.findIndex((item) => item === document.activeElement);

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        closeMenu(true);
        return;
      case 'ArrowDown':
        event.preventDefault();
        (items[(currentIndex + 1) % items.length] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? items[0])?.focus();
        return;
      case 'ArrowUp':
        event.preventDefault();
        (items[currentIndex - 1] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? items[items.length - 1])?.focus();
        return;
      case 'Home':
        event.preventDefault();
        items[0]?.focus();
        return;
      case 'End':
        event.preventDefault();
        items[items.length - 1] /* nosemgrep: gitlab.eslint.detect-object-injection */?.focus();
        return;
      case 'Tab':
        closeMenu(false);
        return;
      default:
        return;
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={contentRef}
      role="menu"
      className={cx(styles.content, className)}
      style={{ top: position.top, left: position.left, visibility: positioned ? 'visible' : 'hidden' }}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>,
    document.body
  );
}

export interface MenuItemProps {
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function MenuItem({ onSelect, disabled = false, destructive = false, icon, className, children }: MenuItemProps) {
  const { closeMenu } = useMenuContext('MenuItem');

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cx(styles.item, destructive && styles.destructive, className)}
      onClick={() => {
        onSelect?.();
        closeMenu(true);
      }}
    >
      {icon ? (
        <span className={styles.itemIcon} aria-hidden="true">
          {icon}
        </span>
      ) : undefined}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className={styles.separator} />;
}
