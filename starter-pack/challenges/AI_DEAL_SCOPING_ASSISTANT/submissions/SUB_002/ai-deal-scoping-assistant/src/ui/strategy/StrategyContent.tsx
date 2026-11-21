/**
 * Main layout for the Data, Integration, and AI Workspace (spec 4): two stage-status cards (data +
 * integration, AI solution) above three tabs, each gated by the state layer's own prerequisite and
 * staleness rules rather than re-implementing that logic here.
 */
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { stagePrerequisite, useActions, useBusy } from '../../state';
import type { BoundUseCases } from '../../state';
import type { ScopingSession } from '../../domain';
import { BusyOverlay, SectionHeader, Tabs } from '../common';
import type { TabItem } from '../common';
import { useWorkspaceNavigation } from '../navigation';
import { AiSolutionTab } from './AiSolutionTab';
import { DataStrategyTab } from './DataStrategyTab';
import { IntegrationTab } from './IntegrationTab';
import { StageSummaryCard } from './StageSummaryCard';
import { buildStageView } from './stageInfo';
import { isStrategyTabId } from './types';
import type { StrategyTabId } from './types';

export interface StrategyContentProps {
  session: ScopingSession;
}

const TAB_ITEMS: TabItem[] = [
  { id: 'data-strategy', label: 'Data strategy' },
  { id: 'integration-architecture', label: 'Integration architecture' },
  { id: 'ai-solution', label: 'AI solution approach' },
];

function renderTabContent(
  id: StrategyTabId,
  session: ScopingSession,
  dataPrerequisite: string | null,
  aiPrerequisite: string | null,
  aiSelectDisabled: boolean,
  onSelectRequirement: (id: string) => void,
  actions: BoundUseCases,
): ReactElement {
  if (id === 'data-strategy') {
    return <DataStrategyTab plan={session.outputs.dataIntegration.data} prerequisite={dataPrerequisite} onSelectRequirement={onSelectRequirement} />;
  }
  if (id === 'integration-architecture') {
    return (
      <IntegrationTab
        plan={session.outputs.dataIntegration.data}
        design={session.outputs.architecture.data}
        prerequisite={dataPrerequisite}
        onSelectRequirement={onSelectRequirement}
      />
    );
  }
  return (
    <AiSolutionTab
      strategy={session.outputs.aiStrategy.data}
      prerequisite={aiPrerequisite}
      providerPreference={session.config.aiProviderPreference}
      providerSelectDisabled={aiSelectDisabled}
      onChangeProviderPreference={(value) => void actions.updateSolutionConfig({ aiProviderPreference: value })}
      onSelectRequirement={onSelectRequirement}
    />
  );
}

export function StrategyContent({ session }: StrategyContentProps): ReactElement {
  const actions = useActions();
  const busy = useBusy();
  const navigation = useWorkspaceNavigation();
  const [activeTab, setActiveTab] = useState<StrategyTabId>('data-strategy');
  const [lastFocusId, setLastFocusId] = useState<string | null>(null);

  // Switches to the requested tab whenever a new cross-workspace focus request arrives, computed
  // during render (React's documented "adjust state on prop change" pattern) rather than in an
  // effect, so it reacts only to a genuinely new focusId and never loops.
  if (navigation.focusId !== lastFocusId) {
    setLastFocusId(navigation.focusId);
    if (navigation.focusId !== null && isStrategyTabId(navigation.focusId)) {
      setActiveTab(navigation.focusId);
    }
  }

  const dataPrerequisite = stagePrerequisite(session, 'dataIntegration');
  const aiPrerequisite = stagePrerequisite(session, 'aiStrategy');
  const dataView = useMemo(
    () => buildStageView(session.outputs.dataIntegration, 'dataIntegration', dataPrerequisite, busy),
    [session.outputs.dataIntegration, dataPrerequisite, busy],
  );
  const aiView = useMemo(
    () => buildStageView(session.outputs.aiStrategy, 'aiStrategy', aiPrerequisite, busy),
    [session.outputs.aiStrategy, aiPrerequisite, busy],
  );

  function goToRequirement(requirementId: string): void {
    navigation.navigate('requirements', requirementId);
  }

  return (
    <div className="stack stack-lg strategy-workspace">
      <SectionHeader
        eyebrow="Review the data, integration and AI solution strategy"
        title="Data, Integration, and AI Workspace"
        description="Plan how data and systems connect, and where AI is the right tool versus a deterministic rule or a human decision."
      />
      <div className="strategy-stage-row">
        <StageSummaryCard
          title="Data and integration strategy"
          description="Data domains, the ten data-management topics, and the integration inventory."
          actionLabel="Plan the data flow"
          regenerateLabel="Regenerate data and integration strategy"
          view={dataView}
          onGenerate={() => void actions.generateStage('dataIntegration')}
          onToggleReviewed={(reviewed) => actions.setStageReviewed('dataIntegration', reviewed)}
        />
        <StageSummaryCard
          title="AI solution approach"
          description="AI use cases, the AI/deterministic/human-decision split, and framework recommendations."
          actionLabel="Select the AI approach"
          regenerateLabel="Regenerate AI solution approach"
          view={aiView}
          onGenerate={() => void actions.generateStage('aiStrategy')}
          onToggleReviewed={(reviewed) => actions.setStageReviewed('aiStrategy', reviewed)}
        />
      </div>
      <Tabs items={TAB_ITEMS} activeId={activeTab} onChange={(id) => (isStrategyTabId(id) ? setActiveTab(id) : undefined)} ariaLabel="Data, integration and AI strategy sections">
        {(id) => (
          <BusyOverlay active={id === 'ai-solution' ? aiView.isBusy : dataView.isBusy} label="Generating...">
            {renderTabContent(
              isStrategyTabId(id) ? id : 'data-strategy',
              session,
              dataPrerequisite,
              aiPrerequisite,
              aiView.isBusy,
              goToRequirement,
              actions,
            )}
          </BusyOverlay>
        )}
      </Tabs>
    </div>
  );
}
