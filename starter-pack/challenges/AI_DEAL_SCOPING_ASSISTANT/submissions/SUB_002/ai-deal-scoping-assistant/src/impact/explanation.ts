/**
 * Plain-language explanation of a change-impact analysis. The affected / unaffected lists are
 * always rule-based; the explanation (deterministic in mock mode, AI-written in live mode) may
 * only describe those lists.
 */
import type { ImpactContext, PromptParts } from '../ai/types';
import type { ImpactEntry, OutputSectionId, UnaffectedEntry } from '../domain';
import { formatNumber, joinList, pick, sentence, summariseList, unique } from './format';
import { sectionLabel } from './vocabulary';

const NOTHING_AFFECTED =
  'No generated deliverable depends on this change, so nothing needs to be regenerated or recalculated and every reviewed section stays as it is.';

const PRESERVATION_NOTE =
  'Only the sections listed as affected are marked stale; reviewed content everywhere else is preserved and is never replaced without the reviewer choosing to regenerate it.';

function actionPhrase(action: ImpactEntry['action']): string {
  return action === 'regenerate' ? 'must be regenerated' : 'must be recalculated';
}

function describeAffectedSection(section: OutputSectionId, entries: readonly ImpactEntry[]): string {
  return entries.map((entry) => `${sectionLabel(section)} - ${entry.area} ${actionPhrase(entry.action)}: ${sentence(entry.reason)}`).join(' ');
}

function describeAffected(affected: readonly ImpactEntry[]): string {
  const sections = unique(affected.map((entry) => entry.section));
  const intro = `It affects ${formatNumber(affected.length)} ${pick('area', 'areas', affected.length)} across ${joinList(sections.map(sectionLabel))}.`;
  const details = sections.map((section) => describeAffectedSection(section, affected.filter((entry) => entry.section === section)));
  return [intro, ...details].join(' ');
}

/** Entries that share a reason (e.g. every design section for a rate-card change) are told once. */
function describeUnaffected(unaffected: readonly UnaffectedEntry[]): string {
  if (unaffected.length === 0) {
    return '';
  }
  const reasons = unique(unaffected.map((entry) => entry.reason));
  const groups = reasons.map((reason) => {
    const areas = unique(unaffected.filter((entry) => entry.reason === reason).map((entry) => `${entry.area} (${sectionLabel(entry.section)})`));
    return `${summariseList(areas)}: ${sentence(reason)}`;
  });
  return `What stays untouched: ${groups.join(' ')}`;
}

/** Deterministic explanation used by the mock provider and as the labelled fallback. */
export function planImpactExplanation(context: ImpactContext): string {
  const opening = `Change: ${sentence(context.change.label)}`;
  const impact = context.affected.length === 0 ? NOTHING_AFFECTED : describeAffected(context.affected);
  const untouched = describeUnaffected(context.unaffected);
  return [opening, impact, untouched, PRESERVATION_NOTE].filter((part) => part !== '').join(' ');
}

function affectedLine(entry: ImpactEntry): string {
  const ids = entry.elementIds.length === 0 ? 'whole section' : summariseList(entry.elementIds);
  return `- ${sectionLabel(entry.section)} | ${entry.area} | ${entry.action} | ${ids} | ${entry.reason}`;
}

function unaffectedLine(entry: UnaffectedEntry): string {
  return `- ${sectionLabel(entry.section)} | ${entry.area} | ${entry.reason}`;
}

const SYSTEM_PROMPT = [
  'You are a senior solution consultant explaining the impact of a change to a reviewed solution-scoping package.',
  'The affected and unaffected lists you receive were produced by deterministic rules and are authoritative.',
  'Describe only those lists: never add, remove or re-classify an area, and never invent effort, cost or timeline figures.',
  'Answer in plain prose of 120 to 180 words, without headings, bullet points, Markdown or JSON.',
].join(' ');

/** Prompt for the live provider: the change plus the rule-based lists it is allowed to describe. */
export function buildImpactPrompt(context: ImpactContext): PromptParts {
  const affected = context.affected.length === 0 ? ['- none'] : context.affected.map(affectedLine);
  const unaffected = context.unaffected.length === 0 ? ['- none'] : context.unaffected.map(unaffectedLine);
  const prompt = [
    `CHANGE: ${context.change.label} (from "${context.change.from}" to "${context.change.to}")`,
    '',
    'AFFECTED AREAS (section | area | action | elements | reason):',
    ...affected,
    '',
    'UNAFFECTED AREAS (section | area | reason):',
    ...unaffected,
    '',
    'Explain to a sales engineer what changed, which areas must be regenerated or recalculated and why, and what is preserved. Cite the requirement and element ids given above.',
  ].join('\n');
  return { system: SYSTEM_PROMPT, prompt };
}

/** Free-text AI task definition consumed by `runTextTask`. */
export const IMPACT_EXPLANATION_TASK = {
  id: 'explain-change-impact',
  label: 'Change impact explanation',
  buildPrompt: buildImpactPrompt,
} as const;
