/**
 * Accessible, controlled tab list following the WAI-ARIA tabs pattern: roving tabindex, arrow-key
 * navigation between enabled tabs, Home/End to jump to the first/last, and a linked tabpanel.
 */
import { useRef } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /** Render-prop so the panel content can depend on which tab is active. */
  children: (activeId: string) => ReactNode;
}

/** Indexes of the enabled tabs, in order - arrow-key navigation skips disabled tabs. */
function enabledIndexes(items: TabItem[]): number[] {
  const result: number[] = [];
  items.forEach((item, index) => {
    if (!item.disabled) {
      result.push(index);
    }
  });
  return result;
}

export function Tabs({ items, activeId, onChange, ariaLabel, children }: TabsProps): ReactElement {
  const listRef = useRef<HTMLDivElement>(null);

  function focusAndSelect(index: number): void {
    const item = items.at(index);
    if (!item) {
      return;
    }
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.item(index)?.focus();
    onChange(item.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const order = enabledIndexes(items);
    const position = order.indexOf(index);
    if (position === -1) {
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = order.at((position + step + order.length) % order.length);
      if (next !== undefined) {
        focusAndSelect(next);
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = order.at(0);
      if (first !== undefined) {
        focusAndSelect(first);
      }
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = order.at(-1);
      if (last !== undefined) {
        focusAndSelect(last);
      }
    }
  }

  return (
    <div className="tabs">
      <div className="tabs-list" role="tablist" aria-label={ariaLabel} ref={listRef}>
        {items.map((item, index) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`tabpanel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              className={`tab${selected ? ' tab-active' : ''}`}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`tabpanel-${activeId}`} aria-labelledby={`tab-${activeId}`} className="tabs-panel" tabIndex={0}>
        {children(activeId)}
      </div>
    </div>
  );
}
