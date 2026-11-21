/** "Customer objectives" package section (spec 6): the reviewed business-objective (BR_*) items. */
import type { PackageSection, ScopingSession } from '../../domain';
import { getInScopeItemsByKind } from '../../scope';
import { notGeneratedCallout, sourceReferenceText, tableOrParagraph } from '../text';

const COLUMNS = ['ID', 'Business objective', 'Priority', 'Source reference'] as const;

export function buildCustomerObjectivesSection(session: ScopingSession): PackageSection {
  if (session.scope === null) {
    return {
      id: 'customer-objectives',
      title: 'Customer objectives',
      blocks: [notGeneratedCallout('no requirements have been analysed and approved yet')],
    };
  }
  const objectives = getInScopeItemsByKind(session.scope, 'business');
  const rows = objectives.map((item) => [item.id, `${item.title}: ${item.description}`, item.priority, sourceReferenceText(item.source)]);
  return {
    id: 'customer-objectives',
    title: 'Customer objectives',
    blocks: [tableOrParagraph([...COLUMNS], rows, 'No business objectives were captured in the reviewed scope model.')],
  };
}
