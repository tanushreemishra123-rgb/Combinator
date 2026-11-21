import { createContext, useContext, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';

import { cx } from '../cx';
import styles from './Accordion.module.scss';

interface AccordionContextValue {
  expandedValues: string[];
  toggle: (value: string) => void;
  rootRef: RefObject<HTMLDivElement | null>;
  baseId: string;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext(component: string): AccordionContextValue {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error(`${component} must be used within Accordion`);
  }
  return context;
}

const AccordionItemContext = createContext<string | null>(null);

function useAccordionItemContext(component: string): string {
  const value = useContext(AccordionItemContext);
  if (value === null) {
    throw new Error(`${component} must be used within AccordionItem`);
  }
  return value;
}

export interface AccordionProps {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string[]) => void;
  className?: string;
  children: ReactNode;
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function Accordion({
  type = 'single',
  collapsible = true,
  defaultValue,
  value,
  onValueChange,
  className,
  children
}: AccordionProps) {
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [internalValues, setInternalValues] = useState<string[]>(toArray(defaultValue));
  const expandedValues = value !== undefined ? toArray(value) : internalValues;

  const toggle = (next: string) => {
    let updated: string[];
    if (expandedValues.includes(next)) {
      if (type === 'single' && !collapsible) return;
      updated = expandedValues.filter((existing) => existing !== next);
    } else {
      updated = type === 'single' ? [next] : [...expandedValues, next];
    }
    if (value === undefined) {
      setInternalValues(updated);
    }
    onValueChange?.(updated);
  };

  return (
    <AccordionContext.Provider value={{ expandedValues, toggle, rootRef, baseId }}>
      <div ref={rootRef} className={cx(styles.accordion, className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps {
  value: string;
  className?: string;
  children: ReactNode;
}

export function AccordionItem({ value, className, children }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div className={cx(styles.item, className)}>{children}</div>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionHeaderProps {
  className?: string;
  children: ReactNode;
}

export function AccordionHeader({ className, children }: AccordionHeaderProps) {
  const { expandedValues, toggle, rootRef, baseId } = useAccordionContext('AccordionHeader');
  const value = useAccordionItemContext('AccordionHeader');
  const expanded = expandedValues.includes(value);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const headers = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-accordion-trigger]'));
    if (headers.length === 0) return;
    const currentIndex = headers.findIndex((header) => header === event.currentTarget);

    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % headers.length;
        break;
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + headers.length) % headers.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = headers.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    headers[nextIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */?.focus();
  };

  return (
    <h3 className={styles.header}>
      <button
        type="button"
        data-accordion-trigger
        id={`${baseId}-trigger-${value}`}
        aria-expanded={expanded}
        aria-controls={`${baseId}-content-${value}`}
        className={cx(styles.trigger, className)}
        onClick={() => toggle(value)}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.triggerLabel}>{children}</span>
        <span className={cx(styles.chevron, expanded && styles.chevronExpanded)} aria-hidden="true">
          ▾
        </span>
      </button>
    </h3>
  );
}

export interface AccordionContentProps {
  className?: string;
  children: ReactNode;
}

export function AccordionContent({ className, children }: AccordionContentProps) {
  const { expandedValues, baseId } = useAccordionContext('AccordionContent');
  const value = useAccordionItemContext('AccordionContent');
  const expanded = expandedValues.includes(value);

  return (
    <div
      role="region"
      id={`${baseId}-content-${value}`}
      aria-labelledby={`${baseId}-trigger-${value}`}
      hidden={!expanded}
      className={cx(styles.content, className)}
    >
      {children}
    </div>
  );
}
