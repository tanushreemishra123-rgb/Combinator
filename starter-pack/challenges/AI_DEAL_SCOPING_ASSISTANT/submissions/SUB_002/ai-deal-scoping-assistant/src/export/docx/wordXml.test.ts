import { bulletList, calloutParagraphs, headingParagraph, paragraph, table } from './wordXml';

describe('paragraph / headingParagraph', () => {
  it('XML-escapes the run text', () => {
    expect(paragraph('A & B < C')).toContain('A &amp; B &lt; C');
    expect(paragraph('A & B')).not.toContain('A & B<');
  });

  it('applies the requested paragraph style', () => {
    expect(headingParagraph(1, 'Title')).toContain('<w:pStyle w:val="Heading1"/>');
    expect(headingParagraph(4, 'Sub')).toContain('<w:pStyle w:val="Heading4"/>');
  });
});

describe('bulletList', () => {
  it('renders one numbered-list paragraph per item, escaped', () => {
    const xml = bulletList(['One & two', 'Three']);
    expect(xml.match(/<w:numPr>/g)?.length).toBe(2);
    expect(xml).toContain('One &amp; two');
  });
});

describe('calloutParagraphs', () => {
  it('renders a bold title paragraph followed by the callout text, both shaded', () => {
    const xml = calloutParagraphs('Not generated yet', 'No data <yet>.');
    expect((xml.match(/<w:pStyle w:val="Callout"\/>/g) ?? []).length).toBe(2);
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('No data &lt;yet&gt;.');
  });
});

describe('table', () => {
  it('renders a bold header row and escaped body rows with borders', () => {
    const xml = table(['ID', 'Title & Notes'], [['FR_01', 'A & B']]);
    expect(xml).toContain('<w:tblBorders>');
    expect(xml).toContain('Title &amp; Notes');
    expect(xml).toContain('A &amp; B');
    expect((xml.match(/<w:tr>/g) ?? []).length).toBe(2);
  });

  it('renders an explanatory paragraph instead of an empty table', () => {
    const xml = table(['ID'], []);
    expect(xml).not.toContain('<w:tbl>');
    expect(xml).toContain('No data is available');
  });
});
