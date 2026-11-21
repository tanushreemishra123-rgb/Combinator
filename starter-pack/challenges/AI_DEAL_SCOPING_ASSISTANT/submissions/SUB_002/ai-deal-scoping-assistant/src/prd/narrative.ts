/**
 * Narrative parts of the deterministic PRD plan: the solution overview, business-problem framing
 * and the out-of-scope statement (persona journeys live in journeys.ts). Overview and business
 * problem cite every in-scope business objective (BR_*) by title, grounded in the analysed summary,
 * the capability areas and the customer's existing and legacy systems; out-of-scope lists
 * what the customer or the reviewer excluded, quoting the customer's own words where they exist,
 * followed by standard exclusions that are assumptions for the customer to confirm.
 */
import type { Capability, ContentLabel, CustomerContext, ScopeItem, ScopeItemKind, ScopeModel, TracedStatement } from '../domain';
import { countOf, joinList } from '../estimation/format';
import { findExclusionCue, getActiveItems, getExcludedRequirements, getInScopeItemsByKind, isCustomerExcluded, sourceQuoteOf } from '../scope';
import { labelForProvenance } from './provenance';

interface StandardExclusion {
  text: string;
  /** Kind of in-scope item the exclusion qualifies, cited as its refs; null when none applies. */
  refKind: ScopeItemKind | null;
}

/**
 * Exclusions that hold for most scoping exercises. The customer has not stated them, so they are
 * labelled as assumptions to confirm rather than as customer-declared exclusions.
 */
const STANDARD_EXCLUSIONS: readonly StandardExclusion[] = [
  {
    text: 'Detailed visual design, branding and content authoring beyond what is described in the reviewed scope are out of scope for this PRD and are addressed during design execution.',
    refKind: null,
  },
  {
    text: 'Production data-migration volumes, historical backfill and legacy data cleansing beyond the reviewed data requirements remain out of scope until the customer confirms them.',
    refKind: 'data',
  },
  {
    text: 'Decommissioning of the existing systems referenced in the scope model is out of scope; this engagement covers integration with those systems, not their retirement.',
    refKind: 'existingSystem',
  },
];

/** Non-requirement kinds whose customer quote can itself declare something out of scope. */
const CONTEXT_EXCLUSION_KINDS: ReadonlySet<ScopeItemKind> = new Set(['constraint', 'gap']);

/** Wording that marks an existing system or process as the current state the engagement replaces. */
const LEGACY_CUES: readonly string[] = ['legacy', 'being replaced', 'end of support', 'manual', 'spreadsheet', ' old ', 'outdated'];

function opportunityLabel(customer: CustomerContext): string {
  return customer.opportunityName.trim().length > 0 ? customer.opportunityName : 'this engagement';
}

/** Customer-requested only when every cited item came from the customer's own text. */
function labelForAll(items: readonly ScopeItem[]): ContentLabel {
  return items.every((item) => item.provenance === 'customer-stated') ? 'customer-requested' : 'ai-interpretation';
}

function objectiveList(objectives: readonly ScopeItem[]): string {
  return joinList(objectives.map((objective) => `"${objective.title}" (${objective.id})`));
}

function isLegacySystem(system: ScopeItem): boolean {
  const text = ` ${system.title} ${system.description} `.toLowerCase();
  return LEGACY_CUES.some((cue) => text.includes(cue));
}

/** Capability areas (modules) in first-seen order, and the named existing systems the solution connects to. */
function solutionShapeStatement(scope: ScopeModel, capabilities: readonly Capability[]): TracedStatement {
  const areas = Array.from(new Set(capabilities.map((capability) => capability.module)));
  const systems = getInScopeItemsByKind(scope, 'existingSystem').filter((system) => !isLegacySystem(system));
  const connects = systems.length > 0 ? `connects to ${joinList(systems.map((system) => `${system.title} (${system.id})`))}` : 'names no existing system to connect to';
  return {
    text: `The solution is organised into ${countOf(areas.length, 'capability area')} (${joinList(areas)}) and ${connects}.`,
    refs: systems.map((system) => system.id),
    label: 'ai-interpretation',
  };
}

/**
 * Deterministic 'Product or solution overview': the analysed solution summary, the objectives it
 * serves (cited by ID; the Business objectives section carries their detail), and the capability
 * areas and existing systems that shape the solution.
 */
export function buildOverview(scope: ScopeModel, customer: CustomerContext, capabilities: readonly Capability[] = []): TracedStatement[] {
  const objectives = getInScopeItemsByKind(scope, 'business');
  if (objectives.length === 0) {
    return [
      {
        text: `${customer.customerName} is scoping ${opportunityLabel(customer)}; no business objective has been recorded in the reviewed scope yet, so this overview will be regenerated once at least one is approved.`,
        refs: [],
        label: 'assumption-to-confirm',
      },
    ];
  }
  const objectiveIds = objectives.map((objective) => objective.id);
  const statements: TracedStatement[] = [];
  if (scope.summary.trim().length > 0) {
    statements.push({ text: scope.summary.trim(), refs: objectiveIds, label: 'ai-interpretation' });
  }
  statements.push({
    text: `${opportunityLabel(customer)} serves ${countOf(objectives.length, 'business objective')} set by ${customer.customerName} (${joinList(objectiveIds)}); each is detailed under Business objectives.`,
    refs: objectiveIds,
    label: labelForAll(objectives),
  });
  if (capabilities.length > 0) {
    statements.push(solutionShapeStatement(scope, capabilities));
  }
  return statements;
}

/**
 * Deterministic 'Business problem': the legacy systems and manual processes the customer runs today,
 * then what stays out of reach until they are addressed, citing the objectives by title only so the
 * section does not repeat the Business objectives section word for word.
 */
export function buildBusinessProblem(scope: ScopeModel, customer: CustomerContext): TracedStatement[] {
  const objectives = getInScopeItemsByKind(scope, 'business');
  if (objectives.length === 0) {
    return [
      {
        text: `${customer.customerName} has not yet stated the business problem ${opportunityLabel(customer)} is meant to solve; capture at least one business objective in the reviewed scope before this section can be grounded.`,
        refs: [],
        label: 'assumption-to-confirm',
      },
    ];
  }
  const current = getInScopeItemsByKind(scope, 'existingSystem')
    .filter(isLegacySystem)
    .map((system): TracedStatement => ({
      text: `Today ${customer.customerName} relies on ${system.title}: ${system.description}`,
      refs: [system.id],
      label: labelForProvenance(system.provenance),
    }));
  const lead = current.length > 0 ? `Until this is addressed, ${customer.customerName} cannot achieve` : `${customer.customerName} cannot yet achieve`;
  const outcome: TracedStatement = {
    text: `${lead} ${objectiveList(objectives)}.`,
    refs: objectives.map((objective) => objective.id),
    label: labelForAll(objectives),
  };
  return [...current, outcome];
}

/** An excluded requirement, quoting the customer when their own words exclude it. */
function excludedRequirementStatement(item: ScopeItem): TracedStatement {
  const quote = sourceQuoteOf(item).trim();
  const text =
    quote.length > 0 && isCustomerExcluded(item)
      ? `${item.id} - ${item.title}: excluded from this engagement because the customer states "${quote}"`
      : `${item.id} - ${item.title}: ${item.description} is excluded from this engagement's scope.`;
  return { text, refs: [item.id], label: 'out-of-scope' };
}

/** True for an in-scope constraint or gap whose customer quote declares something out of scope. */
function quotesCustomerExclusion(item: ScopeItem): boolean {
  return item.inScope && CONTEXT_EXCLUSION_KINDS.has(item.kind) && findExclusionCue(sourceQuoteOf(item)) !== undefined;
}

/**
 * Constraints and gaps whose customer quote declares something out of scope (for example a legacy
 * system another program retires). A quote already cited by an excluded requirement is skipped so
 * the same customer sentence is not listed twice.
 */
function customerExcludedContext(scope: ScopeModel, quotedAlready: Set<string>): TracedStatement[] {
  const statements: TracedStatement[] = [];
  for (const item of getActiveItems(scope).filter(quotesCustomerExclusion)) {
    const quote = sourceQuoteOf(item).trim();
    if (!quotedAlready.has(quote)) {
      quotedAlready.add(quote);
      statements.push({ text: `${item.id} - ${item.title}: the customer states "${quote}"`, refs: [item.id], label: 'out-of-scope' });
    }
  }
  return statements;
}

function standardExclusionStatement(scope: ScopeModel, exclusion: StandardExclusion): TracedStatement {
  const refs = exclusion.refKind === null ? [] : getInScopeItemsByKind(scope, exclusion.refKind).map((item) => item.id);
  return { text: exclusion.text, refs, label: 'assumption-to-confirm' };
}

/**
 * Deterministic 'Out-of-scope items': excluded or rejected requirements, then constraints and gaps
 * whose customer wording excludes something, then the standard exclusions to confirm.
 */
export function buildOutOfScope(scope: ScopeModel): TracedStatement[] {
  const excluded = getExcludedRequirements(scope);
  const quotedAlready = new Set(excluded.map((item) => sourceQuoteOf(item).trim()).filter((quote) => quote.length > 0));
  return [
    ...excluded.map(excludedRequirementStatement),
    ...customerExcludedContext(scope, quotedAlready),
    ...STANDARD_EXCLUSIONS.map((exclusion) => standardExclusionStatement(scope, exclusion)),
  ];
}
