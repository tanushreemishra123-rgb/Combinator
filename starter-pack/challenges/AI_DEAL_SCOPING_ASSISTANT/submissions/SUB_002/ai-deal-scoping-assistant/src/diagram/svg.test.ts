import { describe, expect, it } from 'vitest';
import { diagramToSvg, escapeXml } from './svg';
import type { DiagramModel } from '../domain';

function sampleModel(): DiagramModel {
  return {
    title: 'Solution Architecture <Preview> & "Draft"',
    tiers: [
      { id: 'app', label: 'Application' },
      { id: 'data', label: 'Data' },
    ],
    nodes: [
      { id: 'api', label: 'API Layer', sublabel: 'Azure API Management', tierId: 'app', refs: ['FR_01', 'FR_02'], external: false },
      { id: 'crm', label: "Customer's CRM", sublabel: 'External system', tierId: 'data', refs: [], external: true },
    ],
    edges: [{ from: 'api', to: 'crm', label: 'Sync <profile>', kind: 'event' }],
  };
}

describe('escapeXml', () => {
  it('escapes every reserved XML character', () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
  });

  it('leaves plain text untouched', () => {
    expect(escapeXml('Member Portal')).toBe('Member Portal');
  });
});

describe('diagramToSvg', () => {
  it('produces a well-formed, escaped standalone SVG document', () => {
    const svg = diagramToSvg(sampleModel());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('<title>Solution Architecture &lt;Preview&gt; &amp; &quot;Draft&quot;</title>');
    expect(svg).not.toContain('<Preview>');
    expect(svg).not.toContain('Sync <profile>');
  });

  it('renders a dashed box for external nodes and a solid box for internal ones', () => {
    const svg = diagramToSvg(sampleModel());
    expect(svg).toContain('node-external');
    expect(svg).toContain('stroke-dasharray="6,4"');
  });

  it('renders a requirement refs line, falling back to an explicit statement when there are none', () => {
    const svg = diagramToSvg(sampleModel());
    expect(svg).toContain('Refs: FR_01, FR_02');
    expect(svg).toContain('No linked requirements');
  });

  it('defines an arrow marker for every edge kind present in the model', () => {
    const svg = diagramToSvg(sampleModel());
    expect(svg).toContain('id="arrow-event"');
  });

  it('renders an empty model as a minimal, valid SVG instead of throwing', () => {
    const svg = diagramToSvg({ title: 'Empty', tiers: [], nodes: [], edges: [] });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<title>Empty</title>');
  });
});
