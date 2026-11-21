/**
 * Resolves the selector of one area rule against the session's generated elements. Every
 * resolution is explainable: a match carries the ids and an evidence sentence ('CAP_02 cites
 * FR_02'), a miss carries the reason the area is unaffected ('No capability cites FR_02').
 */
import type { OutputSectionId, ScopeItem, ScopeItemKind } from '../domain';
import { joinList, pick, summariseList } from './format';
import { ONE_HOP_SECTIONS } from './impactRules.data';
import type { AnalysisContext, AreaRule, ElementFacet, SectionElement, SelectorResolution } from './types';
import { elementNoun, sectionLabel } from './vocabulary';

function inSection(context: AnalysisContext, section: OutputSectionId): SectionElement[] {
  return context.elements.filter((element) => element.section === section);
}

function citesAny(element: SectionElement, ids: ReadonlySet<string>): boolean {
  return element.refs.some((ref) => ids.has(ref));
}

function displays(elements: readonly SectionElement[]): string {
  return summariseList(elements.map((element) => element.display));
}

function ids(elements: readonly SectionElement[]): string[] {
  return elements.map((element) => element.id);
}

/** Elements named by a real id (not by a quoted title) are the ones worth listing for a whole section. */
function hasOwnId(element: SectionElement): boolean {
  return element.display === element.id;
}

/** 'FR_02' or, for an assumption/question with linked items, 'ASM_01 or its linked items FR_03 and FR_04'. */
function describeRoots(rootIds: readonly string[]): string {
  const [target, ...linked] = rootIds;
  if (target === undefined) {
    return 'the changed item';
  }
  return linked.length === 0 ? target : `${target} or its linked ${pick('item', 'items', linked.length)} ${joinList(linked)}`;
}

/** Open items carry the same taxonomy signals as real requirements (a gap about a "fast-follow"
 * feature still matches the nfr:performance keyword), but they state no target themselves - only
 * a reviewed requirement does. Excluding them keeps this selector's "X states <phrase>" evidence
 * (used by both the requirements-with-signals and cites-signals selector types below) honest. */
const OPEN_ITEM_KINDS: ReadonlySet<ScopeItemKind> = new Set(['question', 'gap', 'risk', 'dependency']);

function itemsWithSignals(context: AnalysisContext, signals: readonly string[]): ScopeItem[] {
  return context.items.filter((item) => item.inScope && !OPEN_ITEM_KINDS.has(item.kind) && item.signals.some((signal) => signals.includes(signal)));
}

function traceEvidence(direct: readonly SectionElement[], hop: readonly SectionElement[], roots: string): string {
  const sentences: string[] = [];
  if (direct.length > 0) {
    sentences.push(`${displays(direct)} ${pick('cites', 'cite', direct.length)} ${roots}`);
  }
  if (hop.length > 0) {
    sentences.push(`${displays(hop)} ${pick('builds', 'build', hop.length)} on generated elements that cite it`);
  }
  return sentences.join('; ');
}

/** Elements citing the changed item, plus (estimate and ROM) elements citing those elements. */
function resolveTrace(section: OutputSectionId, context: AnalysisContext): SelectorResolution {
  const roots = new Set(context.rootIds);
  const candidates = inSection(context, section);
  const direct = candidates.filter((element) => citesAny(element, roots));
  const hop = ONE_HOP_SECTIONS.has(section) ? candidates.filter((element) => !direct.includes(element) && citesAny(element, context.directIds)) : [];
  const rootsText = describeRoots(context.rootIds);
  if (direct.length + hop.length === 0) {
    return { matched: false, reason: `No ${elementNoun(section)} cites ${rootsText}` };
  }
  return { matched: true, elementIds: ids([...direct, ...hop]), evidence: traceEvidence(direct, hop, rootsText) };
}

function resolveCitesSignals(section: OutputSectionId, signals: readonly string[], targetPhrase: string, context: AnalysisContext): SelectorResolution {
  const requirementIds = itemsWithSignals(context, signals).map((item) => item.id);
  const citing = inSection(context, section).filter((element) => citesAny(element, new Set(requirementIds)));
  if (citing.length === 0) {
    return { matched: false, reason: `No ${elementNoun(section)} cites a requirement that states ${targetPhrase}` };
  }
  const cited = requirementIds.filter((id) => citing.some((element) => element.refs.includes(id)));
  return {
    matched: true,
    elementIds: ids(citing),
    evidence: `${displays(citing)} ${pick('cites', 'cite', citing.length)} ${summariseList(cited)}, which ${pick('states', 'state', cited.length)} ${targetPhrase}`,
  };
}

function resolveRequirementsWithSignals(signals: readonly string[], targetPhrase: string, context: AnalysisContext): SelectorResolution {
  const requirements = itemsWithSignals(context, signals);
  if (requirements.length === 0) {
    return { matched: false, reason: `No reviewed requirement states ${targetPhrase}` };
  }
  const requirementIds = requirements.map((item) => item.id);
  return {
    matched: true,
    elementIds: requirementIds,
    evidence: `${summariseList(requirementIds)} ${pick('states', 'state', requirementIds.length)} ${targetPhrase}`,
  };
}

function resolveFacets(section: OutputSectionId, facets: readonly ElementFacet[], facetNoun: string, context: AnalysisContext): SelectorResolution {
  const tagged = inSection(context, section).filter((element) => element.facets.some((facet) => facets.includes(facet)));
  if (tagged.length === 0) {
    return { matched: false, reason: `The ${sectionLabel(section)} contains no element of ${facetNoun}` };
  }
  return { matched: true, elementIds: ids(tagged), evidence: `${displays(tagged)} ${pick('makes', 'make', tagged.length)} up ${facetNoun}` };
}

/** The driver whose complexity was set plus the workstream (and priced line) that contains it. */
function resolveTargetDriver(section: OutputSectionId, context: AnalysisContext): SelectorResolution {
  const targetId = context.change.targetId;
  const carriers = inSection(context, section).filter((element) => element.id === targetId || element.refs.includes(targetId));
  if (carriers.length === 0) {
    return { matched: false, reason: `No ${elementNoun(section)} matches ${targetId}` };
  }
  return { matched: true, elementIds: ids(carriers), evidence: `${displays(carriers)} ${pick('carries', 'carry', carriers.length)} the changed complexity setting of ${targetId}` };
}

export function resolveSelector(rule: AreaRule, context: AnalysisContext): SelectorResolution {
  const { selector, section } = rule;
  switch (selector.type) {
    case 'whole-section':
      return { matched: true, elementIds: ids(inSection(context, section).filter(hasOwnId)), evidence: '' };
    case 'trace':
      return resolveTrace(section, context);
    case 'cites-signals':
      return resolveCitesSignals(section, selector.signals, selector.targetPhrase, context);
    case 'requirements-with-signals':
      return resolveRequirementsWithSignals(selector.signals, selector.targetPhrase, context);
    case 'facets':
      return resolveFacets(section, selector.facets, selector.facetNoun, context);
    case 'target-driver':
      return resolveTargetDriver(section, context);
  }
}
