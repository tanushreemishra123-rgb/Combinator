/** Simple expand/collapse section for secondary detail (rationale, trade-offs, raw data, ...). */
import { useId, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ChevronRightIcon } from './icons';

export interface DisclosureProps {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Disclosure({ summary, children, defaultOpen = false }: DisclosureProps): ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="disclosure">
      <button
        type="button"
        className="disclosure-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronRightIcon className={`disclosure-chevron${open ? ' disclosure-chevron-open' : ''}`} />
        <span>{summary}</span>
      </button>
      {open ? (
        <div id={contentId} className="disclosure-content">
          {children}
        </div>
      ) : null}
    </div>
  );
}
