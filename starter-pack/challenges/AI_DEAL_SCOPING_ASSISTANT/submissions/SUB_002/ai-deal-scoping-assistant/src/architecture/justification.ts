/**
 * Requirement/assumption citation logic shared by every component the planner builds. Keeping this
 * in one place enforces, identically for foundation and conditional components, the spec section 3
 * constraint: "Every major architecture component must reference a customer requirement,
 * non-functional requirement, security need, or reviewed assumption that justifies it." When none
 * of those apply, the caller omits the component rather than invent a rationale.
 *
 * Every citation is also restricted to CITABLE_REQUIREMENT_KINDS: a persona, risk, gap, dependency,
 * existing system or open question may share a component's trigger signal without ever becoming its
 * justification, so a component's "why" never turns into a grab-bag of unrelated id kinds.
 */
import type { ScopeItem, ScopeItemKind, ScopeModel, SolutionConfig } from '../domain';
import { REQUIREMENT_KINDS } from '../domain';
import type { ConditionalRule, FoundationRule } from './componentRules.data';
import { itemsInAnySignalGroup, itemsInSignalGroup, itemsOfKind, itemsOfKinds, itemsWithAnySignal, idsOf, reviewedAssumptions } from './scopeQueries';

export interface Justification {
  requirementIds: string[];
  assumptionIds: string[];
  /** The scope items behind requirementIds/assumptionIds, for dependency-title lookups. */
  items: ScopeItem[];
}

function fromItems(items: readonly ScopeItem[], asAssumption: boolean): Justification {
  return asAssumption
    ? { requirementIds: [], assumptionIds: idsOf(items), items: [...items] }
    : { requirementIds: idsOf(items), assumptionIds: [], items: [...items] };
}

/**
 * The only scope-item kinds a generated component may cite (spec section 3): the six requirement
 * kinds plus a stated technology preference. Personas, risks, gaps, questions, dependencies and
 * existing systems describe context, never a design decision, so they never become a citation even
 * when a signal happens to match (this is what keeps a component's "why" a real trace, not a dump
 * of every id that shares a keyword).
 */
export const CITABLE_REQUIREMENT_KINDS: readonly ScopeItemKind[] = [...REQUIREMENT_KINDS, 'technology'];

const PRIORITY_RANK: ReadonlyMap<string, number> = new Map([
  ['High', 3],
  ['Medium', 2],
  ['Low', 1],
]);

function byPriorityThenId(a: ScopeItem, b: ScopeItem): number {
  const rankDiff = (PRIORITY_RANK.get(b.priority) ?? 0) - (PRIORITY_RANK.get(a.priority) ?? 0);
  return rankDiff !== 0 ? rankDiff : a.id.localeCompare(b.id);
}

/** Last-resort citation cap so a component never drags in the full functional-requirement list. */
const LAST_RESORT_FUNCTIONAL_COUNT = 3;

function topFunctionalRequirements(scope: ScopeModel): ScopeItem[] {
  return itemsOfKind(scope, 'functional').sort(byPriorityThenId).slice(0, LAST_RESORT_FUNCTIONAL_COUNT);
}

/** Stage shared by every citation chain once a component's own driving signals found nothing:
 *  the highest-priority functional requirements (never the full list), then one reviewed assumption. */
function functionalOrAssumptionFallback(scope: ScopeModel): Justification | null {
  const topFunctional = topFunctionalRequirements(scope);
  if (topFunctional.length > 0) {
    return fromItems(topFunctional, false);
  }
  const assumption = reviewedAssumptions(scope).slice(0, 1);
  if (assumption.length > 0) {
    return fromItems(assumption, true);
  }
  return null;
}

/**
 * Items driving a foundation component beyond its direct NFR/security signal (FoundationRule's
 * relatedSignals/relatedGroups/relatedKinds - see componentRules.data.ts). Signal- and group-based
 * matches are restricted to CITABLE_REQUIREMENT_KINDS; kind-based matches (relatedKinds) are trusted
 * as-is because the rule author already named the exact kind (e.g. a delivery constraint for CI/CD).
 */
function relatedFoundationItems(scope: ScopeModel, rule: FoundationRule): ScopeItem[] {
  const signalMatches = rule.relatedSignals === undefined ? [] : itemsWithAnySignal(scope, rule.relatedSignals);
  const groupMatches = rule.relatedGroups === undefined ? [] : itemsInAnySignalGroup(scope, rule.relatedGroups);
  const citableMatches = [...signalMatches, ...groupMatches].filter((item) => CITABLE_REQUIREMENT_KINDS.includes(item.kind));
  const kindMatches = rule.relatedKinds === undefined ? [] : itemsOfKinds(scope, rule.relatedKinds);
  const merged: ScopeItem[] = [];
  for (const item of [...citableMatches, ...kindMatches]) {
    if (!merged.some((existing) => existing.id === item.id)) {
      merged.push(item);
    }
  }
  return merged;
}

/**
 * Foundation-component citation, in priority order: (1) in-scope NFR/security items carrying one of
 * the component's own signals, (2) items whose signal or kind specifically relates to that component
 * (see relatedFoundationItems), (3) the highest-priority functional requirements as a last resort,
 * (4) one reviewed assumption. Returns null only when none of those apply.
 */
export function justifyFoundation(scope: ScopeModel, rule: FoundationRule): Justification | null {
  const direct = scope.items.filter(
    (item) =>
      item.inScope &&
      (item.kind === 'nonFunctional' || item.kind === 'security') &&
      item.signals.some((signal) => rule.nfrSecSignals.includes(signal)),
  );
  if (direct.length > 0) {
    return fromItems(direct, false);
  }
  const related = relatedFoundationItems(scope, rule);
  if (related.length > 0) {
    return fromItems(related, false);
  }
  return functionalOrAssumptionFallback(scope);
}

/** Every in-scope item that triggers a conditional rule, via its specific signals or signal group,
 *  before the citable-kind filter is applied (used both for citation and for explaining an omission). */
function rawTriggerMatches(scope: ScopeModel, rule: ConditionalRule): ScopeItem[] {
  const bySignal = rule.triggerSignals.length > 0 ? itemsWithAnySignal(scope, rule.triggerSignals) : [];
  const merged = [...bySignal];
  if (rule.triggerGroup !== undefined) {
    for (const item of itemsInSignalGroup(scope, rule.triggerGroup)) {
      if (!merged.some((existing) => existing.id === item.id)) {
        merged.push(item);
      }
    }
  }
  return rule.requireKind === undefined ? merged : merged.filter((item) => item.kind === rule.requireKind);
}

/** Every triggering item that is also a citable kind - a persona, risk, gap or question sharing the
 *  same signal never becomes the citation, even though it may have triggered the raw match above. */
export function matchedItemsForConditional(scope: ScopeModel, rule: ConditionalRule): ScopeItem[] {
  return rawTriggerMatches(scope, rule).filter((item) => CITABLE_REQUIREMENT_KINDS.includes(item.kind));
}

/**
 * Conditional-component citation: the citable items that triggered it, or - for a config-driven
 * trigger with no matching signal (e.g. cache added purely for expected user volume) - the same
 * functional/assumption fallback foundation components use, so the component still cites a
 * qualifying item rather than only a configuration number.
 */
export function justifyConditional(scope: ScopeModel, config: SolutionConfig, rule: ConditionalRule): Justification | null {
  const matched = matchedItemsForConditional(scope, rule);
  if (matched.length > 0) {
    return fromItems(matched, false);
  }
  if (rule.additionalTrigger?.(scope, config) === true) {
    return functionalOrAssumptionFallback(scope);
  }
  return null;
}

/**
 * The gap or question that would have triggered a conditional component if not for the citable-kind
 * rule - null once the component is justified another way, or was never triggered at all. Used to
 * explain, in the architecture summary, why a plausible component was left out (spec section 3: an
 * unresolved gap must never silently become a design decision).
 */
export function gapOnlyTrigger(scope: ScopeModel, config: SolutionConfig, rule: ConditionalRule): ScopeItem | null {
  if (matchedItemsForConditional(scope, rule).length > 0 || rule.additionalTrigger?.(scope, config) === true) {
    return null;
  }
  return rawTriggerMatches(scope, rule).find((item) => item.kind === 'gap' || item.kind === 'question') ?? null;
}

function hasUnresolvedRelatedGapOrQuestion(item: ScopeItem, byId: ReadonlyMap<string, ScopeItem>): boolean {
  return item.relatedIds.some((relatedId) => {
    const related = byId.get(relatedId);
    return related !== undefined && (related.kind === 'gap' || related.kind === 'question') && !related.resolved;
  });
}

/**
 * True when every citing item is Low-priority or tied to an unresolved gap/question - the signal a
 * component uses to add a "a lighter option is enough for now" trade-off (see planner.ts) instead of
 * committing to the heavier design outright.
 */
export function isLowConfidenceJustification(scope: ScopeModel, items: readonly ScopeItem[]): boolean {
  if (items.length === 0) {
    return false;
  }
  const byId = new Map(scope.items.map((item) => [item.id, item]));
  return items.every((item) => item.priority === 'Low' || hasUnresolvedRelatedGapOrQuestion(item, byId));
}
