/**
 * Rule-based change-impact analysis (spec: "identify which outputs are affected by the change").
 * The rule table names the candidate areas per kind of change; this engine keeps a candidate only
 * when the session's real trace data backs it, and reports everything else as unaffected together
 * with the reason - so reviewed content outside the affected list is provably preserved.
 */
import { hasSignalInGroup, OUTPUT_SECTION_IDS } from '../domain';
import type { ChangeDescriptor, ImpactEntry, OutputSectionId, ScopeItem, ScopingSession, UnaffectedEntry } from '../domain';
import { sentence, unique } from './format';
import { IMPACT_RULES, LINKED_ITEM_KINDS, SECTIONS_COVERING_KIND } from './impactRules.data';
import { collectSectionElements, generatedSections } from './sectionElements';
import { resolveSelector } from './selectors';
import type { AnalysisContext, AreaRule, ImpactAnalysis, ImpactRule, SectionElement } from './types';
import { elementNoun, sectionLabel } from './vocabulary';

/** Reason reported for sections that have no generated content to refresh. */
export const NOT_GENERATED_REASON = 'Not generated yet';

const EMPTY_RULE: ImpactRule = { areas: [], preserved: [] };

function isActive(item: ScopeItem): boolean {
  return item.review !== 'rejected';
}

/** Items linked to the target in either direction (FR_01.relatedIds -> Q_01 and Q_01.relatedIds -> FR_01). */
function linkedItemIds(target: ScopeItem, items: readonly ScopeItem[]): string[] {
  const known = new Set(items.map((item) => item.id));
  const pointingAtTarget = items.filter((item) => item.relatedIds.includes(target.id)).map((item) => item.id);
  return unique([...pointingAtTarget, ...target.relatedIds.filter((id) => known.has(id))]).filter((id) => id !== target.id);
}

function rootIdsFor(change: ChangeDescriptor, target: ScopeItem | undefined, items: readonly ScopeItem[]): string[] {
  if (target === undefined || !LINKED_ITEM_KINDS.has(change.kind)) {
    return [change.targetId];
  }
  return [change.targetId, ...linkedItemIds(target, items)];
}

function directlyCiting(elements: readonly SectionElement[], rootIds: readonly string[]): Set<string> {
  return new Set(elements.filter((element) => element.refs.some((ref) => rootIds.includes(ref))).map((element) => element.id));
}

function buildContext(session: ScopingSession, change: ChangeDescriptor): AnalysisContext {
  const items = (session.scope?.items ?? []).filter(isActive);
  const target = items.find((item) => item.id === change.targetId);
  const elements = collectSectionElements(session.outputs);
  const rootIds = rootIdsFor(change, target, items);
  return { change, elements, generated: generatedSections(session.outputs), items, target, rootIds, directIds: directlyCiting(elements, rootIds) };
}

/** True when the change brought an item into scope that this section is expected to cover. */
function mustCoverNewItem(section: OutputSectionId, context: AnalysisContext): boolean {
  const { change, target } = context;
  if (change.kind !== 'scope-inclusion' || target === undefined || !target.inScope) {
    return false;
  }
  const bySignal = section === 'aiStrategy' && hasSignalInGroup(target.signals, 'ai');
  return bySignal || (SECTIONS_COVERING_KIND.get(target.kind) ?? []).includes(section);
}

function uncoveredInclusionEntry(rule: AreaRule, context: AnalysisContext): ImpactEntry {
  const id = context.change.targetId;
  return {
    section: rule.section,
    area: rule.area,
    elementIds: [id],
    reason: `${id} is now in scope but no ${elementNoun(rule.section)} covers it yet, so the ${sectionLabel(rule.section)} must be extended to cover it.`,
    action: rule.action,
  };
}

interface SectionOutcome {
  affected: ImpactEntry[];
  unaffected: UnaffectedEntry[];
}

function evaluateAreas(areas: readonly AreaRule[], context: AnalysisContext): { entries: ImpactEntry[]; misses: string[] } {
  const entries: ImpactEntry[] = [];
  const misses: string[] = [];
  for (const rule of areas) {
    const resolution = resolveSelector(rule, context);
    if (resolution.matched) {
      const reason = resolution.evidence === '' ? rule.because : `${sentence(resolution.evidence)} ${rule.because}`;
      entries.push({ section: rule.section, area: rule.area, elementIds: resolution.elementIds, reason, action: rule.action });
    } else {
      misses.push(resolution.reason);
    }
  }
  return { entries, misses };
}

function analyzeSection(section: OutputSectionId, rule: ImpactRule, context: AnalysisContext): SectionOutcome {
  if (!context.generated.has(section)) {
    return { affected: [], unaffected: [{ section, area: sectionLabel(section), reason: NOT_GENERATED_REASON }] };
  }
  const areas = rule.areas.filter((area) => area.section === section);
  const preserved = rule.preserved.filter((area) => area.section === section);
  const { entries, misses } = evaluateAreas(areas, context);
  if (entries.length > 0) {
    return { affected: entries, unaffected: preserved };
  }
  const firstArea = areas.at(0);
  if (firstArea !== undefined && mustCoverNewItem(section, context)) {
    return { affected: [uncoveredInclusionEntry(firstArea, context)], unaffected: preserved };
  }
  const missed: UnaffectedEntry[] = misses.length === 0 ? [] : [{ section, area: sectionLabel(section), reason: unique(misses).join('; ') }];
  return { affected: [], unaffected: [...missed, ...preserved] };
}

/** Rule-based: walks requirement-to-output trace links and config dependency rules. */
export function analyzeImpact(session: ScopingSession, change: ChangeDescriptor): ImpactAnalysis {
  const rule = IMPACT_RULES.get(change.kind) ?? EMPTY_RULE;
  const context = buildContext(session, change);
  const outcomes = OUTPUT_SECTION_IDS.map((section) => analyzeSection(section, rule, context));
  return {
    affected: outcomes.flatMap((outcome) => outcome.affected),
    unaffected: [...outcomes.flatMap((outcome) => outcome.unaffected), ...rule.preserved.filter((area) => area.section === 'scope')],
  };
}
