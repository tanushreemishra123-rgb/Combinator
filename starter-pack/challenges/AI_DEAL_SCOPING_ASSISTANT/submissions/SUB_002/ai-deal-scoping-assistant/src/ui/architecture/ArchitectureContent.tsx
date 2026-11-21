/**
 * Main layout for the Architecture Workspace (spec "Architecture Workspace" + Functional
 * Requirements 3 "Cloud Solution Architecture"): cloud-platform selection and its transparent
 * recommendation above the Design/Redesign action, then the diagram, components,
 * security/deployment and traceability tabs. Reads everything through the state hooks - the
 * session is the single source of truth; only the active tab and the selected node are local state.
 */
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { recommendPlatform } from '../../architecture';
import type { ArchitectureComponent, ScopingSession } from '../../domain';
import { selectCoverage, selectStageStatuses, useActions, useBusy } from '../../state';
import { BusyOverlay, Callout, Tabs } from '../common';
import type { TabItem } from '../common';
import { useWorkspaceNavigation } from '../navigation';
import { ArchitectureStageHeader } from './ArchitectureStageHeader';
import { ComponentDetailDrawer } from './ComponentDetailDrawer';
import { ComponentsTab } from './ComponentsTab';
import { DiagramTab } from './DiagramTab';
import { PlatformSection } from './PlatformSection';
import { SecurityDeploymentTab } from './SecurityDeploymentTab';
import { isArchitectureTabId } from './tabs';
import type { ArchitectureTabId } from './tabs';
import { TraceabilityTab } from './TraceabilityTab';
import './architecture.css';

export interface ArchitectureContentProps {
  session: ScopingSession;
}

const TAB_ITEMS: TabItem[] = [
  { id: 'diagram', label: 'Architecture diagram' },
  { id: 'components', label: 'Application components and cloud services' },
  { id: 'security', label: 'Security and deployment' },
  { id: 'traceability', label: 'Requirement traceability' },
];

function findComponent(components: readonly ArchitectureComponent[], id: string | null): ArchitectureComponent | null {
  return id === null ? null : (components.find((component) => component.id === id) ?? null);
}

export function ArchitectureContent({ session }: ArchitectureContentProps): ReactElement {
  const actions = useActions();
  const busy = useBusy();
  const navigation = useWorkspaceNavigation();
  const [activeTab, setActiveTab] = useState<ArchitectureTabId>('diagram');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [lastFocusId, setLastFocusId] = useState<string | null>(null);

  // Switches to the requested tab whenever a new cross-workspace focus request arrives, computed
  // during render (React's documented "adjust state on prop change" pattern) rather than in an
  // effect, so it reacts only to a genuinely new focusId and never loops.
  if (navigation.focusId !== lastFocusId) {
    setLastFocusId(navigation.focusId);
    if (navigation.focusId !== null && isArchitectureTabId(navigation.focusId)) {
      setActiveTab(navigation.focusId);
    }
  }

  const stage = useMemo(() => selectStageStatuses(session).find((entry) => entry.stageId === 'architecture') ?? null, [session]);
  const coverage = useMemo(() => selectCoverage(session), [session]);
  const recommendation = useMemo(
    () => (session.scope === null ? null : recommendPlatform(session.scope, session.config)),
    [session.scope, session.config],
  );

  if (stage === null) {
    return (
      <Callout tone="danger" title="Architecture stage unavailable">
        Could not determine the architecture stage status for this session.
      </Callout>
    );
  }

  const design = session.outputs.architecture.data;
  const meta = session.outputs.architecture.meta;
  const isBusy = busy?.stageId === 'architecture';
  const selectedComponent = findComponent(design?.components ?? [], selectedComponentId);
  const prerequisite = stage.prerequisite;

  function goToRequirement(id: string): void {
    navigation.navigate('requirements', id);
  }

  function selectNode(nodeId: string): void {
    if (design !== null && design.components.some((component) => component.id === nodeId)) {
      setSelectedComponentId(nodeId);
    }
  }

  function renderTab(id: ArchitectureTabId): ReactElement {
    if (id === 'components') {
      return <ComponentsTab design={design} scope={session.scope} prerequisite={prerequisite} onSelectRequirement={goToRequirement} />;
    }
    if (id === 'security') {
      return <SecurityDeploymentTab design={design} prerequisite={prerequisite} onSelectRequirement={goToRequirement} />;
    }
    if (id === 'traceability') {
      return (
        <TraceabilityTab
          design={design}
          coverage={coverage}
          meta={meta}
          prerequisite={prerequisite}
          onSelectRequirement={goToRequirement}
          onSelectComponent={setSelectedComponentId}
        />
      );
    }
    return <DiagramTab design={design} prerequisite={prerequisite} onSelectNode={selectNode} />;
  }

  return (
    <div className="architecture-workspace stack stack-lg">
      <ArchitectureStageHeader
        stage={stage}
        meta={meta}
        hasData={design !== null}
        busy={isBusy}
        onGenerate={() => void actions.generateStage('architecture')}
        onToggleReviewed={(reviewed) => actions.setStageReviewed('architecture', reviewed)}
      />
      <PlatformSection
        config={session.config}
        recommendation={recommendation}
        disabled={isBusy}
        onSelectPlatform={(platform) => void actions.updateSolutionConfig({ cloudPlatform: platform, cloudSelectionMode: 'user-selected' })}
        onSelectRecommend={() => void actions.updateSolutionConfig({ cloudSelectionMode: 'recommend' })}
        onSelectRequirement={goToRequirement}
      />
      <BusyOverlay active={isBusy} label="Designing the solution...">
        <Tabs
          items={TAB_ITEMS}
          activeId={activeTab}
          onChange={(id) => (isArchitectureTabId(id) ? setActiveTab(id) : undefined)}
          ariaLabel="Architecture Workspace sections"
        >
          {(id) => renderTab(isArchitectureTabId(id) ? id : 'diagram')}
        </Tabs>
      </BusyOverlay>
      <ComponentDetailDrawer
        component={selectedComponent}
        platform={design === null ? 'aws' : design.platform}
        scope={session.scope}
        onClose={() => setSelectedComponentId(null)}
        onSelectRequirement={goToRequirement}
      />
    </div>
  );
}
