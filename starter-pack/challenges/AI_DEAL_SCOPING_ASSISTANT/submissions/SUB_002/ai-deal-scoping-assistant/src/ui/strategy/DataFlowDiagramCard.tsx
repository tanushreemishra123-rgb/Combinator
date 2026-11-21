/** "Data and integration diagram" (spec 4), built from the same plan and architecture design the rest of the tab already shows. */
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { buildDataFlowDiagram } from '../../strategy';
import type { ArchitectureDesign, DataIntegrationOutput, DiagramModel } from '../../domain';
import { Callout, Card } from '../common';
import { DiagramView } from '../diagram';

export interface DataFlowDiagramCardProps {
  plan: DataIntegrationOutput;
  design: ArchitectureDesign | null;
  onSelectRequirement: (id: string) => void;
}

interface ReadyDiagramProps {
  plan: DataIntegrationOutput;
  design: ArchitectureDesign;
  onSelectRequirement: (id: string) => void;
}

/** The first requirement/assumption id a diagram node cites, or undefined for a node with none. */
export function firstRefForNode(diagram: DiagramModel, nodeId: string): string | undefined {
  const node = diagram.nodes.find((candidate) => candidate.id === nodeId);
  return node?.refs.at(0);
}

function ReadyDiagram({ plan, design, onSelectRequirement }: ReadyDiagramProps): ReactElement {
  const diagram = useMemo(() => buildDataFlowDiagram(plan, design), [plan, design]);

  function handleSelectNode(nodeId: string): void {
    const ref = firstRefForNode(diagram, nodeId);
    if (ref !== undefined) {
      onSelectRequirement(ref);
    }
  }

  return (
    <DiagramView
      model={diagram}
      ariaLabel={`Data and integration diagram for the ${design.platform.toUpperCase()} architecture`}
      onSelectNode={handleSelectNode}
    />
  );
}

export function DataFlowDiagramCard({ plan, design, onSelectRequirement }: DataFlowDiagramCardProps): ReactElement {
  return (
    <Card
      title="Data and integration diagram"
      subtitle="How source systems, the integration layer, platform data stores, analytics and AI, and consumers connect."
    >
      {design === null ? (
        <Callout tone="info">Generate the cloud solution architecture first so the diagram has data stores and components to draw.</Callout>
      ) : (
        <ReadyDiagram plan={plan} design={design} onSelectRequirement={onSelectRequirement} />
      )}
    </Card>
  );
}
