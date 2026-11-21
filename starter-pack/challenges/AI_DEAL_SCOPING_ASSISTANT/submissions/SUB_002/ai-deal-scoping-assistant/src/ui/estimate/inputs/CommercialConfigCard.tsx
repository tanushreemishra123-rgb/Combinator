/**
 * "Commercial configuration" (spec 5, "Contingency percentage", "Productivity assumptions", "Team
 * composition", "Required environments"): the visible, editable assumptions every ROM commercial
 * range is computed from.
 */
import type { ReactElement } from 'react';
import type { EstimationConfig } from '../../../domain';
import { Card, Field, NumberInput, Select } from '../../common';
import type { SelectOption } from '../../common';
import { useBlankTracking } from './blankTracking';

export interface CommercialConfigCardProps {
  config: EstimationConfig;
  disabled: boolean;
  onChange: (patch: Partial<EstimationConfig>) => void;
}

type CommercialFieldKey = 'contingencyPct' | 'productivityFactor' | 'teamSize' | 'workingDaysPerWeek' | 'roundingUnit' | 'baselineEnvironments' | 'extraEnvironmentPct';

/** "Required" error text for a blanked field, naming the value the estimate keeps using meanwhile. */
function requiredError(committed: number): string {
  return `Required - the estimate keeps using ${committed} until a value is entered.`;
}

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'INR', label: 'INR - Indian Rupee' },
];

export function CommercialConfigCard({ config, disabled, onChange }: CommercialConfigCardProps): ReactElement {
  const blank = useBlankTracking<CommercialFieldKey>();

  return (
    <Card title="Commercial configuration" subtitle="Currency, contingency and productivity assumptions the ROM commercials are computed from.">
      <div className="estimate-form-grid">
        <Field label="Currency" hint="Day rates are entered in this currency; changing it relabels the rate card - it does not convert the figures.">
          {(props) => <Select {...props} value={config.currency} options={CURRENCY_OPTIONS} disabled={disabled} onChange={(value) => onChange({ currency: value })} />}
        </Field>
        <Field
          label="Contingency %"
          hint={blank.isBlank('contingencyPct') ? undefined : 'Added to the priced subtotal to produce the ROM.'}
          error={blank.isBlank('contingencyPct') ? requiredError(config.contingencyPct) : undefined}
        >
          {(props) => (
            <NumberInput
              {...props}
              value={blank.displayValue('contingencyPct', config.contingencyPct)}
              min={0}
              max={100}
              disabled={disabled}
              onChange={(value) => blank.handleChange('contingencyPct', value, (next) => onChange({ contingencyPct: next }))}
            />
          )}
        </Field>
        <Field
          label="Productivity factor"
          hint={blank.isBlank('productivityFactor') ? undefined : 'Below 1 is faster than baseline, e.g. 0.9 for AI-assisted delivery.'}
          error={blank.isBlank('productivityFactor') ? requiredError(config.productivityFactor) : undefined}
        >
          {(props) => (
            <NumberInput
              {...props}
              value={blank.displayValue('productivityFactor', config.productivityFactor)}
              min={0.1}
              step={0.05}
              disabled={disabled}
              onChange={(value) => blank.handleChange('productivityFactor', value, (next) => onChange({ productivityFactor: next }))}
            />
          )}
        </Field>
        <Field
          label="Team size"
          hint={blank.isBlank('teamSize') ? undefined : 'Average people working in parallel; converts effort into calendar time.'}
          error={blank.isBlank('teamSize') ? requiredError(config.teamSize) : undefined}
        >
          {(props) => (
            <NumberInput
              {...props}
              value={blank.displayValue('teamSize', config.teamSize)}
              min={1}
              disabled={disabled}
              onChange={(value) => blank.handleChange('teamSize', value, (next) => onChange({ teamSize: next }))}
            />
          )}
        </Field>
        <Field label="Working days per week" error={blank.isBlank('workingDaysPerWeek') ? requiredError(config.workingDaysPerWeek) : undefined}>
          {(props) => (
            <NumberInput
              {...props}
              value={blank.displayValue('workingDaysPerWeek', config.workingDaysPerWeek)}
              min={1}
              max={7}
              disabled={disabled}
              onChange={(value) => blank.handleChange('workingDaysPerWeek', value, (next) => onChange({ workingDaysPerWeek: next }))}
            />
          )}
        </Field>
        <Field
          label="Rounding unit"
          hint={blank.isBlank('roundingUnit') ? undefined : 'ROM totals are rounded to this value, e.g. 1,000.'}
          error={blank.isBlank('roundingUnit') ? requiredError(config.roundingUnit) : undefined}
        >
          {(props) => (
            <NumberInput
              {...props}
              value={blank.displayValue('roundingUnit', config.roundingUnit)}
              min={1}
              disabled={disabled}
              onChange={(value) => blank.handleChange('roundingUnit', value, (next) => onChange({ roundingUnit: next }))}
            />
          )}
        </Field>
        <Field
          label="Baseline environments"
          hint={blank.isBlank('baselineEnvironments') ? undefined : 'Environments included before the extra-environment uplift applies.'}
          error={blank.isBlank('baselineEnvironments') ? requiredError(config.baselineEnvironments) : undefined}
        >
          {(props) => (
            <NumberInput
              {...props}
              value={blank.displayValue('baselineEnvironments', config.baselineEnvironments)}
              min={0}
              disabled={disabled}
              onChange={(value) => blank.handleChange('baselineEnvironments', value, (next) => onChange({ baselineEnvironments: next }))}
            />
          )}
        </Field>
        <Field
          label="Extra-environment %"
          hint={blank.isBlank('extraEnvironmentPct') ? undefined : 'Effort uplift applied per environment beyond the baseline.'}
          error={blank.isBlank('extraEnvironmentPct') ? requiredError(config.extraEnvironmentPct) : undefined}
        >
          {(props) => (
            <NumberInput
              {...props}
              value={blank.displayValue('extraEnvironmentPct', config.extraEnvironmentPct)}
              min={0}
              disabled={disabled}
              onChange={(value) => blank.handleChange('extraEnvironmentPct', value, (next) => onChange({ extraEnvironmentPct: next }))}
            />
          )}
        </Field>
      </div>
    </Card>
  );
}
