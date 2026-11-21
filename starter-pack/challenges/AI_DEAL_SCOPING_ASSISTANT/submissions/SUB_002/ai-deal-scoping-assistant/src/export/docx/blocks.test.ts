import type { PackageSection } from '../../domain';
import { blockToXml, sectionToXml } from './blocks';

describe('blockToXml', () => {
  it('renders every block type to some WordprocessingML markup', () => {
    expect(blockToXml({ type: 'paragraph', text: 'x' })).toContain('<w:p>');
    expect(blockToXml({ type: 'heading', level: 3, text: 'x' })).toContain('Heading3');
    expect(blockToXml({ type: 'list', items: ['a', 'b'] }).match(/<w:numPr>/g)).toHaveLength(2);
    expect(blockToXml({ type: 'table', columns: ['A'], rows: [['1']] })).toContain('<w:tbl>');
    expect(blockToXml({ type: 'callout', tone: 'info', title: 't', text: 'x' })).toContain('Callout');
    expect(blockToXml({ type: 'keyValues', pairs: [{ key: 'K', value: 'V' }] })).toContain('K: V');
  });

  it('renders a diagram block as a titled list of nodes-by-tier and flows', () => {
    const xml = blockToXml({ type: 'diagram', title: 'Architecture', mermaid: '  subgraph t1["Application"]\n    n1["API"]\n  end\n  n1 --> n1', diagramId: 'architecture' });
    expect(xml).toContain('Architecture');
    expect(xml).toContain('Nodes by tier');
    expect(xml).toContain('Application');
    expect(xml).toContain('API');
    expect(xml).toContain('Flows');
  });

  it('says there is nothing to show for an empty diagram instead of rendering nothing', () => {
    const xml = blockToXml({ type: 'diagram', title: 'Architecture', mermaid: 'flowchart TB\n  %% No diagram elements to display yet.', diagramId: 'architecture' });
    expect(xml).toContain('No diagram elements to display yet.');
    expect(xml).toContain('No flows to display yet.');
  });
});

describe('sectionToXml', () => {
  it('renders a level-1 heading followed by every block in order', () => {
    const section: PackageSection = { id: 'assumptions', title: 'Assumptions', blocks: [{ type: 'paragraph', text: 'One' }, { type: 'paragraph', text: 'Two' }] };
    const xml = sectionToXml(section);
    expect(xml.indexOf('Heading1')).toBeLessThan(xml.indexOf('One'));
    expect(xml.indexOf('One')).toBeLessThan(xml.indexOf('Two'));
  });
});
