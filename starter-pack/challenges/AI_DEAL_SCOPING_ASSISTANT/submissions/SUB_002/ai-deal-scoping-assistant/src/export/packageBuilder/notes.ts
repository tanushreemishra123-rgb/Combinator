/**
 * "Assumptions", "Risks", "Dependencies" and "Open questions" package sections (spec 6): each is a
 * table of `id, text, status, related ids` built from the reviewed scope model plus, where the
 * estimate suggested its own commercial or delivery notes, those notes as extra rows. The open
 * questions section also lists every missing-information item (GAP_xx), so an id cited anywhere in
 * the package can be looked up in one place.
 */
import type { EstimateNote, EstimationInputKey, PackageSection, ScopeItem, ScopeItemKind, ScopingSession } from '../../domain';
import { getInScopeItemsByKind } from '../../scope';
import { headingBlock, joinOrFallback, notGeneratedCallout, tableOrParagraph } from '../text';

const COLUMNS = ['ID', 'Text', 'Status', 'Related IDs'] as const;

function itemText(item: ScopeItem): string {
  const resolution = item.resolved && item.resolution.trim().length > 0 ? ` Resolution: ${item.resolution.trim()}.` : '';
  return `${item.title}: ${item.description}${resolution}`;
}

function scopeItemRow(item: ScopeItem, resolvedStatus: string, openStatus: string): string[] {
  return [item.id, itemText(item), item.resolved ? resolvedStatus : openStatus, joinOrFallback(item.relatedIds, 'None')];
}

function estimateNoteRow(note: EstimateNote): string[] {
  return [note.id, note.text, 'Estimation note', joinOrFallback(note.refs, 'None')];
}

function buildNoteSection(
  id: PackageSection['id'],
  title: string,
  scopeItems: readonly ScopeItem[] | null,
  resolvedStatus: string,
  openStatus: string,
  estimateNotes: readonly EstimateNote[],
  emptyMessage: string,
): PackageSection {
  if (scopeItems === null) {
    return { id, title, blocks: [notGeneratedCallout('no requirements have been analysed and approved yet')] };
  }
  const rows = [...scopeItems.map((item) => scopeItemRow(item, resolvedStatus, openStatus)), ...estimateNotes.map(estimateNoteRow)];
  return { id, title, blocks: [tableOrParagraph([...COLUMNS], rows, emptyMessage)] };
}

function itemsOfKind(session: ScopingSession, kind: ScopeItemKind): readonly ScopeItem[] | null {
  return session.scope === null ? null : getInScopeItemsByKind(session.scope, kind);
}

export function buildAssumptionsSection(session: ScopingSession): PackageSection {
  const notes = session.outputs.estimate.data?.result.assumptions ?? [];
  return buildNoteSection('assumptions', 'Assumptions', itemsOfKind(session, 'assumption'), 'Validated', 'Needs validation', notes, 'No assumptions were recorded.');
}

export function buildRisksSection(session: ScopingSession): PackageSection {
  const notes = session.outputs.estimate.data?.result.risks ?? [];
  return buildNoteSection('risks', 'Risks', itemsOfKind(session, 'risk'), 'Mitigated', 'Open', notes, 'No risks were recorded.');
}

export function buildDependenciesSection(session: ScopingSession): PackageSection {
  const notes = session.outputs.estimate.data?.result.dependencies ?? [];
  return buildNoteSection('dependencies', 'Dependencies', itemsOfKind(session, 'dependency'), 'Confirmed', 'Outstanding', notes, 'No dependencies were recorded.');
}

const GAP_COLUMNS = ['ID', 'Missing information', 'Critical', 'Estimation inputs affected', 'Status', 'Related IDs'] as const;

const INPUT_LABELS: ReadonlyMap<EstimationInputKey, string> = new Map([
  ['expectedUsers', 'Expected user volume'],
  ['environments', 'Number of environments'],
  ['deliveryDeadline', 'Delivery deadline'],
  ['integrationReadiness', 'Integration readiness'],
  ['dataVolume', 'Data volume'],
  ['complianceScope', 'Compliance scope'],
  ['aiDataAvailability', 'AI data availability'],
  ['targetRegions', 'Target regions'],
]);

function gapRow(item: ScopeItem): string[] {
  const inputs = item.affectsInputs.map((input) => INPUT_LABELS.get(input) ?? input);
  return [item.id, itemText(item), item.critical ? 'Yes' : 'No', joinOrFallback(inputs, 'None'), item.resolved ? 'Resolved' : 'Open', joinOrFallback(item.relatedIds, 'None')];
}

export function buildOpenQuestionsSection(session: ScopingSession): PackageSection {
  const questions = itemsOfKind(session, 'question');
  const gaps = itemsOfKind(session, 'gap');
  if (questions === null || gaps === null) {
    return { id: 'open-questions', title: 'Open questions', blocks: [notGeneratedCallout('no requirements have been analysed and approved yet')] };
  }
  return {
    id: 'open-questions',
    title: 'Open questions',
    blocks: [
      headingBlock(3, 'Clarification questions for the customer'),
      tableOrParagraph([...COLUMNS], questions.map((item) => scopeItemRow(item, 'Answered', 'Open')), 'No clarification questions were recorded.'),
      headingBlock(3, 'Missing information'),
      tableOrParagraph([...GAP_COLUMNS], gaps.map(gapRow), 'The reviewed scope records no missing information.'),
    ],
  };
}
