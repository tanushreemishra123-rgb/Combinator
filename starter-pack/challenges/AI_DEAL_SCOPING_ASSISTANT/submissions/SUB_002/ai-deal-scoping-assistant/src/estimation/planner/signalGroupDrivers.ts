/**
 * Security / compliance control groups and non-functional hardening drivers. Both are produced by
 * one table-driven rule: a driver exists for every group whose signals occur in the reviewed scope,
 * and its complexity grows with the number of distinct control areas and the priority of the items.
 */
import { REQUIREMENT_KINDS, signalLabel } from '../../domain';
import type { Complexity, DriverType, ScopeItem, ScopeItemKind } from '../../domain';
import { atLeast, complexityFromLevel, raiseComplexity } from '../complexity';
import { countOf } from '../format';
import { distinct } from '../scopeFacts';
import { citeIds } from './facts';
import type { DriverSeed, PlannerFacts } from './facts';

interface SignalGroup {
  label: string;
  signals: readonly string[];
  /** Signals that make the group at least High (regulated or architecturally invasive). */
  elevated: readonly string[];
}

interface GroupFamily {
  type: DriverType;
  groups: readonly SignalGroup[];
  /** Items of this kind that match no group are collected into the fallback driver. */
  fallbackKind: ScopeItemKind;
  fallbackLabel: string;
  areaNoun: string;
}

const SECURITY_FAMILY: GroupFamily = {
  type: 'security',
  fallbackKind: 'security',
  fallbackLabel: 'Additional security requirements',
  areaNoun: 'control area',
  groups: [
    { label: 'Identity and access management', signals: ['security:sso', 'security:mfa', 'security:rbac'], elevated: [] },
    {
      label: 'Data protection and privacy controls',
      signals: ['security:encryption', 'security:secrets', 'security:data-residency', 'data:pii'],
      elevated: ['security:data-residency'],
    },
    { label: 'Audit logging and threat protection', signals: ['security:audit', 'security:network'], elevated: [] },
    {
      label: 'Regulatory compliance evidence',
      signals: ['compliance:gdpr', 'compliance:hipaa', 'compliance:pci', 'compliance:soc2', 'compliance:iso27001', 'compliance:sox', 'compliance:fedramp'],
      elevated: ['compliance:hipaa', 'compliance:pci', 'compliance:fedramp'],
    },
  ],
};

const NON_FUNCTIONAL_FAMILY: GroupFamily = {
  type: 'nonFunctional',
  fallbackKind: 'nonFunctional',
  fallbackLabel: 'General non-functional hardening',
  areaNoun: 'quality attribute',
  groups: [
    { label: 'Performance and scalability hardening', signals: ['nfr:performance', 'nfr:scalability'], elevated: [] },
    { label: 'Availability and resilience hardening', signals: ['nfr:availability'], elevated: [] },
    { label: 'Accessibility, localisation and usability', signals: ['nfr:accessibility', 'nfr:localization', 'nfr:usability'], elevated: [] },
    { label: 'Observability and maintainability', signals: ['nfr:observability', 'nfr:maintainability'], elevated: [] },
    { label: 'Offline support', signals: ['nfr:offline'], elevated: ['nfr:offline'] },
  ],
};

/** Ungrouped requirements raise the fallback driver by one complexity level per this many items. */
const FALLBACK_ITEMS_PER_LEVEL = 2;

/**
 * Kinds a signal group may draw items from. 'data' and 'integration' are excluded even though they
 * are requirement kinds: every active item of those two kinds already gets its own, fully priced
 * driver from dataDrivers()/integrationDrivers() regardless of which signals it carries, so folding
 * one into a security or non-functional group here would price the same item a second time (the
 * same double-counting class as rules 1/2/4 in planner/doubleCounting.ts, just within one family).
 */
const GROUPABLE_KINDS: readonly ScopeItemKind[] = [...REQUIREMENT_KINDS, 'constraint'];
const GROUPED_KINDS: ReadonlySet<ScopeItemKind> = new Set<ScopeItemKind>(
  GROUPABLE_KINDS.filter((kind) => kind !== 'data' && kind !== 'integration'),
);

function groupComplexity(areaCount: number, hasElevated: boolean, hasHighPriority: boolean): Complexity {
  const base = raiseComplexity(complexityFromLevel(areaCount), hasHighPriority ? 1 : 0);
  return hasElevated ? atLeast(base, 'High') : base;
}

function groupDriver(group: SignalGroup, family: GroupFamily, candidates: readonly ScopeItem[]): DriverSeed | null {
  const items = candidates.filter((item) => item.signals.some((signal) => group.signals.includes(signal)));
  if (items.length === 0) {
    return null;
  }
  const areas = distinct(items.flatMap((item) => item.signals)).filter((signal) => group.signals.includes(signal));
  const highPriority = items.filter((item) => item.priority === 'High');
  const hasElevated = areas.some((signal) => group.elevated.includes(signal));
  const complexity = groupComplexity(areas.length, hasElevated, highPriority.length > 0);
  const priorityVerb = highPriority.length === 1 ? 'is' : 'are';
  const priorityNote =
    highPriority.length > 0
      ? `; raised one level because ${citeIds(highPriority.map((item) => item.id))} ${priorityVerb} High priority`
      : '';
  const elevatedNote = hasElevated ? '; at least High because a regulated or architecturally invasive control is in scope' : '';
  const itemIds = items.map((item) => item.id);
  return {
    type: family.type,
    label: group.label,
    complexity,
    rationale: `${complexity} complexity: ${countOf(areas.length, family.areaNoun)} (${areas.map(signalLabel).join('; ')}) required by ${citeIds(itemIds)}${priorityNote}${elevatedNote}.`,
    refIds: itemIds,
  };
}

function fallbackDriver(family: GroupFamily, facts: PlannerFacts): DriverSeed | null {
  const grouped = family.groups.flatMap((group) => group.signals);
  const items = facts.active.filter(
    (item) => item.kind === family.fallbackKind && !item.signals.some((signal) => grouped.includes(signal)),
  );
  if (items.length === 0) {
    return null;
  }
  const complexity = complexityFromLevel(Math.ceil(items.length / FALLBACK_ITEMS_PER_LEVEL));
  const itemIds = items.map((item) => item.id);
  return {
    type: family.type,
    label: family.fallbackLabel,
    complexity,
    rationale: `${complexity} complexity: ${countOf(items.length, 'requirement')} (${citeIds(itemIds)}) outside the standard ${family.areaNoun} groups.`,
    refIds: itemIds,
  };
}

function familyDrivers(family: GroupFamily, facts: PlannerFacts): DriverSeed[] {
  const candidates = facts.active.filter((item) => GROUPED_KINDS.has(item.kind));
  const grouped = family.groups.map((group) => groupDriver(group, family, candidates));
  return [...grouped, fallbackDriver(family, facts)].filter((driver): driver is DriverSeed => driver !== null);
}

export function securityDrivers(facts: PlannerFacts): DriverSeed[] {
  return familyDrivers(SECURITY_FAMILY, facts);
}

export function nonFunctionalDrivers(facts: PlannerFacts): DriverSeed[] {
  return familyDrivers(NON_FUNCTIONAL_FAMILY, facts);
}
