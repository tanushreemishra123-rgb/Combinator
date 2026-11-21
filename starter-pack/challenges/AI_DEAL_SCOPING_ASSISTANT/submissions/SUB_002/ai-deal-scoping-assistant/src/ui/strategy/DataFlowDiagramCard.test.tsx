/**
 * "Data and integration diagram" card: the prerequisite callout before an architecture exists, and
 * node-click wiring back to the Customer Requirements Workspace once one does. `DiagramView` is
 * mocked to a plain stand-in (its own SVG renderer is another engineer's in-progress contract, see
 * src/ui/diagram) so this only tests the wiring this folder owns.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { DiagramModel } from '../../domain';
import { DataFlowDiagramCard, firstRefForNode } from './DataFlowDiagramCard';
import { fixtureArchitectureDesign, fixtureDataIntegrationOutput } from './strategyFixtures';

interface StubDiagramViewProps {
  model: DiagramModel;
  ariaLabel: string;
  onSelectNode?: (nodeId: string) => void;
}

const { mockDiagramView } = vi.hoisted(() => ({ mockDiagramView: vi.fn() }));

vi.mock('../diagram', () => ({
  DiagramView: (props: StubDiagramViewProps) => {
    mockDiagramView(props);
    const firstNode = props.model.nodes.at(0);
    return (
      <div>
        <span>{props.ariaLabel}</span>
        {firstNode !== undefined ? (
          <button type="button" onClick={() => props.onSelectNode?.(firstNode.id)}>
            select first node
          </button>
        ) : null}
      </div>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('firstRefForNode', () => {
  const diagram: DiagramModel = {
    title: 'Data and integration diagram',
    tiers: [{ id: 'sources', label: 'Sources' }],
    nodes: [
      { id: 'node-crm', label: 'Salesforce CRM', sublabel: 'External system', tierId: 'sources', refs: ['INT_01', 'SYS_01'], external: true },
      { id: 'node-no-refs', label: 'Unattributed node', sublabel: '', tierId: 'sources', refs: [], external: false },
    ],
    edges: [],
  };

  it('returns the first requirement id a node cites', () => {
    expect(firstRefForNode(diagram, 'node-crm')).toBe('INT_01');
  });

  it('returns undefined for a node with no references', () => {
    expect(firstRefForNode(diagram, 'node-no-refs')).toBeUndefined();
  });

  it('returns undefined for an id the diagram does not contain', () => {
    expect(firstRefForNode(diagram, 'missing-node')).toBeUndefined();
  });
});

describe('DataFlowDiagramCard', () => {
  it('asks the reviewer to generate the architecture first when there is none yet', () => {
    render(<DataFlowDiagramCard plan={fixtureDataIntegrationOutput()} design={null} onSelectRequirement={vi.fn()} />);

    expect(screen.getByText('Data and integration diagram')).toBeInTheDocument();
    expect(screen.getByText(/Generate the cloud solution architecture first/)).toBeInTheDocument();
    expect(mockDiagramView).not.toHaveBeenCalled();
  });

  it('renders the diagram with an accessible, platform-specific label once the architecture exists', () => {
    render(<DataFlowDiagramCard plan={fixtureDataIntegrationOutput()} design={fixtureArchitectureDesign()} onSelectRequirement={vi.fn()} />);

    expect(screen.getByText('Data and integration diagram for the AZURE architecture')).toBeInTheDocument();
  });

  it('navigates to the first requirement a clicked node cites', () => {
    const onSelectRequirement = vi.fn();
    render(<DataFlowDiagramCard plan={fixtureDataIntegrationOutput()} design={fixtureArchitectureDesign()} onSelectRequirement={onSelectRequirement} />);

    fireEvent.click(screen.getByRole('button', { name: 'select first node' }));
    expect(onSelectRequirement).toHaveBeenCalledTimes(1);
    expect(onSelectRequirement).toHaveBeenCalledWith(expect.any(String));
  });
});
