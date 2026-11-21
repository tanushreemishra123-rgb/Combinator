/**
 * "Product Requirements Document" tab (spec "PRD and Scope Workspace"): all 14 PRD sections in
 * order as a readable document with a sticky section outline; every statement shows its
 * ContentLabelBadge and RefChips, and user journeys get their own persona/step-list rendering.
 */
import type { ReactElement } from 'react';
import type { PrdBundle, PrdDocument } from '../../domain';
import { SectionHeader, TracedStatementList } from '../common';
import { DocumentOutline } from './DocumentOutline';
import { JourneyList } from './JourneyList';
import { PrdEmptyState } from './PrdEmptyState';

export interface DocumentTabProps {
  bundle: PrdBundle | null;
  prerequisite: string | null;
  onSelectRequirement: (id: string) => void;
}

interface DocumentBodyProps {
  prd: PrdDocument;
  onSelectRequirement: (id: string) => void;
}

function DocumentBody({ prd, onSelectRequirement }: DocumentBodyProps): ReactElement {
  return (
    <div className="prd-document-layout">
      <DocumentOutline sections={prd.sections} />
      <div className="prd-document-content stack stack-lg">
        <h2 className="prd-document-title">{prd.title}</h2>
        {prd.sections.map((section) => (
          <section key={section.id} id={`prd-section-${section.id}`} className="prd-document-section" aria-label={section.title}>
            <SectionHeader as="h3" title={section.title} />
            {section.id === 'journeys' ? (
              <JourneyList journeys={prd.journeys} onSelectRequirement={onSelectRequirement} />
            ) : (
              <TracedStatementList
                statements={section.statements}
                onSelectRef={onSelectRequirement}
                emptyMessage="Nothing recorded for this section yet."
              />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export function DocumentTab({ bundle, prerequisite, onSelectRequirement }: DocumentTabProps): ReactElement {
  if (bundle === null) {
    return <PrdEmptyState prerequisite={prerequisite} />;
  }
  return <DocumentBody prd={bundle.prd} onSelectRequirement={onSelectRequirement} />;
}
