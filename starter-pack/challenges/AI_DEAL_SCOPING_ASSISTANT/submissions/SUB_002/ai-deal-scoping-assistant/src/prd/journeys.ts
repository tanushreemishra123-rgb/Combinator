/**
 * Persona journeys for the PRD. A journey follows the functional requirements that name the
 * persona ("Agents submit new claims online..."), in the order the customer described them, and
 * cites the capabilities that deliver each step. When no requirement names the persona, the journey
 * does not invent a numbered walkthrough: it says plainly that the journey is to be defined in
 * discovery and names the likely touchpoints, in workflow order, among the highest-priority
 * functional capabilities.
 */
import { formatId } from '../domain/ids';
import type { Capability, ScopeItem, ScopeModel, UserJourney } from '../domain';
import { getInScopeItemsByKind } from '../scope';
import { findCatalogEntryByName } from './capabilityCatalog.data';
import { priorityRank } from './priority';

/** A journey is a walkthrough, not an inventory: longer ones are cut to the first steps. */
export const MAX_JOURNEY_STEPS = 6;

/** An inferred journey names a handful of likely touchpoints, not a full step inventory it cannot ground. */
const MAX_INFERRED_TOUCHPOINTS = 4;

/** Shortest persona word that is specific enough to look for in requirement text. */
const MIN_KEYWORD_LENGTH = 4;
/**
 * Characters from the start of a description within which the persona counts as its subject
 * ("Claims examiners approve a payment..."), as opposed to a passing mention ("...the correct patient chart").
 */
const SUBJECT_WINDOW = 30;

const NON_LETTERS = /[^\p{L}]+/u;
const BRACKETED = /\([^)]*\)/g;

/** Head noun of the persona title ("Independent Agent" -> "agent"), singular, bracketed qualifiers ignored. */
function personaKeyword(persona: ScopeItem): string | null {
  const words = persona.title.replace(BRACKETED, ' ').toLowerCase().split(NON_LETTERS).filter((word) => word !== '');
  const head = words.at(-1);
  if (head === undefined) {
    return null;
  }
  const singular = head.endsWith('s') && !head.endsWith('ss') ? head.slice(0, -1) : head;
  return singular.length >= MIN_KEYWORD_LENGTH ? singular : null;
}

/** A requirement is about the persona when it links to it, names it in its title, or opens with it as the acting subject. */
function isAboutPersona(item: ScopeItem, persona: ScopeItem, keyword: string | null): boolean {
  if (item.relatedIds.includes(persona.id) || persona.relatedIds.includes(item.id)) {
    return true;
  }
  if (keyword === null) {
    return false;
  }
  const position = item.description.toLowerCase().indexOf(keyword);
  return item.title.toLowerCase().includes(keyword) || (position !== -1 && position < SUBJECT_WINDOW);
}

function requirementsNaming(persona: ScopeItem, functional: readonly ScopeItem[]): ScopeItem[] {
  const keyword = personaKeyword(persona);
  return functional.filter((item) => isAboutPersona(item, persona, keyword));
}

function withoutFinalStop(sentence: string): string {
  const trimmed = sentence.trim();
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
}

function requirementStep(item: ScopeItem, capabilities: readonly Capability[], position: number): string {
  const delivering = capabilities.filter((candidate) => candidate.requirementIds.includes(item.id)).map((candidate) => candidate.id);
  const deliveredBy = delivering.length === 0 ? item.id : `${item.id}; delivered by ${delivering.join(', ')}`;
  return `Step ${position}: ${withoutFinalStop(item.description)} (${deliveredBy}).`;
}

function groundedJourney(persona: ScopeItem, requirements: readonly ScopeItem[], capabilities: readonly Capability[]): Pick<UserJourney, 'steps' | 'requirementIds'> {
  const shown = requirements.slice(0, MAX_JOURNEY_STEPS);
  const steps = shown.map((item, index) => requirementStep(item, capabilities, index + 1));
  const omitted = requirements.length - shown.length;
  if (omitted > 0) {
    steps.push(`${persona.title} is also named by ${requirements.slice(MAX_JOURNEY_STEPS).map((item) => item.id).join(', ')}, covered in the functional requirements below.`);
  }
  return { steps, requirementIds: requirements.map((item) => item.id) };
}

/**
 * Rough end-to-end order a person moves through a product in: get in, find or capture the thing
 * they came for, act on it, then the cross-cutting capabilities that wrap around every workflow.
 * Only used to order an inferred journey's touchpoints for readability - it never adds a capability
 * that was not already selected, and a capability outside this list keeps sorting after all of it.
 */
const CAPABILITY_WORKFLOW_ORDER: readonly string[] = [
  'capability:identity',
  'capability:portal',
  'capability:search',
  'capability:catalog',
  'capability:forms',
  'capability:documents',
  'capability:orders',
  'capability:scheduling',
  'capability:workflow',
  'capability:messaging',
  'capability:content',
  'capability:payments',
  'ai:assistant',
  'ai:rag',
  'capability:notifications',
  'capability:reporting',
  'capability:admin',
  'capability:mobile',
];
const WORKFLOW_RANK: ReadonlyMap<string, number> = new Map(CAPABILITY_WORKFLOW_ORDER.map((signal, index) => [signal, index]));

/** A capability's position in the typical workflow order, or last when its catalog signal is not in that list. */
function workflowRank(capability: Capability): number {
  const entry = findCatalogEntryByName(capability.name);
  const rank = entry === undefined ? undefined : WORKFLOW_RANK.get(entry.signal);
  return rank ?? CAPABILITY_WORKFLOW_ORDER.length;
}

/** The highest-priority capabilities a person would work with (those delivering a functional requirement), capped and put in workflow order. */
function likelyTouchpoints(capabilities: readonly Capability[], functionalIds: ReadonlySet<string>): Capability[] {
  return capabilities
    .filter((capability) => capability.requirementIds.some((id) => functionalIds.has(id)))
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || a.id.localeCompare(b.id))
    .slice(0, MAX_INFERRED_TOUCHPOINTS)
    .sort((a, b) => workflowRank(a) - workflowRank(b) || a.id.localeCompare(b.id));
}

/**
 * No requirement names this persona, so nothing licenses a numbered step-by-step walkthrough: that
 * would present a guess as a reviewed fact. Instead the journey states plainly that it is
 * to be defined in discovery and names the likely touchpoints so a reviewer knows where to start.
 */
function inferredJourney(persona: ScopeItem, capabilities: readonly Capability[], functionalIds: ReadonlySet<string>): Pick<UserJourney, 'steps' | 'requirementIds'> {
  const touchpoints = likelyTouchpoints(capabilities, functionalIds);
  if (touchpoints.length === 0) {
    return {
      steps: [`No reviewed requirement names ${persona.title} directly and no functional capability is recorded yet, so this journey is to be defined once discovery describes ${persona.title}'s actions.`],
      requirementIds: [],
    };
  }
  const touchpointNames = touchpoints.map((capability) => capability.name).join(', ');
  const requirementIds = Array.from(new Set(touchpoints.flatMap((capability) => capability.requirementIds.filter((id) => functionalIds.has(id)))));
  return {
    steps: [
      `No reviewed requirement names ${persona.title} directly, so this journey is to be defined in discovery; based on the highest-priority functional capabilities, the likely touchpoints, in workflow order, are ${touchpointNames}.`,
    ],
    requirementIds,
  };
}

/** One journey per reviewed persona. */
export function buildJourneys(scope: ScopeModel, capabilities: readonly Capability[]): UserJourney[] {
  const functional = getInScopeItemsByKind(scope, 'functional');
  const functionalIds = new Set(functional.map((item) => item.id));
  return getInScopeItemsByKind(scope, 'persona').map((persona, index) => {
    const named = requirementsNaming(persona, functional);
    const body = named.length > 0 ? groundedJourney(persona, named, capabilities) : inferredJourney(persona, capabilities, functionalIds);
    return { id: formatId('JNY', index + 1), name: `${persona.title} journey`, persona: persona.id, ...body };
  });
}
