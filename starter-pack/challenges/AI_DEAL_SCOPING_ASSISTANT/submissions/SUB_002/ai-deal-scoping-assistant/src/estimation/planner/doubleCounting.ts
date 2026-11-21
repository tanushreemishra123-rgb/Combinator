/**
 * Every unit of work is priced exactly once. A capability driver, an AI use-case driver, an
 * integration-interface driver and a data driver can each be built from the same reviewed
 * requirement by different upstream planners (PRD, AI strategy, integration and data strategy);
 * a capability whose reviewed requirements are all priced by the more specific drivers is the same
 * unit of work, not an extra one.
 *
 *  - Rule 1: a capability driver whose requirements are all priced by AI use-case, integration or
 *    data drivers collapses into them (kept in the AI Capabilities, System Integration and Data
 *    Platform and Migration workstreams). Generic non-functional and infrastructure drivers do not
 *    count as coverage: they size the platform, not the requirement's own feature.
 *  - Rule 2: two capability drivers for the same requirements collapse into one combined driver.
 *  - Rule 3: security work is either capability-driven (a named security capability exists in the
 *    functional scope) or generic (the signal-derived Security and Compliance workstream); never both.
 *
 * findDoubleCountedDrivers is the pure safety net: it re-checks the finished suggestion and must
 * find nothing for a correctly reconciled plan.
 */
import { REQUIREMENT_KINDS } from '../../domain';
import type { DriverSuggestion, DriverType, EstimateSuggestion, ScopeItemKind, WorkstreamSuggestion } from '../../domain';
import { complexityLevel } from '../complexity';
import { citeIds } from './facts';
import type { DriverSeed, PlannerFacts, WorkstreamSeed } from './facts';

export type SecurityModel = 'capability-led' | 'generic';

const SECURITY_NAME_HINT = 'security';

/** True for a PRD workstream name dedicated to security (for example 'Security Controls'). */
export function isSecurityWorkstreamName(name: string): boolean {
  return name.toLowerCase().includes(SECURITY_NAME_HINT);
}

/** True once the functional scope already names a capability workstream dedicated to security. */
export function securityModelFor(capabilityWorkstreams: readonly WorkstreamSeed[]): SecurityModel {
  const named = capabilityWorkstreams.some((workstream) => isSecurityWorkstreamName(workstream.name));
  return named ? 'capability-led' : 'generic';
}

function isRequirementId(id: string, facts: PlannerFacts): boolean {
  const kind: ScopeItemKind | undefined = facts.index.get(id)?.kind;
  return kind !== undefined && REQUIREMENT_KINDS.includes(kind);
}

/** The reviewed-requirement ids behind a driver, sorted into a stable key ('' when there are none). */
function requirementIdsOf(driver: DriverSeed, facts: PlannerFacts): string[] {
  return [...new Set(driver.refIds.filter((id) => isRequirementId(id, facts)))].sort();
}

function requirementKey(driver: DriverSeed, facts: PlannerFacts): string {
  return requirementIdsOf(driver, facts).join('|');
}

/** Drivers of the fixed workstreams that price a reviewed requirement's own work. */
export interface SpecialisedDrivers {
  ai: readonly DriverSeed[];
  integration: readonly DriverSeed[];
  data: readonly DriverSeed[];
}

/** True when the driver cites at least one reviewed requirement and every one of them is already priced. */
function isFullyCovered(requirementIds: readonly string[], covered: ReadonlySet<string>): boolean {
  return requirementIds.length > 0 && requirementIds.every((id) => covered.has(id));
}

/** Rule 1: drop a capability driver once AI, integration or data drivers already price all of its requirements. */
function withoutSpecialisedDuplicates(
  workstreams: readonly WorkstreamSeed[],
  specialised: SpecialisedDrivers,
  facts: PlannerFacts,
): WorkstreamSeed[] {
  const pricing = [...specialised.ai, ...specialised.integration, ...specialised.data];
  const covered = new Set(pricing.flatMap((driver) => requirementIdsOf(driver, facts)));
  return workstreams.map((workstream) => ({
    ...workstream,
    drivers: workstream.drivers.filter((driver) => !isFullyCovered(requirementIdsOf(driver, facts), covered)),
  }));
}

/** Rule 2: one combined driver for capabilities that cite the identical requirement set. */
function mergeCapabilityGroup(group: readonly DriverSeed[], facts: PlannerFacts): DriverSeed {
  const primary = group.at(0);
  if (primary === undefined) {
    throw new Error('mergeCapabilityGroup requires at least one driver');
  }
  const rest = group.slice(1);
  const complexity = group.reduce(
    (best, driver) => (complexityLevel(driver.complexity) > complexityLevel(best) ? driver.complexity : best),
    primary.complexity,
  );
  const requirementIds = requirementIdsOf(primary, facts);
  const refIds = [...new Set(group.flatMap((driver) => driver.refIds))];
  const label = group.map((driver) => driver.label).join(' / ');
  const rationale =
    rest.length === 0
      ? primary.rationale
      : `${complexity} complexity: ${citeIds(requirementIds)} already drives ${rest.map((driver) => driver.label).join(', ')}; delivered as one driver so the same reviewed scope is not priced under two capability names.`;
  return { type: primary.type, label, complexity, rationale, refIds };
}

function mergeDuplicateCapabilities(workstreams: readonly WorkstreamSeed[], facts: PlannerFacts): WorkstreamSeed[] {
  const groups = new Map<string, DriverSeed[]>();
  for (const workstream of workstreams) {
    for (const driver of workstream.drivers) {
      const key = requirementKey(driver, facts);
      if (key === '') {
        continue;
      }
      groups.set(key, [...(groups.get(key) ?? []), driver]);
    }
  }
  const replacement = new Map<DriverSeed, DriverSeed>();
  const dropped = new Set<DriverSeed>();
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    const [primary] = group;
    if (primary === undefined) {
      continue;
    }
    replacement.set(primary, mergeCapabilityGroup(group, facts));
    group.slice(1).forEach((driver) => dropped.add(driver));
  }
  return workstreams.map((workstream) => ({
    ...workstream,
    drivers: workstream.drivers.filter((driver) => !dropped.has(driver)).map((driver) => replacement.get(driver) ?? driver),
  }));
}

/** Applies rules 1 and 2 to the capability workstreams before they are numbered. */
export function reconcileCapabilityWorkstreams(
  capabilityWorkstreams: readonly WorkstreamSeed[],
  specialised: SpecialisedDrivers,
  facts: PlannerFacts,
): WorkstreamSeed[] {
  return mergeDuplicateCapabilities(withoutSpecialisedDuplicates(capabilityWorkstreams, specialised, facts), facts);
}

export interface DoubleCountedDriverPair {
  workstreamA: string;
  driverA: string;
  workstreamB: string;
  driverB: string;
  refIds: string[];
}

function sameRefIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  const setA = new Set(a);
  return b.every((id) => setA.has(id)) && new Set(b).size === setA.size;
}

function combinations<T>(items: readonly T[]): [T, T][] {
  return items.flatMap((item, index) => items.slice(index + 1).map((other): [T, T] => [item, other]));
}

interface PlacedDriver {
  workstreamId: string;
  driver: DriverSuggestion;
}

/** Driver types that price a requirement's own work in a dedicated workstream. */
const SPECIALISED_TYPES: ReadonlySet<DriverType> = new Set<DriverType>(['ai', 'integration', 'data']);
/** Driver types that restate functional scope (capabilities, including security capabilities). */
const RESTATING_TYPES: ReadonlySet<DriverType> = new Set<DriverType>(['capability', 'security']);

function placedDrivers(workstreams: readonly WorkstreamSuggestion[]): PlacedDriver[] {
  return workstreams.flatMap((workstream) => workstream.drivers.map((driver) => ({ workstreamId: workstream.id, driver })));
}

/** Rule 2 check: two drivers in different workstreams that cite the identical set of ids. */
function identicalPairs(entries: readonly PlacedDriver[]): DoubleCountedDriverPair[] {
  return combinations(entries)
    .filter(([left, right]) => left.workstreamId !== right.workstreamId && sameRefIds(left.driver.refIds, right.driver.refIds))
    .map(([left, right]) => ({
      workstreamA: left.workstreamId,
      driverA: left.driver.id,
      workstreamB: right.workstreamId,
      driverB: right.driver.id,
      refIds: [...left.driver.refIds],
    }));
}

/**
 * Rule 1 check: a capability or security driver whose reviewed requirements (the ids its suggestion
 * lists as workstream requirements) are all cited by AI, integration or data drivers of other
 * workstreams.
 * One pair is reported per covering driver, with the requirement ids the two share; a pair with
 * identical refIds is already reported by the identical-set check.
 */
function coveredCapabilityPairs(suggestion: EstimateSuggestion, entries: readonly PlacedDriver[]): DoubleCountedDriverPair[] {
  const reviewed = new Set(suggestion.workstreams.flatMap((workstream) => workstream.requirementIds));
  const pricing = entries.filter((entry) => SPECIALISED_TYPES.has(entry.driver.type));
  return entries
    .filter((entry) => RESTATING_TYPES.has(entry.driver.type))
    .flatMap((capability) => {
      const requirementIds = capability.driver.refIds.filter((id) => reviewed.has(id));
      const others = pricing.filter((entry) => entry.workstreamId !== capability.workstreamId);
      if (!isFullyCovered(requirementIds, new Set(others.flatMap((entry) => entry.driver.refIds)))) {
        return [];
      }
      return others
        .map((entry) => ({ entry, shared: requirementIds.filter((id) => entry.driver.refIds.includes(id)) }))
        .filter(({ entry, shared }) => shared.length > 0 && !sameRefIds(capability.driver.refIds, entry.driver.refIds))
        .map(({ entry, shared }) => ({
          workstreamA: capability.workstreamId,
          driverA: capability.driver.id,
          workstreamB: entry.workstreamId,
          driverB: entry.driver.id,
          refIds: shared,
        }));
    });
}

/**
 * Pure safety net (no scope model needed): a fully reconciled suggestion has no two drivers, in
 * different workstreams, whose refIds cite the identical set of reviewed items and design elements,
 * and no capability or security driver whose reviewed requirements are all priced by AI,
 * integration or data drivers elsewhere.
 */
export function findDoubleCountedDrivers(suggestion: EstimateSuggestion): DoubleCountedDriverPair[] {
  const entries = placedDrivers(suggestion.workstreams);
  return [...identicalPairs(entries), ...coveredCapabilityPairs(suggestion, entries)];
}
