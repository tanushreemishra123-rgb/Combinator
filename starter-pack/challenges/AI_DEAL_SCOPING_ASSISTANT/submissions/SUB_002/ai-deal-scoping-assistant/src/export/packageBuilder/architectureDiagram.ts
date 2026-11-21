/** "Architecture diagram" package section (spec 6): the architecture's DiagramModel as a Mermaid block. */
import { diagramToMermaid } from '../../diagram';
import type { DiagramModel, PackageSection } from '../../domain';
import { notGeneratedCallout } from '../text';

export function buildArchitectureDiagramSection(diagram: DiagramModel | undefined): PackageSection {
  if (diagram === undefined) {
    return {
      id: 'architecture-diagram',
      title: 'Architecture diagram',
      blocks: [notGeneratedCallout('the solution architecture has not been generated yet, so no diagram is available')],
    };
  }
  return {
    id: 'architecture-diagram',
    title: 'Architecture diagram',
    blocks: [{ type: 'diagram', title: diagram.title, mermaid: diagramToMermaid(diagram), diagramId: 'architecture' }],
  };
}
