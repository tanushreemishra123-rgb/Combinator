/** "Executive summary" package section (spec 6): the session's reviewed summary, or a deterministic fallback. */
import type { PackageSection, ScopingSession } from '../../domain';
import { buildSummaryContext, planExecutiveSummary } from '../summary';
import { notGeneratedCallout, paragraphsFromText } from '../text';

export function buildExecutiveSummarySection(session: ScopingSession): PackageSection {
  const reviewed = session.executiveSummary.trim();
  if (reviewed.length > 0) {
    return { id: 'executive-summary', title: 'Executive summary', blocks: paragraphsFromText(reviewed) };
  }
  if (session.scope === null) {
    return {
      id: 'executive-summary',
      title: 'Executive summary',
      blocks: [notGeneratedCallout('no requirements have been analysed and approved yet, so no executive summary can be produced')],
    };
  }
  const fallback = planExecutiveSummary(buildSummaryContext(session, session.scope));
  return { id: 'executive-summary', title: 'Executive summary', blocks: paragraphsFromText(fallback) };
}
