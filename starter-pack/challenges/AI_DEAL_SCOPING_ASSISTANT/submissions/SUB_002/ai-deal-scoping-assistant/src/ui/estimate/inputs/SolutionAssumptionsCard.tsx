/**
 * "Solution assumptions" (spec 5, "Required environments" / constraints): the planning inputs the
 * estimator reads directly from the solution configuration. Left empty they read as 'Not provided'
 * and are reported as a missing estimation input rather than silently defaulted.
 */
import type { ReactElement } from 'react';
import type { SolutionConfig } from '../../../domain';
import type { StatedDeadline } from '../../../estimation';
import { Button, Callout, Card, Field, NumberInput, TextInput } from '../../common';
import { notProvidedHint, parseCommaList } from '../format';

export interface SolutionAssumptionsCardProps {
  config: SolutionConfig;
  disabled: boolean;
  /** A delivery deadline found in the reviewed scope; offered only while the deadline field is empty. */
  statedDeadline?: StatedDeadline | null;
  onChange: (patch: Partial<SolutionConfig>) => void;
}

interface DeadlineSuggestionProps {
  stated: StatedDeadline;
  disabled: boolean;
  onApply: () => void;
}

/** The customer's own deadline is suggested, never applied silently: the estimator only reads what a person confirmed. */
function DeadlineSuggestion({ stated, disabled, onApply }: DeadlineSuggestionProps): ReactElement {
  const conversion = stated.statedAs.endsWith('weeks') || stated.statedAs.endsWith('week') ? '' : ` (about ${stated.weeks} weeks)`;
  return (
    <Callout tone="info" title="Delivery deadline found in the reviewed scope">
      <p>
        {stated.sourceId} states a delivery window of {stated.statedAs}
        {conversion}. Confirm it to get a deadline assessment.
      </p>
      <Button variant="secondary" size="sm" disabled={disabled} onClick={onApply}>
        Use {stated.weeks} weeks
      </Button>
    </Callout>
  );
}

export function SolutionAssumptionsCard({ config, disabled, statedDeadline = null, onChange }: SolutionAssumptionsCardProps): ReactElement {
  const regionsValue = config.targetRegions.join(', ');
  const suggestion = config.deliveryDeadlineWeeks === null ? statedDeadline : null;

  return (
    <Card title="Solution assumptions" subtitle="Planning inputs the estimator reads directly. Leave a field blank when it is genuinely not known yet.">
      <div className="estimate-form-grid">
        <Field label="Expected users" hint={notProvidedHint(config.expectedUsers === null)}>
          {(props) => <NumberInput {...props} value={config.expectedUsers} min={0} disabled={disabled} onChange={(value) => onChange({ expectedUsers: value })} />}
        </Field>
        <Field label="Number of environments" hint={notProvidedHint(config.environments === null)}>
          {(props) => <NumberInput {...props} value={config.environments} min={0} disabled={disabled} onChange={(value) => onChange({ environments: value })} />}
        </Field>
        <Field label="Delivery deadline (weeks)" hint={notProvidedHint(config.deliveryDeadlineWeeks === null)}>
          {(props) => <NumberInput {...props} value={config.deliveryDeadlineWeeks} min={0} disabled={disabled} onChange={(value) => onChange({ deliveryDeadlineWeeks: value })} />}
        </Field>
        <Field label="Target regions" hint={notProvidedHint(config.targetRegions.length === 0) ?? 'Comma-separated, e.g. US, EU'}>
          {(props) => <TextInput {...props} value={regionsValue} disabled={disabled} onChange={(value) => onChange({ targetRegions: parseCommaList(value) })} />}
        </Field>
      </div>
      {suggestion === null ? null : <DeadlineSuggestion stated={suggestion} disabled={disabled} onApply={() => onChange({ deliveryDeadlineWeeks: suggestion.weeks })} />}
    </Card>
  );
}
