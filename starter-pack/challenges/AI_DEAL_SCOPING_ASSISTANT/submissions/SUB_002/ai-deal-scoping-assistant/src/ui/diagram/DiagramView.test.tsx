/**
 * Behaviour tests for the JSX SVG diagram renderer: accessible name/description, the legend,
 * node selection (mouse and keyboard), zoom controls, the text alternative and the "no data yet"
 * fallback. Uses `layoutDiagram` for real (a pure, already-tested engine function) against a small
 * hand-built model instead of depending on a planner's output.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { DiagramModel } from '../../domain';
import { DiagramView } from './DiagramView';

function fixtureModel(overrides: Partial<DiagramModel> = {}): DiagramModel {
  return {
    title: 'Test architecture',
    tiers: [
      { id: 'application', label: 'Application' },
      { id: 'data', label: 'Data' },
    ],
    nodes: [
      { id: 'ARC_01', label: 'Web Front End', sublabel: 'Azure Static Web Apps', tierId: 'application', refs: ['FR_01'], external: false },
      { id: 'ARC_02', label: 'Primary Database', sublabel: 'Azure Database for PostgreSQL', tierId: 'data', refs: ['DATA_01'], external: false },
      { id: 'ext:INT_01:Salesforce CRM', label: 'Salesforce CRM', sublabel: 'External system', tierId: 'application', refs: ['INT_01'], external: true },
    ],
    edges: [
      { from: 'ARC_01', to: 'ARC_02', label: 'Reads data', kind: 'data' },
      { from: 'ARC_01', to: 'ext:INT_01:Salesforce CRM', label: 'Sync profile', kind: 'event' },
    ],
    ...overrides,
  };
}

describe('DiagramView', () => {
  it('renders an accessible svg with the given name and a description of its contents', () => {
    render(<DiagramView model={fixtureModel()} ariaLabel="Proposed solution architecture on Microsoft Azure" />);
    const svg = screen.getByRole('img', { name: 'Proposed solution architecture on Microsoft Azure' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText(/3 components and 2 flows/)).toBeInTheDocument();
  });

  it('shows a legend entry for every edge kind', () => {
    render(<DiagramView model={fixtureModel()} ariaLabel="Diagram" />);
    const legend = screen.getByRole('list', { name: 'Diagram edge legend' });
    for (const label of ['Request', 'Event', 'Data', 'Batch', 'Auth', 'Telemetry']) {
      expect(legend).toHaveTextContent(label);
    }
  });

  it('makes a node interactive and calls onSelectNode on click when a handler is supplied', () => {
    const onSelectNode = vi.fn();
    render(<DiagramView model={fixtureModel()} ariaLabel="Diagram" onSelectNode={onSelectNode} />);
    fireEvent.click(screen.getByRole('button', { name: /Web Front End/ }));
    expect(onSelectNode).toHaveBeenCalledWith('ARC_01');
  });

  it('activates a node from the keyboard with Enter', () => {
    const onSelectNode = vi.fn();
    render(<DiagramView model={fixtureModel()} ariaLabel="Diagram" onSelectNode={onSelectNode} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Primary Database/ }), { key: 'Enter' });
    expect(onSelectNode).toHaveBeenCalledWith('ARC_02');
  });

  it('renders nodes as non-interactive when no onSelectNode handler is supplied', () => {
    render(<DiagramView model={fixtureModel()} ariaLabel="Diagram" />);
    expect(screen.queryByRole('button', { name: /Web Front End/ })).not.toBeInTheDocument();
  });

  it('zooms in, out and resets from the toolbar', () => {
    render(<DiagramView model={fixtureModel()} ariaLabel="Diagram" />);
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByText('75%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('provides a text alternative that lists nodes by tier and lets the reviewer select one', () => {
    const onSelectNode = vi.fn();
    render(<DiagramView model={fixtureModel()} ariaLabel="Diagram" onSelectNode={onSelectNode} />);

    fireEvent.click(screen.getByRole('button', { name: 'Application (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Web Front End' }));
    expect(onSelectNode).toHaveBeenCalledWith('ARC_01');

    fireEvent.click(screen.getByRole('button', { name: 'Flows (2)' }));
    expect(screen.getByText(/ARC_01 to ARC_02 \(Data\)/)).toBeInTheDocument();
  });

  it('shows a fallback message instead of an empty canvas when the model has no components', () => {
    render(<DiagramView model={fixtureModel({ nodes: [], edges: [] })} ariaLabel="Diagram" />);
    expect(screen.getByText('This diagram has no components to draw yet.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
