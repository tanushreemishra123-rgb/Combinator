/**
 * PRD and Scope Workspace root (spec "PRD and Scope Workspace" / Functional Requirements
 * "2. PRD and Functional Scope Generation"): review the customer-grounded PRD, its functional-scope
 * decomposition, and the requirement-coverage view that lets a reviewer confirm cross-document
 * consistency without comparing documents by hand. Reads everything through the state hooks - no
 * local copies of session data, only the tab and grouping selections a reviewer is mid-way through.
 */
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { selectCoverage, selectStageStatuses, useActiveSession, useActions, useBusy } from '../../state';
import { BusyOverlay, Callout, EmptyState, Tabs } from '../common';
import type { TabItem } from '../common';
import { FileTextIcon } from '../common/icons';
import { useWorkspaceNavigation } from '../navigation';
import { CoverageTab } from './CoverageTab';
import { DocumentTab } from './DocumentTab';
import { FunctionalScopeTab } from './FunctionalScopeTab';
import { PrdWorkspaceHeader } from './PrdWorkspaceHeader';
import './prd.css';

const TAB_ITEMS: TabItem[] = [
  { id: 'document', label: 'Product Requirements Document' },
  { id: 'scope', label: 'Functional Scope' },
  { id: 'coverage', label: 'Requirement Coverage' },
];

type PrdTabId = (typeof TAB_ITEMS)[number]['id'];

function isPrdTabId(value: string): value is PrdTabId {
  return TAB_ITEMS.some((item) => item.id === value);
}

export function PrdWorkspace(): ReactElement {
  const session = useActiveSession();
  const actions = useActions();
  const busy = useBusy();
  const navigation = useWorkspaceNavigation();
  const [activeTab, setActiveTab] = useState<PrdTabId>('document');

  const stage = useMemo(
    () => (session === null ? null : (selectStageStatuses(session).find((entry) => entry.stageId === 'prd') ?? null)),
    [session],
  );
  const coverage = useMemo(() => (session === null ? null : selectCoverage(session)), [session]);

  if (session === null) {
    return <EmptyState icon={<FileTextIcon />} title="No active session" message="Create or open a scoping session to work on its PRD." />;
  }

  if (stage === null) {
    return (
      <Callout tone="danger" title="PRD stage unavailable">
        Could not determine the PRD stage status for this session.
      </Callout>
    );
  }

  const bundle = session.outputs.prd.data;
  const meta = session.outputs.prd.meta;
  const hasData = bundle !== null;
  const isBusy = busy?.stageId === 'prd';

  function handleSelectRequirement(id: string): void {
    navigation.navigate('requirements', id);
  }

  function handleGenerate(): void {
    void actions.generateStage('prd');
  }

  function handleToggleReviewed(reviewed: boolean): void {
    actions.setStageReviewed('prd', reviewed);
  }

  return (
    <div className="prd-workspace stack stack-lg">
      <PrdWorkspaceHeader stage={stage} meta={meta} hasData={hasData} busy={isBusy} onGenerate={handleGenerate} onToggleReviewed={handleToggleReviewed} />
      <BusyOverlay active={isBusy} label="Generating the PRD...">
        <Tabs
          items={TAB_ITEMS}
          activeId={activeTab}
          onChange={(id) => {
            if (isPrdTabId(id)) {
              setActiveTab(id);
            }
          }}
          ariaLabel="PRD and Scope Workspace sections"
        >
          {(id) => {
            if (id === 'scope') {
              return <FunctionalScopeTab bundle={bundle} prerequisite={stage.prerequisite} onSelectRequirement={handleSelectRequirement} />;
            }
            if (id === 'coverage') {
              return <CoverageTab bundle={bundle} coverage={coverage} prerequisite={stage.prerequisite} onSelectRequirement={handleSelectRequirement} />;
            }
            return <DocumentTab bundle={bundle} prerequisite={stage.prerequisite} onSelectRequirement={handleSelectRequirement} />;
          }}
        </Tabs>
      </BusyOverlay>
    </div>
  );
}
