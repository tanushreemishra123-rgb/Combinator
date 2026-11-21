/** Sticky section outline for the 14-section PRD document (spec: a readable document with an outline). */
import type { ReactElement } from 'react';
import type { PrdSection } from '../../domain';

export interface DocumentOutlineProps {
  sections: PrdSection[];
}

export function DocumentOutline({ sections }: DocumentOutlineProps): ReactElement {
  return (
    <nav className="prd-outline" aria-label="Product Requirements Document sections">
      {sections.map((section) => (
        <a key={section.id} href={`#prd-section-${section.id}`} className="prd-outline-link">
          {section.title}
        </a>
      ))}
    </nav>
  );
}
