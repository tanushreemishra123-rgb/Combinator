import type { DiagramModel, PackageDocument, PackageSection } from '../domain';
import { toHtml } from './html';

function doc(sections: PackageSection[]): PackageDocument {
  return { title: 'Acme - Integrated Scoping Package', subtitle: 'Acme Corp', generatedAt: '2026-09-19T00:00:00.000Z', aiModeLabel: 'Mock AI mode', exportStatus: 'Ready', disclaimer: 'This is the mandatory disclaimer statement.', sections };
}

describe('toHtml', () => {
  it('is a standalone document with the title, disclaimer at top and bottom, and a table of contents', () => {
    const html = toHtml(doc([{ id: 'executive-summary', title: 'Executive summary', blocks: [{ type: 'paragraph', text: 'Summary.' }] }]));
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Acme - Integrated Scoping Package</title>');
    expect(html).toContain('@media print');
    // An explicit light page keeps the dark body text readable in a browser that prefers dark mode.
    expect(html).toContain('color-scheme:light;background:#ffffff;');
    const disclaimerOccurrences = html.split('This is the mandatory disclaimer statement.').length - 1;
    expect(disclaimerOccurrences).toBe(2);
    expect(html).toContain('href="#executive-summary"');
  });

  it('escapes every text node, so a malicious statement never becomes live markup', () => {
    const html = toHtml(doc([{ id: 'assumptions', title: 'Assumptions', blocks: [{ type: 'paragraph', text: '<script>alert(1)</script>' }] }]));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes callout, table, list and key/value content the same way', () => {
    const html = toHtml(
      doc([
        {
          id: 'assumptions',
          title: 'Assumptions',
          blocks: [
            { type: 'callout', tone: 'danger', title: 'A & B', text: 'x < y' },
            { type: 'table', columns: ['A & B'], rows: [['<img src=x onerror=alert(1)>']] },
            { type: 'list', items: ['<b>bold</b>'] },
            { type: 'keyValues', pairs: [{ key: 'A & B', value: '<i>italic</i>' }] },
          ],
        },
      ]),
    );
    expect(html).toContain('A &amp; B');
    expect(html).toContain('x &lt; y');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('&lt;i&gt;italic&lt;/i&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).not.toContain('<i>italic</i>');
  });

  it('embeds the diagram as SVG when the DiagramModel is supplied, and Mermaid source otherwise', () => {
    const model: DiagramModel = { title: 'Architecture', tiers: [{ id: 't1', label: 'Application' }], nodes: [{ id: 'n1', label: 'API', sublabel: '', tierId: 't1', refs: [], external: false }], edges: [] };
    const block: PackageSection = { id: 'architecture-diagram', title: 'Architecture diagram', blocks: [{ type: 'diagram', title: 'Architecture', mermaid: 'flowchart TB\n  n1["API"]', diagramId: 'architecture' }] };

    const withoutModel = toHtml(doc([block]));
    expect(withoutModel).toContain('<pre class="diagram-source">');
    expect(withoutModel).toContain('flowchart TB');

    const withModel = toHtml(doc([block]), new Map([['architecture', model]]));
    expect(withModel).toContain('<svg');
    expect(withModel).not.toContain('<pre class="diagram-source">');
  });
});
