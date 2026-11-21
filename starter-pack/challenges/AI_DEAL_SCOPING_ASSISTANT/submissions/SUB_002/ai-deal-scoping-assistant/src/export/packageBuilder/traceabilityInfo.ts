/**
 * "Traceability information" package section (spec 6, Solution Depth Requirement:
 * "source traceability at requirement level" and "requirement-to-output traceability"): the
 * customer-text source reference for every requirement, plus - read from the output side - every
 * generated element with the requirements it cites. The requirement-side view of the same links
 * is the coverage matrix in "Requirement coverage", so the two sections do not repeat each other.
 */
import { buildTraceLinks } from '../../traceability';
import type { PackageSection, ScopeItem, ScopingSession, TraceLink } from '../../domain';
import { compareScopeItems, getRequirements, kindLabel } from '../../scope';
import { headingBlock, notGeneratedCallout, refsCell, sourceReferenceText, tableOrParagraph } from '../text';

const TARGET_TYPE_NOUN: ReadonlyMap<TraceLink['targetType'], string> = new Map([
  ['capability', 'Capability'],
  ['component', 'Architecture component'],
  ['dataDomain', 'Data domain'],
  ['dataTopic', 'Data topic'],
  ['integration', 'Integration'],
  ['aiUseCase', 'AI use case'],
  ['framework', 'Framework'],
  ['workstream', 'Workstream'],
  ['journey', 'User journey'],
]);

/** Longest customer quote shown in full; longer ones are cut at a word boundary. */
const MAX_WORDING_LENGTH = 140;

/**
 * The customer's own sentence behind a requirement, so a reader can check the source reference
 * against the package alone without opening the original requirements text.
 */
export function customerWording(item: ScopeItem): string {
  const quote = item.source?.quote.trim() ?? '';
  if (quote.length === 0) {
    return 'No customer wording recorded';
  }
  if (quote.length <= MAX_WORDING_LENGTH) {
    return `"${quote}"`;
  }
  const cut = quote.slice(0, MAX_WORDING_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `"${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}..."`;
}

function sourceRow(item: ScopeItem): string[] {
  return [item.id, kindLabel(item.kind), item.title, sourceReferenceText(item.source), customerWording(item)];
}

/** Elements without a structured id (data topics, framework recommendations) are identified by their name alone. */
const STRUCTURED_ID = /^[A-Z]+_\d+$/;

interface OutputRow {
  targetType: TraceLink['targetType'];
  targetId: string;
  targetLabel: string;
  requirementIds: string[];
}

/** One row per generated element, in the order the elements were generated, with the requirements it cites. */
function groupByOutput(links: readonly TraceLink[]): OutputRow[] {
  const rows = new Map<string, OutputRow>();
  for (const link of links) {
    const rowKey = `${link.targetType}:${link.targetId}`;
    const row = rows.get(rowKey) ?? { targetType: link.targetType, targetId: link.targetId, targetLabel: link.targetLabel, requirementIds: [] };
    if (!row.requirementIds.includes(link.requirementId)) {
      row.requirementIds.push(link.requirementId);
    }
    rows.set(rowKey, row);
  }
  return Array.from(rows.values());
}

function outputCells(row: OutputRow): string[] {
  const id = STRUCTURED_ID.test(row.targetId) ? row.targetId : 'Identified by name';
  return [TARGET_TYPE_NOUN.get(row.targetType) ?? row.targetType, id, row.targetLabel, refsCell(row.requirementIds)];
}

export function buildTraceabilityInfoSection(session: ScopingSession): PackageSection {
  if (session.scope === null) {
    return { id: 'traceability', title: 'Traceability information', blocks: [notGeneratedCallout('no requirements have been analysed and approved yet')] };
  }
  const requirements = [...getRequirements(session.scope)].sort(compareScopeItems);
  const links = buildTraceLinks(session);
  return {
    id: 'traceability',
    title: 'Traceability information',
    blocks: [
      headingBlock(3, 'Source reference per requirement'),
      tableOrParagraph(['ID', 'Type', 'Title', 'Source reference', 'Customer wording'], requirements.map(sourceRow), 'No requirements are recorded in the reviewed scope.'),
      headingBlock(3, 'Generated outputs and the requirements they cite'),
      tableOrParagraph(['Output type', 'Output ID', 'Output', 'Requirements cited'], groupByOutput(links).map(outputCells), 'No generated output cites a requirement yet.'),
    ],
  };
}
