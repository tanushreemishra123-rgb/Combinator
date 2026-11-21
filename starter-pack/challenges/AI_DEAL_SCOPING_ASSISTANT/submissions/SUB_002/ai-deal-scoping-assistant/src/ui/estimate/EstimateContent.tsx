/**
 * Main layout of the Estimate Workspace: the header (generate/regenerate, stale banner) is followed
 * immediately by the summary tiles and deadline assessment once an estimate exists - so a reviewer
 * sees the result before scrolling past a single input - then the estimation-inputs panel (always
 * visible, even before anything has been generated, since those inputs feed the estimate), then
 * every remaining generated section in the order the spec lists them.
 */
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { Complexity, RoleId } from '../../domain';
import type { EstimationConfig, SolutionConfig } from '../../domain';
import { selectPendingActions, stagePrerequisite, useActions, useBusy } from '../../state';
import type { ScopingSession } from '../../domain';
import { describeTimelineCalculation } from '../../estimation';
import { BusyOverlay, EmptyState } from '../common';
import { useWorkspaceNavigation } from '../navigation';
import { EstimateHeader } from './header/EstimateHeader';
import { EstimationInputsPanel } from './inputs/EstimationInputsPanel';
import { buildEstimateHeaderView, findEstimatePendingAction, isRecalculateOnly } from './estimateView';
import { SummaryTiles } from './summary/SummaryTiles';
import { PhasesSection } from './phases/PhasesSection';
import { WorkstreamsSection } from './workstreams/WorkstreamsSection';
import { RolesSkillsSection } from './roles/RolesSkillsSection';
import { ConfidenceSection } from './confidence/ConfidenceSection';
import { RisksSection } from './risks/RisksSection';
import { CalculationRulesSection } from './rules/CalculationRulesSection';
import { HistoricalReferencesSection } from './historical/HistoricalReferencesSection';

export interface EstimateContentProps {
  session: ScopingSession;
}

export function EstimateContent({ session }: EstimateContentProps): ReactElement {
  const actions = useActions();
  const busy = useBusy();
  const navigation = useWorkspaceNavigation();

  const prerequisite = stagePrerequisite(session, 'estimate');
  const headerView = useMemo(() => buildEstimateHeaderView(session.outputs.estimate, prerequisite, busy), [session.outputs.estimate, prerequisite, busy]);
  const pendingAction = useMemo(() => findEstimatePendingAction(selectPendingActions(session)), [session]);
  const bundle = session.outputs.estimate.data;
  const result = bundle?.result ?? null;

  function goToRequirement(requirementId: string): void {
    navigation.navigate('requirements', requirementId);
  }

  function handleStaleAction(): void {
    if (isRecalculateOnly(pendingAction)) {
      void actions.regenerateStale('estimate');
      return;
    }
    void actions.generateStage('estimate');
  }

  function handleChangeSolutionConfig(patch: Partial<SolutionConfig>): void {
    void actions.updateSolutionConfig(patch);
  }

  function handleChangeEstimationConfig(patch: Partial<EstimationConfig>): void {
    void actions.updateEstimationConfig(patch);
  }

  function handleChangeRoleRate(roleId: RoleId, dayRate: number | null): void {
    void actions.setRoleRate(roleId, dayRate);
  }

  return (
    <div className="stack stack-lg estimate-workspace">
      <EstimateHeader
        view={headerView}
        pendingAction={pendingAction}
        computedAt={result?.computedAt ?? null}
        onGenerate={() => void actions.generateStage('estimate')}
        onStaleAction={handleStaleAction}
        onToggleReviewed={(reviewed) => actions.setStageReviewed('estimate', reviewed)}
      />
      {result !== null ? (
        <BusyOverlay active={headerView.isBusy} label="Estimating the delivery...">
          <SummaryTiles totals={result.totals} confidence={result.confidence} deadlineAssessment={result.deadlineAssessment} />
        </BusyOverlay>
      ) : null}
      <EstimationInputsPanel
        session={session}
        disabled={headerView.isBusy}
        onChangeSolutionConfig={handleChangeSolutionConfig}
        onChangeEstimationConfig={handleChangeEstimationConfig}
        onChangeRoleRate={handleChangeRoleRate}
        onApplyPreset={(presetId) => void actions.applyCommercialPreset(presetId)}
      />
      <BusyOverlay active={headerView.isBusy} label="Estimating the delivery...">
        {result === null ? (
          <EmptyState
            title="No estimate yet"
            message="Estimate the delivery above to see the effort range, timeline, ROM commercials, workstreams, roles and confidence assessment."
          />
        ) : (
          <div className="stack stack-lg">
            <PhasesSection phases={result.phases} deadlineWeeks={session.config.deliveryDeadlineWeeks} timelineCalculation={describeTimelineCalculation(result, result.configSnapshot)} />
            <WorkstreamsSection
              workstreams={result.workstreams}
              explanation={result.explanation}
              currency={session.estimationConfig.currency}
              disabled={headerView.isBusy}
              onSelectRequirement={goToRequirement}
              onSetDriverComplexity={(driverId: string, complexity: Complexity) => void actions.setDriverComplexity(driverId, complexity)}
            />
            <RolesSkillsSection roleSummary={result.roleSummary} workstreams={result.workstreams} currency={session.estimationConfig.currency} />
            <ConfidenceSection missingInputs={result.missingInputs} onSelectRequirement={goToRequirement} />
            <RisksSection risks={result.risks} dependencies={result.dependencies} assumptions={result.assumptions} exclusions={result.exclusions} onSelectRequirement={goToRequirement} />
            <CalculationRulesSection rules={result.rules} configSnapshot={result.configSnapshot} />
          </div>
        )}
      </BusyOverlay>
      <HistoricalReferencesSection />
    </div>
  );
}
