/**
 * "Calculation rules" (spec 5 constraints: "reproducible ... from documented calculation rules"):
 * the full rule table exported with every package, plus the exact configuration snapshot the
 * numbers on screen were computed from - which can differ from the live configuration while the
 * estimate is stale.
 */
import type { ReactElement } from 'react';
import type { CalculationRule, EstimationConfig } from '../../../domain';
import { Card, DataTable, KeyValueList } from '../../common';
import type { DataTableColumn } from '../../common';

export interface CalculationRulesSectionProps {
  rules: CalculationRule[];
  configSnapshot: EstimationConfig;
}

const COLUMNS: DataTableColumn<CalculationRule>[] = [
  { id: 'id', header: 'ID', render: (rule) => rule.id },
  { id: 'name', header: 'Rule', render: (rule) => rule.name },
  { id: 'formula', header: 'Formula', render: (rule) => <code className="calculation-rule-formula">{rule.formula}</code> },
  { id: 'description', header: 'Description', render: (rule) => rule.description },
];

function snapshotItems(config: EstimationConfig): { key: string; value: string }[] {
  return [
    { key: 'Currency', value: config.currency },
    { key: 'Contingency %', value: `${config.contingencyPct}%` },
    { key: 'Productivity factor', value: config.productivityFactor.toFixed(2) },
    { key: 'Team size', value: `${config.teamSize}` },
    { key: 'Working days per week', value: `${config.workingDaysPerWeek}` },
    { key: 'Rounding unit', value: `${config.roundingUnit}` },
    { key: 'Baseline environments', value: `${config.baselineEnvironments}` },
    { key: 'Extra-environment %', value: `${config.extraEnvironmentPct}%` },
  ];
}

export function CalculationRulesSection({ rules, configSnapshot }: CalculationRulesSectionProps): ReactElement {
  return (
    <Card title="Calculation rules" subtitle="The documented rules every effort, timeline and ROM figure is derived from, and the exact configuration snapshot used.">
      <div className="stack stack-md">
        <DataTable caption="Documented calculation rules" columns={COLUMNS} rows={rules} getRowId={(rule) => rule.id} />
        <div>
          <p className="estimate-subheading text-sm">Configuration snapshot used</p>
          <KeyValueList columns={2} items={snapshotItems(configSnapshot)} />
        </div>
      </div>
    </Card>
  );
}
