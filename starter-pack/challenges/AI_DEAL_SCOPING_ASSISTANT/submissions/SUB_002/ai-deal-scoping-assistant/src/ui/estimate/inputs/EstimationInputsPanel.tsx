/**
 * "Estimation inputs" panel (spec 5): always visible, even before anything has been generated, so
 * the reviewer can see and change every assumption the estimate will be computed from. Every edit
 * goes through the state layer's configuration use cases, which log change impact once an estimate
 * already exists, so the numbers only ever come from visible configuration.
 */
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { EstimationConfig, RoleId, ScopingSession, SolutionConfig } from '../../../domain';
import { findStatedDeadline } from '../../../estimation';
import { Card, Disclosure } from '../../common';
import { BaseEffortTable } from './BaseEffortTable';
import { CommercialConfigCard } from './CommercialConfigCard';
import { CommercialPresetPicker } from './CommercialPresetPicker';
import { ConfidenceSpreadsTable } from './ConfidenceSpreadsTable';
import { PhaseOverheadsTable } from './PhaseOverheadsTable';
import { RateCardTable } from './RateCardTable';
import { RoleMixTable } from './RoleMixTable';
import { SolutionAssumptionsCard } from './SolutionAssumptionsCard';

export interface EstimationInputsPanelProps {
  session: ScopingSession;
  disabled: boolean;
  onChangeSolutionConfig: (patch: Partial<SolutionConfig>) => void;
  onChangeEstimationConfig: (patch: Partial<EstimationConfig>) => void;
  onChangeRoleRate: (roleId: RoleId, dayRate: number | null) => void;
  onApplyPreset: (presetId: string) => void;
}

export function EstimationInputsPanel({
  session,
  disabled,
  onChangeSolutionConfig,
  onChangeEstimationConfig,
  onChangeRoleRate,
  onApplyPreset,
}: EstimationInputsPanelProps): ReactElement {
  const { config, estimationConfig } = session;
  const statedDeadline = useMemo(() => findStatedDeadline(session.scope), [session.scope]);

  return (
    <section className="stack stack-md estimate-inputs-panel" aria-label="Estimation inputs">
      <h3 className="estimate-inputs-title">Estimation inputs</h3>
      <div className="estimate-inputs-grid">
        <SolutionAssumptionsCard config={config} disabled={disabled} statedDeadline={statedDeadline} onChange={onChangeSolutionConfig} />
        <CommercialConfigCard config={estimationConfig} disabled={disabled} onChange={onChangeEstimationConfig} />
      </div>
      <CommercialPresetPicker disabled={disabled} onApply={onApplyPreset} />
      <Card title="Role-based rate card" subtitle="Editable day rate per role. Clearing a rate blocks that role's cost instead of assuming one.">
        <RateCardTable rates={estimationConfig.rates} currency={estimationConfig.currency} disabled={disabled} onChangeRate={onChangeRoleRate} />
      </Card>
      <Card title="Base effort and phase overhead" subtitle="Person-days per driver, and the discovery/testing/deployment overhead applied on top of the build effort.">
        <div className="stack stack-md">
          <BaseEffortTable rows={estimationConfig.baseEffort} disabled={disabled} onChange={(rows) => onChangeEstimationConfig({ baseEffort: rows })} />
          <div>
            <p className="estimate-subheading text-sm">Phase overhead (% of build effort)</p>
            <PhaseOverheadsTable rows={estimationConfig.phaseOverheads} disabled={disabled} onChange={(rows) => onChangeEstimationConfig({ phaseOverheads: rows })} />
          </div>
        </div>
      </Card>
      <Card title="Role mix and confidence spreads" subtitle="Read-only reference tables the effort-by-role and range calculations use.">
        <div className="stack stack-md">
          <Disclosure summary="Role mix by driver type">
            <RoleMixTable rows={estimationConfig.roleMix} rates={estimationConfig.rates} />
          </Disclosure>
          <Disclosure summary="Confidence spreads">
            <ConfidenceSpreadsTable rows={estimationConfig.confidenceSpreads} />
          </Disclosure>
        </div>
      </Card>
    </section>
  );
}
