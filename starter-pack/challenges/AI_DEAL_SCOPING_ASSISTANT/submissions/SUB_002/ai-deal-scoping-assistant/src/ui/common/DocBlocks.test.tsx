import { render, screen } from '@testing-library/react';
import { DocBlocks } from './DocBlocks';
import type { DocBlock } from '../../domain';

describe('DocBlocks', () => {
  it('renders a paragraph block as escaped text, never as injected markup', () => {
    const blocks: DocBlock[] = [{ type: 'paragraph', text: 'Contains <script>alert(1)</script> literally' }];
    const { container } = render(<DocBlocks blocks={blocks} />);
    expect(screen.getByText(/Contains <script>alert\(1\)<\/script> literally/)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders a heading block at the requested level', () => {
    render(<DocBlocks blocks={[{ type: 'heading', level: 3, text: 'Section title' }]} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Section title' })).toBeInTheDocument();
  });

  it('renders a list block as a bulleted list of every item', () => {
    render(<DocBlocks blocks={[{ type: 'list', items: ['First', 'Second'] }]} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders a table block with its columns and rows', () => {
    render(
      <DocBlocks
        blocks={[{ type: 'table', columns: ['ID', 'Title'], rows: [['FR_01', 'Sign in']] }]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    expect(screen.getByText('FR_01')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('renders a callout block with its tone, title and text', () => {
    render(<DocBlocks blocks={[{ type: 'callout', tone: 'warning', title: 'Heads up', text: 'Needs review' }]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Heads up');
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });

  it('renders a keyValues block as label/value pairs', () => {
    render(<DocBlocks blocks={[{ type: 'keyValues', pairs: [{ key: 'Platform', value: 'AWS' }] }]} />);
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
  });

  it('renders a diagram block through the caller-supplied render prop', () => {
    render(
      <DocBlocks
        blocks={[{ type: 'diagram', title: 'Architecture', mermaid: 'graph TD; A-->B;', diagramId: 'architecture' }]}
        renderDiagram={(block) => <div data-testid="diagram">{block.title}</div>}
      />,
    );
    expect(screen.getByTestId('diagram')).toHaveTextContent('Architecture');
  });

  it('falls back to a plain message when a diagram block has no renderer', () => {
    render(<DocBlocks blocks={[{ type: 'diagram', title: 'Architecture', mermaid: 'graph TD;', diagramId: 'data-flow' }]} />);
    expect(screen.getByText(/Architecture \(diagram unavailable\)/)).toBeInTheDocument();
  });
});
