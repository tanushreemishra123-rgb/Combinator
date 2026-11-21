/** "Architecture diagram" tab (spec "Recommended Application Sections 3"): the diagram built from the generated design; selecting a node opens that component's detail. */
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { buildArchitectureDiagram, platformLabel } from '../../architecture';
import type { ArchitectureDesign } from '../../domain';
import { Callout } from '../common';
import { DiagramView } from '../diagram';

export interface DiagramTabProps {
  design: ArchitectureDesign | null;
  prerequisite: string | null;
  onSelectNode: (nodeId: string) => void;
}

const READY_MESSAGE = 'Use "Design the solution" above to generate the architecture diagram from the reviewed scope.';

interface ReadyDiagramProps {
  design: ArchitectureDesign;
  onSelectNode: (nodeId: string) => void;
}

function ReadyDiagram({ design, onSelectNode }: ReadyDiagramProps): ReactElement {
  const diagram = useMemo(() => buildArchitectureDiagram(design), [design]);
  return <DiagramView model={diagram} ariaLabel={`Proposed solution architecture on ${platformLabel(design.platform)}`} onSelectNode={onSelectNode} />;
}

export function DiagramTab({ design, prerequisite, onSelectNode }: DiagramTabProps): ReactElement {
  if (design === null) {
    return <Callout tone="info">{prerequisite ?? READY_MESSAGE}</Callout>;
  }
  return <ReadyDiagram design={design} onSelectNode={onSelectNode} />;
}
