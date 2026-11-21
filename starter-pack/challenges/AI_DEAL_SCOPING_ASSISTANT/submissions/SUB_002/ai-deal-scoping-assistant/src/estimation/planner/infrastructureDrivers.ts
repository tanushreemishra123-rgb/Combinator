/**
 * Cloud infrastructure drivers. Complexity is scored from visible facts only: architecture
 * component count, availability / disaster-recovery needs, expected-user bands, target regions and
 * hybrid connectivity. Unknown inputs are named in the rationale instead of being assumed.
 */
import type { ArchitectureArea, ArchitectureComponent, Complexity } from '../../domain';
import { countOf, formatWhole, joinList } from '../format';
import { bandScore, citeIds } from './facts';
import type { DriverSeed, PlannerFacts } from './facts';

const OPERATIONS_AREAS: ReadonlySet<ArchitectureArea> = new Set<ArchitectureArea>(['deployment', 'observability']);
const RESILIENCE_AREAS: ReadonlySet<ArchitectureArea> = new Set<ArchitectureArea>(['availability', 'backup-dr']);
const AVAILABILITY_SIGNAL = 'nfr:availability';
const HYBRID_SIGNAL = 'cloud:hybrid';

const COMPONENT_COUNT_BANDS = [
  { min: 13, score: 2 },
  { min: 7, score: 1 },
];
const EXPECTED_USER_BANDS = [
  { min: 100_000, score: 2 },
  { min: 10_000, score: 1 },
];
const OPERATIONS_COUNT_BANDS = [
  { min: 5, score: 3 },
  { min: 3, score: 2 },
  { min: 0, score: 1 },
];
const FOUNDATION_SCORE_BANDS: readonly { min: number; complexity: Complexity }[] = [
  { min: 5, complexity: 'Very High' },
  { min: 3, complexity: 'High' },
  { min: 2, complexity: 'Medium' },
  { min: 0, complexity: 'Low' },
];
const OPERATIONS_LEVELS: ReadonlyMap<number, Complexity> = new Map<number, Complexity>([
  [1, 'Low'],
  [2, 'Medium'],
  [3, 'High'],
]);

interface ScoredFact {
  score: number;
  text: string;
  refIds: string[];
  /** Unknown inputs score nothing and are stated as their own sentence instead of being assumed. */
  unknown?: boolean;
}

function componentFact(components: readonly ArchitectureComponent[], platformLabel: string): ScoredFact {
  if (components.length === 0) {
    return { score: 0, text: `No architecture components have been generated for ${platformLabel} yet.`, refIds: [], unknown: true };
  }
  return {
    score: bandScore(components.length, COMPONENT_COUNT_BANDS),
    text: `${countOf(components.length, 'architecture component')} on ${platformLabel}`,
    refIds: components.map((component) => component.id),
  };
}

function resilienceFact(facts: PlannerFacts): ScoredFact | null {
  const items = facts.active.filter((item) => item.signals.includes(AVAILABILITY_SIGNAL));
  const components = facts.context.components.filter((component) => RESILIENCE_AREAS.has(component.area));
  if (items.length === 0 && components.length === 0) {
    return null;
  }
  const cited = items.length > 0 ? ` (${citeIds(items.map((item) => item.id))})` : '';
  return { score: 1, text: `availability and disaster-recovery needs${cited}`, refIds: items.map((item) => item.id) };
}

function userFact(expectedUsers: number | null): ScoredFact {
  if (expectedUsers === null) {
    const text = 'The expected number of users has not been provided, so user load is not reflected in this rating and confidence is reduced.';
    return { score: 0, text, refIds: [], unknown: true };
  }
  return { score: bandScore(expectedUsers, EXPECTED_USER_BANDS), text: `${formatWhole(expectedUsers)} expected users`, refIds: [] };
}

function regionFact(regions: readonly string[]): ScoredFact {
  if (regions.length === 0) {
    return { score: 0, text: 'Target regions have not been provided.', refIds: [], unknown: true };
  }
  const multiRegion = regions.length > 1;
  const text = multiRegion ? `${countOf(regions.length, 'target region')} (${joinList(regions)})` : `a single target region (${joinList(regions)})`;
  return { score: multiRegion ? 1 : 0, text, refIds: [] };
}

function hybridFact(facts: PlannerFacts): ScoredFact | null {
  const items = facts.active.filter((item) => item.signals.includes(HYBRID_SIGNAL));
  if (items.length === 0) {
    return null;
  }
  const ids = items.map((item) => item.id);
  return { score: 1, text: `hybrid or on-premises connectivity (${citeIds(ids)})`, refIds: ids };
}

function foundationDriver(facts: PlannerFacts): DriverSeed {
  const { config, components } = facts.context;
  const platformComponents = components.filter((component) => !OPERATIONS_AREAS.has(component.area));
  const scored = [
    componentFact(platformComponents, facts.platformLabel),
    resilienceFact(facts),
    userFact(config.expectedUsers),
    regionFact(config.targetRegions),
    hybridFact(facts),
  ].filter((fact): fact is ScoredFact => fact !== null);
  const score = scored.reduce((total, fact) => total + fact.score, 0);
  const complexity = FOUNDATION_SCORE_BANDS.find((band) => score >= band.min)?.complexity ?? 'Low';
  const known = scored.filter((fact) => fact.unknown !== true).map((fact) => fact.text);
  const unknown = scored.filter((fact) => fact.unknown === true).map((fact) => fact.text);
  const basis = known.length > 0 ? joinList(known) : 'a baseline landing zone without sizing facts';
  return {
    type: 'infrastructure',
    label: 'Cloud platform foundation and environments',
    complexity,
    rationale: [`${complexity} complexity: ${basis}.`, ...unknown].join(' '),
    refIds: [...new Set(scored.flatMap((fact) => fact.refIds))],
  };
}

function operationsDriver(facts: PlannerFacts): DriverSeed | null {
  const components = facts.context.components.filter((component) => OPERATIONS_AREAS.has(component.area));
  if (components.length === 0) {
    return null;
  }
  const complexity = OPERATIONS_LEVELS.get(bandScore(components.length, OPERATIONS_COUNT_BANDS)) ?? 'Low';
  return {
    type: 'infrastructure',
    label: 'Delivery pipeline and observability',
    complexity,
    rationale: `${complexity} complexity: ${countOf(components.length, 'deployment and observability component')} (${joinList(components.map((component) => component.name))}) to automate and operate on ${facts.platformLabel}.`,
    refIds: components.map((component) => component.id),
  };
}

/** The platform foundation driver always exists: every solution needs a landing zone and environments. */
export function infrastructureDrivers(facts: PlannerFacts): DriverSeed[] {
  const operations = operationsDriver(facts);
  return operations === null ? [foundationDriver(facts)] : [foundationDriver(facts), operations];
}
