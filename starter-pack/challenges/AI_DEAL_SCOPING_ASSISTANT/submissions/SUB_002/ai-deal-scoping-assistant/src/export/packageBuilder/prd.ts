/** "PRD" package section (spec 6): all 14 PRD sections, each statement suffixed with its refs and label. */
import type { PackageSection, ScopingSession } from '../../domain';
import { headingBlock, notGeneratedCallout, paragraphsFromText, provenanceBlock, statementLine } from '../text';

export function buildPrdSection(session: ScopingSession): PackageSection {
  const bundle = session.outputs.prd.data;
  if (bundle === null) {
    return { id: 'prd', title: 'PRD', blocks: [notGeneratedCallout('the PRD has not been generated yet')] };
  }
  const provenance = provenanceBlock(session.outputs.prd.meta);
  const sectionBlocks = bundle.prd.sections.flatMap((section) => [
    headingBlock(4, section.title),
    ...(section.statements.length === 0
      ? paragraphsFromText('No statements were generated for this section from the reviewed scope.')
      : section.statements.map((statement) => ({ type: 'paragraph' as const, text: statementLine(statement) }))),
  ]);
  return {
    id: 'prd',
    title: 'PRD',
    blocks: [...(provenance === null ? [] : [provenance]), ...paragraphsFromText(`Document: ${bundle.prd.title}`), ...sectionBlocks],
  };
}
