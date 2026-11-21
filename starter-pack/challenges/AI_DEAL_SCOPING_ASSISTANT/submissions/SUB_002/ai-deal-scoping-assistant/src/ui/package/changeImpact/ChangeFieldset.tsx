/** One small, focused field group per change type (spec 6's ten example changes); kept out of ChangeForm to stay within the file/function size limits. */
import type { ReactElement } from 'react';
import { platformLabel } from '../../../architecture';
import { CloudPlatformSchema, ComplexitySchema, PrioritySchema } from '../../../domain';
import type { ScopingSession } from '../../../domain';
import { getItemsByKind, getRequirements } from '../../../scope';
import { Callout, Field, NumberInput, Select, TextArea } from '../../common';
import type { SelectOption } from '../../common';
import type { ChangeDraft } from './changeTypes';
import { inclusionCandidates, integrationDrivers } from './changeTypes';

export interface FieldsetProps {
  draft: ChangeDraft;
  session: ScopingSession;
  onChange: (patch: Partial<ChangeDraft>) => void;
}

const AI_PROVIDER_OPTIONS: SelectOption[] = [
  { value: 'cloud-native', label: 'Cloud-native AI services' },
  { value: 'openai', label: 'OpenAI models' },
  { value: 'anthropic', label: 'Anthropic models' },
  { value: 'open-source', label: 'Open-source models' },
  { value: 'no-preference', label: 'No preference' },
];

function numberField(value: string, onChange: (next: string) => void): { value: number | null; onChange: (next: number | null) => void } {
  return { value: value === '' ? null : Number(value), onChange: (next) => onChange(next === null ? '' : String(next)) };
}

function CloudPlatformFields({ draft, onChange }: FieldsetProps): ReactElement {
  const options = CloudPlatformSchema.options.map((platform): SelectOption => ({ value: platform, label: platformLabel(platform) }));
  return (
    <Field label="New cloud platform" hint="The architecture and diagram regenerate against this platform's service catalog.">
      {(control) => <Select {...control} value={draft.cloudPlatform} options={options} onChange={(value) => onChange({ cloudPlatform: value as ChangeDraft['cloudPlatform'] })} />}
    </Field>
  );
}

function ExpectedUsersFields({ draft, onChange }: FieldsetProps): ReactElement {
  const field = numberField(draft.expectedUsers, (value) => onChange({ expectedUsers: value }));
  return (
    <Field label="New expected user volume" hint="Whole number of registered or concurrent users, as configured today.">
      {(control) => <NumberInput {...control} {...field} min={1} />}
    </Field>
  );
}

function requirementOptions(items: readonly { id: string; title: string }[]): SelectOption[] {
  return items.map((item) => ({ value: item.id, label: `${item.id} - ${item.title}` }));
}

function RequirementPriorityFields({ draft, session, onChange }: FieldsetProps): ReactElement {
  const requirements = session.scope === null ? [] : getRequirements(session.scope);
  if (requirements.length === 0) {
    return <Callout tone="warning">No reviewed requirements are available to reprioritise yet.</Callout>;
  }
  const priorityOptions = PrioritySchema.options.map((priority): SelectOption => ({ value: priority, label: priority }));
  return (
    <>
      <Field label="Requirement">
        {(control) => <Select {...control} value={draft.requirementId} options={requirementOptions(requirements)} onChange={(value) => onChange({ requirementId: value })} />}
      </Field>
      <Field label="New priority">
        {(control) => <Select {...control} value={draft.priority} options={priorityOptions} onChange={(value) => onChange({ priority: value as ChangeDraft['priority'] })} />}
      </Field>
    </>
  );
}

function DeliveryDeadlineFields({ draft, onChange }: FieldsetProps): ReactElement {
  const field = numberField(draft.deadlineWeeks, (value) => onChange({ deadlineWeeks: value }));
  return (
    <Field label="New delivery deadline (weeks from today)">{(control) => <NumberInput {...control} {...field} min={1} />}</Field>
  );
}

function IntegrationComplexityFields({ draft, session, onChange }: FieldsetProps): ReactElement {
  const drivers = integrationDrivers(session);
  if (drivers.length === 0) {
    return <Callout tone="warning">No integration drivers exist yet - generate the effort estimate first.</Callout>;
  }
  const complexityOptions = ComplexitySchema.options.map((complexity): SelectOption => ({ value: complexity, label: complexity }));
  return (
    <>
      <Field label="Integration driver">
        {(control) => (
          <Select {...control} value={draft.integrationDriverId} options={requirementOptions(drivers.map((driver) => ({ id: driver.id, title: driver.label })))} onChange={(value) => onChange({ integrationDriverId: value })} />
        )}
      </Field>
      <Field label="New complexity">
        {(control) => <Select {...control} value={draft.integrationComplexity} options={complexityOptions} onChange={(value) => onChange({ integrationComplexity: value as ChangeDraft['integrationComplexity'] })} />}
      </Field>
    </>
  );
}

function SecurityRequirementFields({ draft, session, onChange }: FieldsetProps): ReactElement {
  const items = session.scope === null ? [] : getItemsByKind(session.scope, 'security');
  if (items.length === 0) {
    return <Callout tone="warning">No security or compliance requirements are in the reviewed scope yet.</Callout>;
  }
  return (
    <>
      <Field label="Security requirement">
        {(control) => <Select {...control} value={draft.securityItemId} options={requirementOptions(items)} onChange={(value) => onChange({ securityItemId: value, securityText: items.find((item) => item.id === value)?.description ?? '' })} />}
      </Field>
      <Field label="New requirement text" hint="Replaces the requirement's description.">
        {(control) => <TextArea {...control} value={draft.securityText} onChange={(value) => onChange({ securityText: value })} />}
      </Field>
    </>
  );
}

function AiProviderPreferenceFields({ draft, onChange }: FieldsetProps): ReactElement {
  return (
    <Field label="New AI-provider preference">
      {(control) => <Select {...control} value={draft.aiProviderPreference} options={AI_PROVIDER_OPTIONS} onChange={(value) => onChange({ aiProviderPreference: value as ChangeDraft['aiProviderPreference'] })} />}
    </Field>
  );
}

function RateCardFields({ draft, session, onChange }: FieldsetProps): ReactElement {
  const rates = session.estimationConfig.rates;
  const roleOptions = rates.map((rate): SelectOption => ({ value: rate.roleId, label: rate.label }));
  const field = numberField(draft.rateAmount, (value) => onChange({ rateAmount: value }));
  return (
    <>
      <Field label="Role">
        {(control) => <Select {...control} value={draft.rateRoleId} options={roleOptions} onChange={(value) => onChange({ rateRoleId: value as ChangeDraft['rateRoleId'] })} />}
      </Field>
      <Field label="New day rate" hint={`In ${session.estimationConfig.currency}.`}>
        {(control) => <NumberInput {...control} {...field} min={1} />}
      </Field>
    </>
  );
}

function ContingencyFields({ draft, onChange }: FieldsetProps): ReactElement {
  const field = numberField(draft.contingencyPct, (value) => onChange({ contingencyPct: value }));
  return <Field label="New contingency (%)">{(control) => <NumberInput {...control} {...field} min={0} step={1} />}</Field>;
}

function ScopeInclusionFields({ draft, session, onChange }: FieldsetProps): ReactElement {
  const candidates = inclusionCandidates(session);
  if (candidates.length === 0) {
    return <Callout tone="warning">No requirements are available to include or exclude yet.</Callout>;
  }
  const inclusionOptions: SelectOption[] = [
    { value: 'include', label: 'Include in scope' },
    { value: 'exclude', label: 'Exclude from scope' },
  ];
  return (
    <>
      <Field label="Requirement">
        {(control) => <Select {...control} value={draft.scopeItemId} options={requirementOptions(candidates)} onChange={(value) => onChange({ scopeItemId: value })} />}
      </Field>
      <Field label="New scope inclusion">
        {(control) => <Select {...control} value={draft.scopeInclusion} options={inclusionOptions} onChange={(value) => onChange({ scopeInclusion: value as ChangeDraft['scopeInclusion'] })} />}
      </Field>
    </>
  );
}

/** Renders only the fields relevant to the draft's currently selected change type. */
export function ChangeFieldset(props: FieldsetProps): ReactElement {
  switch (props.draft.type) {
    case 'cloud-platform':
      return <CloudPlatformFields {...props} />;
    case 'expected-users':
      return <ExpectedUsersFields {...props} />;
    case 'requirement-priority':
      return <RequirementPriorityFields {...props} />;
    case 'delivery-deadline':
      return <DeliveryDeadlineFields {...props} />;
    case 'integration-complexity':
      return <IntegrationComplexityFields {...props} />;
    case 'security-requirement':
      return <SecurityRequirementFields {...props} />;
    case 'ai-provider-preference':
      return <AiProviderPreferenceFields {...props} />;
    case 'rate-card':
      return <RateCardFields {...props} />;
    case 'contingency':
      return <ContingencyFields {...props} />;
    case 'scope-inclusion':
      return <ScopeInclusionFields {...props} />;
  }
}
