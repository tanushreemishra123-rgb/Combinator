/**
 * Assembles a validated PrdOutput into the full PrdBundle: the 14-section PrdDocument the spec
 * requires (in PRD_SECTION_IDS order) and the FunctionalScope (capabilities grouped into modules,
 * workstreams and delivery packages, each with a suggested engagement model and challenge mix).
 * Narrative sections (overview, business problem, journeys, out-of-scope) come straight from the
 * PrdOutput; every other requirement-listing section is projected deterministically from the
 * reviewed scope model so it stays accurate even if a live provider's narrative drifts.
 */
import type {
  Capability,
  ContentLabel,
  CustomerContext,
  DeliveryPackagePlan,
  FunctionalScope,
  PrdBundle,
  PrdDocument,
  PrdOutput,
  PrdSection,
  PrdSectionId,
  ScopeGrouping,
  ScopeItem,
  ScopeItemKind,
  ScopeModel,
  TracedStatement,
  UserJourney,
} from '../domain';
import { PRD_SECTION_IDS } from '../domain';
import { getInScopeItemsByKind, getRequirements } from '../scope';
import type { ChallengeType } from './capabilityCatalog.data';
import { findCatalogEntryByName } from './capabilityCatalog.data';
import { labelForProvenance, statementForScopeItem } from './provenance';

const SECTION_TITLES: ReadonlyMap<PrdSectionId, string> = new Map([
  ['overview', 'Product or solution overview'],
  ['businessProblem', 'Business problem'],
  ['objectives', 'Business objectives'],
  ['personas', 'Target users and personas'],
  ['journeys', 'User journeys or key workflows'],
  ['functionalRequirements', 'Functional requirements'],
  ['nonFunctionalRequirements', 'Non-functional requirements'],
  ['integrations', 'Integrations'],
  ['dependencies', 'Dependencies'],
  ['assumptions', 'Assumptions'],
  ['risks', 'Risks'],
  ['outOfScope', 'Out-of-scope items'],
  ['openQuestions', 'Open questions'],
  ['traceability', 'Requirement traceability'],
]);

/**
 * Which scope-item kinds back each deterministic section. Data (DATA_*) items fold into
 * "Functional requirements" and security (SEC_*) items fold into "Non-functional requirements"
 * because the challenge spec's 14-section PRD list has no
 * dedicated section for those two kinds; both still surface in capabilities and traceability.
 */
const KIND_SECTION_KINDS: ReadonlyMap<PrdSectionId, readonly ScopeItemKind[]> = new Map([
  ['objectives', ['business']],
  ['personas', ['persona']],
  ['functionalRequirements', ['functional', 'data']],
  ['nonFunctionalRequirements', ['nonFunctional', 'security']],
  ['integrations', ['integration']],
  ['dependencies', ['dependency']],
  ['assumptions', ['assumption']],
  ['risks', ['risk']],
  ['openQuestions', ['question']],
]);

/** Noun phrase for what the customer text did not state, used only when a section has nothing to show. */
const SECTION_ABSENCE_NOUNS: ReadonlyMap<PrdSectionId, string> = new Map([
  ['objectives', 'a business objective'],
  ['personas', 'a distinct target user or persona'],
  ['functionalRequirements', 'a functional or data requirement'],
  ['nonFunctionalRequirements', 'a non-functional or security requirement'],
  ['integrations', 'an integration with an external system'],
  ['dependencies', 'a delivery dependency'],
  ['assumptions', 'an assumption needing confirmation'],
  ['risks', 'a risk'],
  ['openQuestions', 'an open question'],
]);

/** Signal groups whose presence on an open gap or question shows it is tracking this section's missing content. */
const SECTION_TRACKING_SIGNAL_GROUPS: ReadonlyMap<PrdSectionId, readonly string[]> = new Map([
  ['functionalRequirements', ['capability:', 'ai:', 'data:']],
  ['nonFunctionalRequirements', ['nfr:', 'security:', 'compliance:']],
  ['integrations', ['integration:']],
]);

function hasSignalInGroups(item: ScopeItem, groups: readonly string[]): boolean {
  return item.signals.some((signal) => groups.some((group) => signal.startsWith(group)));
}

/** Open gaps or questions whose own wording shows they track why this section is empty. */
function openItemsTracking(scope: ScopeModel, id: PrdSectionId): ScopeItem[] {
  const groups = SECTION_TRACKING_SIGNAL_GROUPS.get(id);
  if (groups === undefined) {
    return [];
  }
  const candidates = [...getInScopeItemsByKind(scope, 'gap'), ...getInScopeItemsByKind(scope, 'question')];
  return candidates.filter((item) => !item.resolved && hasSignalInGroups(item, groups));
}

/**
 * Explains, grounded in the reviewed scope, why a requirement-listing section has nothing to show -
 * never the generic "no statements were generated" filler.
 */
function emptySectionStatement(scope: ScopeModel, id: PrdSectionId): TracedStatement {
  const noun = SECTION_ABSENCE_NOUNS.get(id) ?? 'a requirement in this category';
  const tracking = openItemsTracking(scope, id);
  const refs = tracking.map((item) => item.id);
  // Genuinely open (tracked by a gap/question) reads as pending; otherwise it is a settled reading of the text, not an assumption.
  const label: ContentLabel = refs.length > 0 ? 'assumption-to-confirm' : 'ai-interpretation';
  const tail =
    refs.length > 0
      ? ` This is left open and tracked by ${refs.join(', ')} until the customer confirms it.`
      : ' No open gap or question tracks this either, so treat the category as confirmed empty for this engagement rather than pending.';
  return { text: `The customer's requirements text did not state ${noun}.${tail}`, refs, label };
}

function buildKindStatements(scope: ScopeModel, id: PrdSectionId, kinds: readonly ScopeItemKind[]): TracedStatement[] {
  const items = kinds.flatMap((kind) => getInScopeItemsByKind(scope, kind));
  if (items.length === 0) {
    return [emptySectionStatement(scope, id)];
  }
  return [...items].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })).map(statementForScopeItem);
}

function buildJourneySectionStatements(scope: ScopeModel, journeys: readonly UserJourney[]): TracedStatement[] {
  const personas = getInScopeItemsByKind(scope, 'persona');
  return journeys.map((journey) => {
    const persona = personas.find((candidate) => candidate.id === journey.persona);
    return {
      text: `${journey.name}: ${journey.steps.join(' ')}`,
      refs: journey.requirementIds,
      label: persona === undefined ? 'ai-interpretation' : labelForProvenance(persona.provenance),
    };
  });
}

function buildTraceabilityStatements(scope: ScopeModel, capabilities: readonly Capability[]): TracedStatement[] {
  return getRequirements(scope).map((requirement) => {
    const coveringIds = capabilities.filter((capability) => capability.requirementIds.includes(requirement.id)).map((capability) => capability.id);
    const coverageText = coveringIds.length > 0 ? coveringIds.join(', ') : 'no capability yet, flagged as an uncovered requirement';
    return {
      text: `${requirement.id} - ${requirement.title} is covered by ${coverageText}.`,
      refs: [requirement.id, ...coveringIds],
      label: labelForProvenance(requirement.provenance),
    };
  });
}

function statementsForSection(id: PrdSectionId, output: PrdOutput, scope: ScopeModel): TracedStatement[] {
  switch (id) {
    case 'overview':
      return output.overview;
    case 'businessProblem':
      return output.businessProblem;
    case 'journeys':
      return buildJourneySectionStatements(scope, output.journeys);
    case 'outOfScope':
      return output.outOfScope;
    case 'traceability':
      return buildTraceabilityStatements(scope, output.capabilities);
    default: {
      const kinds = KIND_SECTION_KINDS.get(id);
      return kinds === undefined ? [] : buildKindStatements(scope, id, kinds);
    }
  }
}

/** Builds the 14-section PrdDocument in the spec's fixed order, with the spec's exact section titles. */
export function buildPrdDocument(output: PrdOutput, scope: ScopeModel, customer: CustomerContext): PrdDocument {
  const opportunity = customer.opportunityName.trim().length > 0 ? customer.opportunityName : customer.customerName;
  const sections: PrdSection[] = PRD_SECTION_IDS.map((id) => ({
    id,
    title: SECTION_TITLES.get(id) ?? id,
    statements: statementsForSection(id, output, scope),
  }));
  return { title: `${opportunity} - Product Requirements Document`, sections, journeys: output.journeys };
}

function groupBy(capabilities: readonly Capability[], keyFn: (capability: Capability) => string): ScopeGrouping[] {
  const groups = new Map<string, { capabilityIds: string[]; requirementIds: Set<string> }>();
  for (const capability of capabilities) {
    const key = keyFn(capability);
    const group = groups.get(key) ?? { capabilityIds: [], requirementIds: new Set<string>() };
    group.capabilityIds.push(capability.id);
    capability.requirementIds.forEach((id) => group.requirementIds.add(id));
    groups.set(key, group);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, group]) => ({ name, capabilityIds: group.capabilityIds, requirementIds: Array.from(group.requirementIds) }));
}

const CHALLENGE_TYPE_ORDER: readonly ChallengeType[] = ['Design challenge', 'Development challenge series', 'Data science challenge'];

/** A capability whose name is not in the catalog (e.g. a live-provider capability) defaults to a development challenge. */
function resolveChallengeType(capabilityName: string): ChallengeType {
  return findCatalogEntryByName(capabilityName)?.challengeType ?? 'Development challenge series';
}

/** Larger packages parallelise well as a Topcoder challenge series; a single capability is better run by a dedicated team. */
function engagementModelFor(capabilityCount: number): DeliveryPackagePlan['engagementModel'] {
  if (capabilityCount >= 3) {
    return 'topcoder-challenge-series';
  }
  return capabilityCount === 2 ? 'blended' : 'dedicated-team';
}

function suggestedChallengeTypesFor(members: readonly Capability[]): string[] {
  const present = new Set(members.map((capability) => resolveChallengeType(capability.name)));
  const ordered = CHALLENGE_TYPE_ORDER.filter((type) => present.has(type));
  return [...ordered, 'QA / bug hunt'];
}

function buildDeliveryPackages(capabilities: readonly Capability[]): DeliveryPackagePlan[] {
  return groupBy(capabilities, (capability) => capability.deliveryPackage).map((group) => {
    const members = capabilities.filter((capability) => group.capabilityIds.includes(capability.id));
    return { ...group, engagementModel: engagementModelFor(members.length), suggestedChallengeTypes: suggestedChallengeTypesFor(members) };
  });
}

/** Builds the FunctionalScope: capabilities grouped into modules/workstreams/delivery packages, plus enhancements and out-of-scope. */
export function buildFunctionalScope(output: PrdOutput): FunctionalScope {
  return {
    capabilities: output.capabilities,
    recommendedEnhancements: output.recommendedEnhancements,
    modules: groupBy(output.capabilities, (capability) => capability.module),
    workstreams: groupBy(output.capabilities, (capability) => capability.workstream),
    deliveryPackages: buildDeliveryPackages(output.capabilities),
    outOfScope: output.outOfScope,
  };
}

/** Combines the PRD document and functional scope into the PrdBundle stored on the session. */
export function buildPrdBundle(output: PrdOutput, scope: ScopeModel, customer: CustomerContext): PrdBundle {
  return { prd: buildPrdDocument(output, scope, customer), functionalScope: buildFunctionalScope(output) };
}
