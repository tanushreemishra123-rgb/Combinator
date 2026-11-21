/**
 * Capability drivers (delivery phase PH_2). Complexity is a visible score built from the number of
 * requirements a capability covers, its priority and the demanding signals of those requirements.
 */
import { signalLabel } from '../../domain';
import type { Capability, Complexity, DriverType } from '../../domain';
import { countOf } from '../format';
import { isSecurityWorkstreamName } from './doubleCounting';
import { activeIds, bandScore, citeIds, signalsOf } from './facts';
import type { DriverSeed, PlannerFacts, WorkstreamSeed } from './facts';
import { CAPABILITY_SKILLS } from './skills';

const DEFAULT_WORKSTREAM_NAME = 'Experience and Core Platform';
const CAPABILITY_PHASE = 'PH_2';

/** Signals that make a functional capability materially harder to build and test. */
const DEMANDING_SIGNALS: ReadonlySet<string> = new Set([
  'capability:payments',
  'capability:workflow',
  'capability:search',
  'capability:reporting',
  'capability:scheduling',
  'capability:orders',
  'capability:mobile',
  'capability:messaging',
  'integration:realtime',
  'nfr:offline',
  'ai:assistant',
  'ai:recommendation',
  'ai:extraction',
]);

const REQUIREMENT_COUNT_BANDS = [
  { min: 4, score: 2 },
  { min: 2, score: 1 },
];
const DEMANDING_SIGNAL_BANDS = [
  { min: 3, score: 2 },
  { min: 1, score: 1 },
];
const SCORE_BANDS: readonly { min: number; complexity: Complexity }[] = [
  { min: 4, complexity: 'Very High' },
  { min: 3, complexity: 'High' },
  { min: 1, complexity: 'Medium' },
  { min: 0, complexity: 'Low' },
];

export interface CapabilityPlan {
  workstreams: WorkstreamSeed[];
  /** Recommended enhancements: shown as exclusions until a reviewer accepts them into scope. */
  enhancements: Capability[];
  /** Capabilities whose requirements are all rejected or out of scope. */
  withoutActiveScope: Capability[];
}

/**
 * A capability delivered inside a workstream dedicated to security is security work: it is sized
 * with the security-control base effort and staffed with the security role mix, not the generic
 * front-end-heavy capability mix.
 */
function driverTypeOf(capability: Capability): DriverType {
  return isSecurityWorkstreamName(workstreamNameOf(capability)) ? 'security' : 'capability';
}

function capabilityDriver(capability: Capability, facts: PlannerFacts): DriverSeed {
  const requirementIds = activeIds(capability.requirementIds, facts);
  const demanding = signalsOf(requirementIds, facts).filter((signal) => DEMANDING_SIGNALS.has(signal));
  const score =
    bandScore(requirementIds.length, REQUIREMENT_COUNT_BANDS) +
    bandScore(demanding.length, DEMANDING_SIGNAL_BANDS) +
    (capability.priority === 'High' ? 1 : 0);
  const complexity = SCORE_BANDS.find((band) => score >= band.min)?.complexity ?? 'Low';
  const coverage =
    requirementIds.length > 0
      ? `covers ${countOf(requirementIds.length, 'requirement')} (${citeIds(requirementIds)})`
      : 'is not yet linked to a reviewed requirement';
  const features =
    demanding.length > 0 ? `, and involves demanding features (${demanding.map(signalLabel).join('; ')})` : '';
  return {
    type: driverTypeOf(capability),
    label: capability.name,
    complexity,
    rationale: `${complexity} complexity: ${coverage} at ${capability.priority} priority${features}.`,
    refIds: [capability.id, ...requirementIds],
  };
}

function isEstimable(capability: Capability, facts: PlannerFacts): boolean {
  return capability.requirementIds.length === 0 || activeIds(capability.requirementIds, facts).length > 0;
}

function workstreamNameOf(capability: Capability): string {
  const name = capability.workstream.trim();
  return name === '' ? DEFAULT_WORKSTREAM_NAME : name;
}

/** One workstream per PRD workstream name so the estimate mirrors the Functional Scope structure. */
export function planCapabilityWorkstreams(facts: PlannerFacts): CapabilityPlan {
  const committed = facts.context.capabilities.filter((capability) => capability.label !== 'out-of-scope');
  const enhancements = committed.filter((capability) => capability.label === 'recommended-enhancement');
  const requested = committed.filter((capability) => capability.label !== 'recommended-enhancement');
  const estimable = requested.filter((capability) => isEstimable(capability, facts));
  const names = [...new Set(estimable.map(workstreamNameOf))];
  return {
    workstreams: names.map((name) => ({
      name,
      phaseId: CAPABILITY_PHASE,
      drivers: estimable.filter((capability) => workstreamNameOf(capability) === name).map((c) => capabilityDriver(c, facts)),
      skills: [...CAPABILITY_SKILLS],
    })),
    enhancements,
    withoutActiveScope: requested.filter((capability) => !isEstimable(capability, facts)),
  };
}
