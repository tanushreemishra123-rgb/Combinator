/**
 * "Requirement coverage" package section (spec 6, Solution Depth Requirement: "cross-document
 * coverage and consistency validation"): coverage percentage, the per-requirement coverage table,
 * the uncovered-requirement list and any unsupported scope additions, via `buildCoverageReport`.
 */
import type { CoverageRow, DocBlock, PackageSection, ScopeModel, ScopingSession, UnsupportedAddition } from '../../domain';
import { getOpenGaps, getOpenQuestions, kindLabel } from '../../scope';
import { buildCoverageReport } from '../../traceability';
import { headingBlock, joinOrFallback, notGeneratedCallout, refsCell, tableOrParagraph } from '../text';

const COVERAGE_COLUMNS = ['ID', 'Title', 'Type', 'Priority', 'Capabilities', 'Components', 'Strategy elements', 'Workstreams', 'Covered'] as const;

function coverageRow(row: CoverageRow): string[] {
  return [row.requirementId, row.title, kindLabel(row.kind), row.priority, refsCell(row.capabilityIds), refsCell(row.componentIds), refsCell(row.strategyIds), refsCell(row.workstreamIds), row.covered ? 'Yes' : 'No'];
}

function unsupportedRow(addition: UnsupportedAddition): string[] {
  return [addition.label, addition.targetId, addition.reason, joinOrFallback(addition.unknownRefs, 'None')];
}

/**
 * Coverage is measured against the reviewed scope, so a high figure must not be read as "the
 * solution is fully defined" while that scope still has open questions or missing information.
 */
function scopeCompletenessNote(scope: ScopeModel): DocBlock[] {
  const questions = getOpenQuestions(scope).length;
  const gaps = getOpenGaps(scope).length;
  if (questions + gaps === 0) {
    return [];
  }
  const text = `Coverage is measured against the reviewed scope model. That scope still has ${questions} open clarification question(s) and ${gaps} missing-information item(s) (see "Open questions"), so full coverage means every captured requirement is addressed - not that the customer need is fully defined.`;
  return [{ type: 'callout', tone: 'warning', title: 'Read coverage together with the open items', text }];
}

export function buildRequirementCoverageSection(session: ScopingSession): PackageSection {
  if (session.scope === null) {
    return { id: 'requirement-coverage', title: 'Requirement coverage', blocks: [notGeneratedCallout('no requirements have been analysed and approved yet')] };
  }
  const coverage = buildCoverageReport(session);
  return {
    id: 'requirement-coverage',
    title: 'Requirement coverage',
    blocks: [
      {
        type: 'keyValues',
        pairs: [
          { key: 'Overall coverage', value: `${coverage.coveragePct}%` },
          { key: 'High-priority coverage', value: `${coverage.highPriorityCoveragePct}%` },
          { key: 'Covered requirements', value: `${coverage.coveredRequirements} of ${coverage.totalRequirements}` },
        ],
      },
      ...scopeCompletenessNote(session.scope),
      headingBlock(3, 'Coverage by requirement'),
      tableOrParagraph([...COVERAGE_COLUMNS], coverage.rows.map(coverageRow), 'No requirements are recorded in the reviewed scope.'),
      headingBlock(3, 'Uncovered requirements'),
      { type: 'list', items: coverage.uncoveredIds.length === 0 ? ['Every reviewed requirement is covered by at least one capability or architecture/strategy element.'] : coverage.uncoveredIds },
      headingBlock(3, 'Unsupported scope additions'),
      tableOrParagraph(['Element', 'ID', 'Reason', 'Unknown refs'], coverage.unsupportedAdditions.map(unsupportedRow), 'No generated element cites a missing or unapproved requirement.'),
    ],
  };
}
