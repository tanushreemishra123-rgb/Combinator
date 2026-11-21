/**
 * Requirement-to-output traceability (spec section 2 / Solution Depth Requirement:
 * "Requirement-to-output traceability", "Cross-document coverage and consistency validation").
 * `buildTraceLinks` turns every generated element (capabilities, journeys, architecture
 * components, data domains/topics, integrations, AI use cases, frameworks, estimate workstreams)
 * into one link per requirement/assumption id it cites. `buildCoverageReport` reduces those links,
 * together with the reviewed scope model, into a per-requirement coverage table and the list of
 * generated elements that cite nothing or cite an id outside the approved scope.
 */
import type { ScopingSession, TraceLink } from '../domain';
import { collectElements, elementsToLinks } from './elements';

export { buildCoverageReport } from './coverage';
export { dataTopicLabel } from './labels';

export function buildTraceLinks(session: ScopingSession): TraceLink[] {
  return elementsToLinks(collectElements(session));
}
