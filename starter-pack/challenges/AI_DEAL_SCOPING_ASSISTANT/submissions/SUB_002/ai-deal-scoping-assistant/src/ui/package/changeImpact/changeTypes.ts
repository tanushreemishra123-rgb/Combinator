/**
 * The change-impact form's draft model: the spec's ten example change types (spec 6,
 * "Change-Impact Handling"), each turned into a `SessionMutation` the state layer diffs and
 * analyses. Every builder returns `null` when its fields are incomplete so the form can disable
 * "Preview impact" instead of sending a no-op edit.
 */
import { getActiveItems, getItemsByKind, getRequirements, updateScopeItem } from '../../../scope';
import type {
  AiProviderPreference,
  CloudPlatform,
  Complexity,
  DriverSuggestion,
  Priority,
  RoleId,
  ScopeItem,
  ScopeModel,
  ScopingSession,
} from '../../../domain';
import { REQUIREMENT_KINDS } from '../../../domain';
import type { SessionMutation } from '../../../state';

export type ChangeTypeId =
  | 'cloud-platform'
  | 'expected-users'
  | 'requirement-priority'
  | 'delivery-deadline'
  | 'integration-complexity'
  | 'security-requirement'
  | 'ai-provider-preference'
  | 'rate-card'
  | 'contingency'
  | 'scope-inclusion';

export interface ChangeTypeOption {
  id: ChangeTypeId;
  label: string;
}

export const CHANGE_TYPE_OPTIONS: readonly ChangeTypeOption[] = [
  { id: 'cloud-platform', label: 'Cloud platform' },
  { id: 'expected-users', label: 'Expected user volume' },
  { id: 'requirement-priority', label: 'Requirement priority' },
  { id: 'delivery-deadline', label: 'Delivery deadline' },
  { id: 'integration-complexity', label: 'Integration complexity' },
  { id: 'security-requirement', label: 'Security requirement text' },
  { id: 'ai-provider-preference', label: 'AI-provider preference' },
  { id: 'rate-card', label: 'Rate card' },
  { id: 'contingency', label: 'Contingency' },
  { id: 'scope-inclusion', label: 'Scope inclusion or exclusion' },
];

export interface ChangeDraft {
  type: ChangeTypeId;
  cloudPlatform: CloudPlatform;
  expectedUsers: string;
  requirementId: string;
  priority: Priority;
  deadlineWeeks: string;
  integrationDriverId: string;
  integrationComplexity: Complexity;
  securityItemId: string;
  securityText: string;
  aiProviderPreference: AiProviderPreference;
  rateRoleId: RoleId | '';
  rateAmount: string;
  contingencyPct: string;
  scopeItemId: string;
  scopeInclusion: 'include' | 'exclude';
}

/** Requirement-kind items a reviewer can toggle in or out of scope, including already-excluded ones. */
export function inclusionCandidates(session: ScopingSession): ScopeItem[] {
  const scope = session.scope;
  if (scope === null) {
    return [];
  }
  return getActiveItems(scope).filter((item) => REQUIREMENT_KINDS.includes(item.kind));
}

/** Estimate drivers of type 'integration' - the only ones the spec's "Integration complexity" change edits. */
export function integrationDrivers(session: ScopingSession): DriverSuggestion[] {
  const bundle = session.outputs.estimate.data;
  if (bundle === null) {
    return [];
  }
  return bundle.suggestion.workstreams.flatMap((workstream) => workstream.drivers).filter((driver) => driver.type === 'integration');
}

function defaultRequirementId(scope: ScopeModel | null): string {
  return scope === null ? '' : (getRequirements(scope).at(0)?.id ?? '');
}

interface DefaultIntegrationDriverFields {
  integrationDriverId: string;
  integrationComplexity: Complexity;
}

/** Defaults the form to the first integration driver, so "Preview impact" works without further input. */
function defaultIntegrationDriverFields(session: ScopingSession): DefaultIntegrationDriverFields {
  const driver = integrationDrivers(session).at(0);
  return { integrationDriverId: driver?.id ?? '', integrationComplexity: driver?.complexity ?? 'Medium' };
}

interface DefaultSecurityFields {
  securityItemId: string;
  securityText: string;
}

function defaultSecurityFields(scope: ScopeModel | null): DefaultSecurityFields {
  const item = scope === null ? undefined : getItemsByKind(scope, 'security').at(0);
  return { securityItemId: item?.id ?? '', securityText: item?.description ?? '' };
}

interface DefaultScopeInclusionFields {
  scopeItemId: string;
  scopeInclusion: 'include' | 'exclude';
}

function defaultScopeInclusionFields(session: ScopingSession): DefaultScopeInclusionFields {
  const candidate = inclusionCandidates(session).at(0);
  return { scopeItemId: candidate?.id ?? '', scopeInclusion: candidate?.inScope === false ? 'include' : 'exclude' };
}

export function createDefaultDraft(session: ScopingSession): ChangeDraft {
  const driverFields = defaultIntegrationDriverFields(session);
  const securityFields = defaultSecurityFields(session.scope);
  const scopeInclusionFields = defaultScopeInclusionFields(session);
  return {
    type: 'cloud-platform',
    cloudPlatform: session.config.cloudPlatform ?? 'aws',
    expectedUsers: session.config.expectedUsers === null ? '' : String(session.config.expectedUsers),
    requirementId: defaultRequirementId(session.scope),
    priority: 'High',
    deadlineWeeks: session.config.deliveryDeadlineWeeks === null ? '' : String(session.config.deliveryDeadlineWeeks),
    integrationDriverId: driverFields.integrationDriverId,
    integrationComplexity: driverFields.integrationComplexity,
    securityItemId: securityFields.securityItemId,
    securityText: securityFields.securityText,
    aiProviderPreference: session.config.aiProviderPreference,
    rateRoleId: session.estimationConfig.rates.at(0)?.roleId ?? '',
    rateAmount: '',
    contingencyPct: String(session.estimationConfig.contingencyPct),
    scopeItemId: scopeInclusionFields.scopeItemId,
    scopeInclusion: scopeInclusionFields.scopeInclusion,
  };
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  return value.trim() === '' || !Number.isFinite(parsed) || parsed <= 0 ? null : Math.round(parsed);
}

function parseNonNegativeNumber(value: string): number | null {
  const parsed = Number(value);
  return value.trim() === '' || !Number.isFinite(parsed) || parsed < 0 ? null : parsed;
}

function buildCloudPlatformChange(draft: ChangeDraft): SessionMutation {
  return (session) => ({ ...session, config: { ...session.config, cloudPlatform: draft.cloudPlatform, cloudSelectionMode: 'user-selected' } });
}

function buildExpectedUsersChange(draft: ChangeDraft): SessionMutation | null {
  const users = parsePositiveInt(draft.expectedUsers);
  return users === null ? null : (session) => ({ ...session, config: { ...session.config, expectedUsers: users } });
}

function buildRequirementPriorityChange(draft: ChangeDraft): SessionMutation | null {
  if (draft.requirementId === '') {
    return null;
  }
  return (session) => (session.scope === null ? session : { ...session, scope: updateScopeItem(session.scope, draft.requirementId, { priority: draft.priority }) });
}

function buildDeliveryDeadlineChange(draft: ChangeDraft): SessionMutation | null {
  const weeks = parsePositiveInt(draft.deadlineWeeks);
  return weeks === null ? null : (session) => ({ ...session, config: { ...session.config, deliveryDeadlineWeeks: weeks } });
}

function buildIntegrationComplexityChange(draft: ChangeDraft): SessionMutation | null {
  if (draft.integrationDriverId === '') {
    return null;
  }
  return (session) => {
    const bundle = session.outputs.estimate.data;
    if (bundle === null) {
      return session;
    }
    const overrides = [...bundle.overrides.filter((override) => override.driverId !== draft.integrationDriverId), { driverId: draft.integrationDriverId, complexity: draft.integrationComplexity }];
    return { ...session, outputs: { ...session.outputs, estimate: { ...session.outputs.estimate, data: { ...bundle, overrides } } } };
  };
}

function buildSecurityRequirementChange(draft: ChangeDraft): SessionMutation | null {
  const text = draft.securityText.trim();
  if (draft.securityItemId === '' || text === '') {
    return null;
  }
  return (session) => (session.scope === null ? session : { ...session, scope: updateScopeItem(session.scope, draft.securityItemId, { description: text }) });
}

function buildAiProviderPreferenceChange(draft: ChangeDraft): SessionMutation {
  return (session) => ({ ...session, config: { ...session.config, aiProviderPreference: draft.aiProviderPreference } });
}

function buildRateCardChange(draft: ChangeDraft): SessionMutation | null {
  const amount = parsePositiveInt(draft.rateAmount);
  if (draft.rateRoleId === '' || amount === null) {
    return null;
  }
  const roleId = draft.rateRoleId;
  return (session) => ({
    ...session,
    estimationConfig: { ...session.estimationConfig, rates: session.estimationConfig.rates.map((rate) => (rate.roleId === roleId ? { ...rate, dayRate: amount } : rate)) },
  });
}

function buildContingencyChange(draft: ChangeDraft): SessionMutation | null {
  const pct = parseNonNegativeNumber(draft.contingencyPct);
  return pct === null ? null : (session) => ({ ...session, estimationConfig: { ...session.estimationConfig, contingencyPct: pct } });
}

function buildScopeInclusionChange(draft: ChangeDraft): SessionMutation | null {
  if (draft.scopeItemId === '') {
    return null;
  }
  const inScope = draft.scopeInclusion === 'include';
  return (session) => (session.scope === null ? session : { ...session, scope: updateScopeItem(session.scope, draft.scopeItemId, { inScope }) });
}

/** Turns a completed draft into a `SessionMutation`, or `null` while required fields are missing. */
export function buildChangeMutation(draft: ChangeDraft): SessionMutation | null {
  switch (draft.type) {
    case 'cloud-platform':
      return buildCloudPlatformChange(draft);
    case 'expected-users':
      return buildExpectedUsersChange(draft);
    case 'requirement-priority':
      return buildRequirementPriorityChange(draft);
    case 'delivery-deadline':
      return buildDeliveryDeadlineChange(draft);
    case 'integration-complexity':
      return buildIntegrationComplexityChange(draft);
    case 'security-requirement':
      return buildSecurityRequirementChange(draft);
    case 'ai-provider-preference':
      return buildAiProviderPreferenceChange(draft);
    case 'rate-card':
      return buildRateCardChange(draft);
    case 'contingency':
      return buildContingencyChange(draft);
    case 'scope-inclusion':
      return buildScopeInclusionChange(draft);
  }
}
