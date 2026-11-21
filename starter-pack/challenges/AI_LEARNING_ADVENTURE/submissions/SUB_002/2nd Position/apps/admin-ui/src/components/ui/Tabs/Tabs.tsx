import { createContext, useContext, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { cx } from '../cx';
import styles from './Tabs.module.scss';

interface TabsContextValue {
  activeValue: string;
  select: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be used within Tabs`);
  }
  return context;
}

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}

export function Tabs({ defaultValue, value, onValueChange, className, children }: TabsProps) {
  const baseId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const activeValue = value ?? internalValue;

  const select = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ activeValue, select, baseId }}>
      <div className={cx(styles.tabs, className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  'aria-label'?: string;
  className?: string;
  children: ReactNode;
}

export function TabList({ className, children, 'aria-label': ariaLabel }: TabListProps) {
  const { select } = useTabsContext('TabList');
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);

    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = currentIndex === -1 ? tabs.length - 1 : (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    if (!nextTab) return;
    nextTab.focus();
    const nextValue = nextTab.dataset.tabValue;
    if (nextValue !== undefined) {
      select(nextValue);
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cx(styles.list, className)}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export interface TabTriggerProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function TabTrigger({ value, disabled = false, className, children }: TabTriggerProps) {
  const { activeValue, select, baseId } = useTabsContext('TabTrigger');
  const active = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-trigger-${value}`}
      aria-selected={active}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      data-tab-value={value}
      className={cx(styles.trigger, active && styles.active, className)}
      onClick={() => select(value)}
    >
      {children}
    </button>
  );
}

export interface TabContentProps {
  value: string;
  className?: string;
  children: ReactNode;
}

export function TabContent({ value, className, children }: TabContentProps) {
  const { activeValue, baseId } = useTabsContext('TabContent');
  const active = activeValue === value;

  if (!active) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-trigger-${value}`}
      tabIndex={0}
      className={cx(styles.panel, className)}
    >
      {children}
    </div>
  );
}

export { Tabs as TabsRoot };
