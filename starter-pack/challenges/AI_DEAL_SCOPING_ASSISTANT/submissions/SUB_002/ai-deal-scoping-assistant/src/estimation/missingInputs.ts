/**
 * Single home of missing-input detection (rule CR_14). A missing input is never replaced by an
 * unsupported value: it either reduces confidence (planning inputs such as expected users or API
 * readiness) or blocks the affected calculation (role day rates, base-effort values, role mix).
 */
import type {
  Complexity,
  DriverType,
  EstimationInputKey,
  MissingEstimationInput,
  RoleId,
  ScopeItem,
  ScopeModel,
  SolutionConfig,
} from '../domain';
import { driverTypeLabel } from './engine/drivers';
import type { MixKey } from './engine/lookups';
import { joinList } from './format';
import { activeItems, citeItem, distinct, openItems } from './scopeFacts';

/** Name of the estimate component affected by inputs that do not belong to a single workstream. */
export const TIMELINE_COMPONENT = 'Timeline';
/**
 * Component named when an open item leaves an input unknown but no workstream can be tied to it, so
 * the input is still reported (and still lowers overall confidence) instead of being dropped.
 */
export const OVERALL_ESTIMATE_COMPONENT = 'Overall estimate';
const WHOLE_ESTIMATE_COMPONENTS: readonly string[] = ['Effort', TIMELINE_COMPONENT, 'ROM commercials'];

/** The facts about one calculated workstream that missing-input detection needs. */
export interface WorkstreamFacts {
  id: string;
  driverTypes: readonly DriverType[];
  /** Requirement and driver reference ids the workstream prices. */
  refIds: readonly string[];
  blockedDrivers: readonly { id: string; type: DriverType; complexity: Complexity }[];
  unpricedRoles: readonly { roleId: RoleId; label: string }[];
  unmixedTypes: readonly MixKey[];
}

export interface MissingInputQuery {
  scope: ScopeModel;
  config: SolutionConfig;
  workstreams: readonly WorkstreamFacts[];
}

export interface ConfidenceLimitation {
  level: 'Low' | 'Medium';
  text: string;
}

interface PlanningInputDefinition {
  key: EstimationInputKey;
  label: string;
  /** Exact wording shown as the confidence limitation of the affected components. */
  limitation: string;
  /** Workstreams with drivers of this type depend on the input; the deadline affects the timeline. */
  affects: DriverType | 'timeline';
  /** Set for inputs supplied through the solution configuration; null when only the scope model can confirm it. */
  isConfigured: ((config: SolutionConfig) => boolean) | null;
}

const PLANNING_INPUTS: readonly PlanningInputDefinition[] = [
  {
    key: 'expectedUsers',
    label: 'Expected number of users',
    limitation: 'The expected number of users has not been confirmed, so infrastructure sizing is provisional.',
    affects: 'infrastructure',
    isConfigured: (config) => config.expectedUsers !== null,
  },
  {
    key: 'environments',
    label: 'Number of environments',
    limitation: 'The number of required environments has not been confirmed, so no environment uplift is applied.',
    affects: 'infrastructure',
    isConfigured: (config) => config.environments !== null,
  },
  {
    key: 'targetRegions',
    label: 'Target deployment regions',
    limitation: 'Target deployment regions have not been confirmed.',
    affects: 'infrastructure',
    isConfigured: (config) => config.targetRegions.length > 0,
  },
  {
    key: 'deliveryDeadline',
    label: 'Delivery deadline',
    limitation: 'The delivery deadline has not been confirmed, so the timeline cannot be checked against a target date.',
    affects: 'timeline',
    isConfigured: (config) => config.deliveryDeadlineWeeks !== null,
  },
  {
    key: 'integrationReadiness',
    label: 'Integration readiness',
    limitation: 'External API readiness has not been confirmed.',
    affects: 'integration',
    isConfigured: null,
  },
  {
    key: 'dataVolume',
    label: 'Data volume and migration scope',
    limitation: 'Data volumes and migration scope have not been confirmed.',
    affects: 'data',
    isConfigured: null,
  },
  {
    key: 'complianceScope',
    label: 'Compliance scope',
    limitation: 'The compliance scope has not been confirmed.',
    affects: 'security',
    isConfigured: null,
  },
  {
    key: 'aiDataAvailability',
    label: 'AI data availability',
    limitation: 'Availability and quality of the data for the AI use cases have not been confirmed.',
    affects: 'ai',
    isConfigured: null,
  },
];

const LIMITATION_BY_KEY: ReadonlyMap<string, string> = new Map(
  PLANNING_INPUTS.map((definition) => [definition.key, definition.limitation]),
);

/** Ids linked to the open items in either direction: the items they cite and the items citing them. */
function linkedIds(scope: ScopeModel, blockers: readonly ScopeItem[]): ReadonlySet<string> {
  const blockerIds = new Set(blockers.map((item) => item.id));
  const citing = activeItems(scope).filter((item) => item.relatedIds.some((id) => blockerIds.has(id)));
  return new Set([...blockers.flatMap((item) => item.relatedIds), ...citing.map((item) => item.id)]);
}

/**
 * When no workstream carries the input's driver type, the open items that leave it unknown still
 * point at the work they concern: the workstreams pricing those requirements are affected, and when
 * none can be tied to them the input is attributed to the overall estimate.
 */
function fallbackComponents(query: MissingInputQuery, blockers: readonly ScopeItem[]): string[] {
  if (blockers.length === 0) {
    return [];
  }
  const linked = linkedIds(query.scope, blockers);
  const sharing = query.workstreams.filter((workstream) => workstream.refIds.some((id) => linked.has(id)));
  return sharing.length > 0 ? sharing.map((workstream) => workstream.id) : [OVERALL_ESTIMATE_COMPONENT];
}

function affectedComponents(
  definition: PlanningInputDefinition,
  query: MissingInputQuery,
  blockers: readonly ScopeItem[],
): string[] {
  if (definition.affects === 'timeline') {
    return [TIMELINE_COMPONENT];
  }
  const type = definition.affects;
  const typed = query.workstreams.filter((workstream) => workstream.driverTypes.includes(type));
  return typed.length > 0 ? typed.map((workstream) => workstream.id) : fallbackComponents(query, blockers);
}

function resolutionAdvice(definition: PlanningInputDefinition, blockers: readonly ScopeItem[]): string {
  const cited = joinList(blockers.map(citeItem));
  if (definition.isConfigured !== null) {
    const related = blockers.length > 0 ? ` and close the related open item (${cited})` : '';
    return `Enter the ${definition.label.toLowerCase()} in the solution configuration${related}; the estimate is recalculated immediately.`;
  }
  return `Confirm the ${definition.label.toLowerCase()} with the customer and resolve ${cited} in the scope model; confidence is restored on the next calculation.`;
}

function detectPlanningInput(definition: PlanningInputDefinition, query: MissingInputQuery): MissingEstimationInput[] {
  const blockers = openItems(query.scope).filter((item) => item.affectsInputs.includes(definition.key));
  const missing = definition.isConfigured === null ? blockers.length > 0 : !definition.isConfigured(query.config);
  const affected = affectedComponents(definition, query, blockers);
  if (!missing || affected.length === 0) {
    return [];
  }
  return [
    {
      key: definition.key,
      label: definition.label,
      effect: 'confidence-reduced',
      affected,
      relatedScopeIds: blockers.map((item) => item.id),
      howToResolve: resolutionAdvice(definition, blockers),
    },
  ];
}

/** Roles that have allocated days but no day rate: their cost is blocked, never defaulted. */
function detectMissingRates(workstreams: readonly WorkstreamFacts[]): MissingEstimationInput[] {
  const roles = new Map(workstreams.flatMap((ws) => ws.unpricedRoles).map((role) => [role.roleId, role.label]));
  return [...roles.entries()].map(([roleId, label]) => ({
    key: 'roleRate',
    label: `Day rate for ${label}`,
    effect: 'calculation-blocked',
    affected: workstreams.filter((ws) => ws.unpricedRoles.some((role) => role.roleId === roleId)).map((ws) => ws.id),
    relatedScopeIds: [],
    howToResolve: `Enter a day rate for ${label} in the rate configuration. No default rate is substituted, so the cost of the affected workstreams and the ROM totals stay blocked until it is provided.`,
  }));
}

function mixLabel(key: MixKey): string {
  return key === 'overhead' ? 'overhead phase' : driverTypeLabel(key);
}

/** Effort without a role mix cannot be split by role, so it cannot be priced either. */
function detectMissingRoleMix(workstreams: readonly WorkstreamFacts[]): MissingEstimationInput[] {
  return distinct(workstreams.flatMap((ws) => ws.unmixedTypes)).map((key) => ({
    key: 'roleRate',
    label: `Role mix for ${mixLabel(key)} effort`,
    effect: 'calculation-blocked',
    affected: workstreams.filter((ws) => ws.unmixedTypes.includes(key)).map((ws) => ws.id),
    relatedScopeIds: [],
    howToResolve: `Add a role mix for ${mixLabel(key)} effort in the estimation configuration so its days can be priced by role.`,
  }));
}

function detectBlockedDrivers(workstreams: readonly WorkstreamFacts[]): MissingEstimationInput[] {
  if (workstreams.every((ws) => ws.driverTypes.length === 0)) {
    return [
      {
        key: 'scopeDrivers',
        label: 'Scope drivers',
        effect: 'calculation-blocked',
        affected: [...WHOLE_ESTIMATE_COMPONENTS],
        relatedScopeIds: [],
        howToResolve: 'Generate the estimate inputs from an approved scope model so that at least one workstream with scope drivers exists.',
      },
    ];
  }
  const blocked = workstreams.flatMap((ws) => ws.blockedDrivers.map((driver) => ({ ...driver, workstreamId: ws.id })));
  const combinations = distinct(blocked.map((driver) => `${driver.complexity} ${driverTypeLabel(driver.type)}`));
  return combinations.map((combination) => {
    const drivers = blocked.filter((driver) => `${driver.complexity} ${driverTypeLabel(driver.type)}` === combination);
    return {
      key: 'scopeDrivers',
      label: `Base effort for ${combination} drivers`,
      effect: 'calculation-blocked',
      affected: distinct(drivers.map((driver) => driver.workstreamId)),
      relatedScopeIds: [],
      howToResolve: `Enter the person-days for ${combination} drivers in the base-effort table; until then ${joinList(drivers.map((driver) => driver.id))} contribute no effort.`,
    };
  });
}

/** All missing estimation inputs, blocking ones first. */
export function detectMissingInputs(query: MissingInputQuery): MissingEstimationInput[] {
  return [
    ...detectBlockedDrivers(query.workstreams),
    ...detectMissingRates(query.workstreams),
    ...detectMissingRoleMix(query.workstreams),
    ...PLANNING_INPUTS.flatMap((definition) => detectPlanningInput(definition, query)),
  ];
}

function blockedLimitation(missing: MissingEstimationInput): string {
  const consequence =
    missing.key === 'roleRate'
      ? 'the cost of this workstream cannot be calculated'
      : 'part of the effort cannot be calculated';
  return `${missing.label} is not configured, so ${consequence}.`;
}

/** True when a gap and a question are linked (in either direction) so they track the same unknown. */
function trackSameUnknown(a: ScopeItem, b: ScopeItem): boolean {
  return a.id !== b.id && (a.relatedIds.includes(b.id) || b.relatedIds.includes(a.id));
}

/**
 * A gap and a question that are related to each other are almost always the same open unknown
 * described twice (once per taxonomy) - cite them together instead of as two separate limitations.
 */
function citeOpenItems(items: readonly ScopeItem[]): string[] {
  const shown = new Set<string>();
  const citations: string[] = [];
  for (const item of items) {
    if (shown.has(item.id)) {
      continue;
    }
    shown.add(item.id);
    const partner = items.find((other) => !shown.has(other.id) && trackSameUnknown(item, other));
    if (partner === undefined) {
      citations.push(citeItem(item));
      continue;
    }
    shown.add(partner.id);
    citations.push(`${citeItem(item)} (tracked together with ${partner.id})`);
  }
  return citations;
}

/**
 * Confidence effect of one missing input on a component it affects: blocked calculations and
 * inputs held open by a *critical* gap or question mean Low; any other missing input means Medium.
 */
export function limitationFor(missing: MissingEstimationInput, scope: ScopeModel): ConfidenceLimitation {
  if (missing.effect === 'calculation-blocked') {
    return { level: 'Low', text: blockedLimitation(missing) };
  }
  const statement = LIMITATION_BY_KEY.get(missing.key) ?? `${missing.label} has not been confirmed.`;
  const related = openItems(scope).filter((item) => missing.relatedScopeIds.includes(item.id));
  const critical = related.filter((item) => item.critical);
  if (critical.length > 0) {
    return { level: 'Low', text: `${statement} Critical and unresolved: ${joinList(citeOpenItems(critical))}.` };
  }
  if (related.length > 0) {
    return { level: 'Medium', text: `${statement} Still open: ${joinList(citeOpenItems(related))}.` };
  }
  return { level: 'Medium', text: statement };
}
