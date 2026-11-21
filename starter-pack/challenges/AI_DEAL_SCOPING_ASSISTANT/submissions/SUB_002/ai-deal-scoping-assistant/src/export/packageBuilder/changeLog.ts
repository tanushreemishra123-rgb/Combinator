/** "Change log" package section (spec 6, "Change-Impact Handling"): every recorded ImpactReport. */
import { DataTopicSchema } from '../../domain';
import type { DocBlock, ImpactEntry, ImpactReport, PackageSection, ScopingSession, UnaffectedEntry } from '../../domain';
import { sectionLabel } from '../../impact';
import { dataTopicLabel } from '../../traceability';
import { formatTimestamp, headingBlock, infoCallout, refsCell, tableOrParagraph } from '../text';

/** Data-strategy topics are identified by an internal key; every other element already has a readable structured id. */
function elementName(elementId: string): string {
  const topic = DataTopicSchema.safeParse(elementId);
  return topic.success ? dataTopicLabel(topic.data) : elementId;
}

/** 'Refreshed' once the section has actually been regenerated/recalculated for this change,
 * 'Pending' while it still reflects the pre-change output - a reader could not otherwise tell
 * the two apart from the exported document alone. */
function statusText(report: ImpactReport, entry: ImpactEntry): string {
  return report.resolvedSections.includes(entry.section) ? 'Refreshed' : 'Pending';
}

function affectedRow(report: ImpactReport, entry: ImpactEntry): string[] {
  return [sectionLabel(entry.section), entry.area, entry.action === 'regenerate' ? 'Regenerate' : 'Recalculate', statusText(report, entry), refsCell(entry.elementIds.map(elementName)), entry.reason];
}

function unaffectedRow(entry: UnaffectedEntry): string[] {
  return [sectionLabel(entry.section), entry.area, entry.reason];
}

function reportBlocks(report: ImpactReport): DocBlock[] {
  return [
    headingBlock(3, report.change.label),
    { type: 'keyValues', pairs: [{ key: 'Previous value', value: report.change.from }, { key: 'New value', value: report.change.to }, { key: 'Recorded at', value: formatTimestamp(report.createdAt) }] },
    { type: 'paragraph', text: report.explanation },
    headingBlock(4, 'Affected sections'),
    tableOrParagraph(['Section', 'Area', 'Action', 'Status', 'Elements', 'Reason'], report.affected.map((entry) => affectedRow(report, entry)), 'No sections were affected by this change.'),
    headingBlock(4, 'Confirmed unaffected'),
    tableOrParagraph(['Section', 'Area', 'Reason'], report.unaffected.map(unaffectedRow), 'No sections were confirmed unaffected.'),
  ];
}

export function buildChangeLogSection(session: ScopingSession): PackageSection {
  if (session.changeLog.length === 0) {
    return {
      id: 'change-log',
      title: 'Change log',
      blocks: [infoCallout('No changes recorded', 'This session still reflects the initial reviewed scope and configuration; no change has been made and re-analysed yet.')],
    };
  }
  return { id: 'change-log', title: 'Change log', blocks: session.changeLog.flatMap(reportBlocks) };
}
