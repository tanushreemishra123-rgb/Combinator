import { normalizeRequirements } from './normalize';

describe('normalizeRequirements', () => {
  it('unifies CRLF and CR line endings to LF', () => {
    const result = normalizeRequirements('Line one\r\nLine two\rLine three');
    expect(result.text).toBe('Line one\nLine two\nLine three');
  });

  it('strips a leading BOM, zero-width characters and control characters', () => {
    // Built from code points (rather than \u escapes) so the invisible characters under test -
    // BOM, zero-width space, and a BEL control character - are unambiguous in the source itself.
    const bom = String.fromCharCode(0xfeff);
    const zeroWidthSpace = String.fromCharCode(0x200b);
    const bell = String.fromCharCode(0x0007);
    const input = `${bom}Hello${zeroWidthSpace} World${bell}!`;
    const result = normalizeRequirements(input);
    expect(result.text).toBe('Hello World!');
  });

  it('converts tabs to spaces and trims trailing whitespace per line', () => {
    const result = normalizeRequirements('Col1\tCol2   \nSecond line\t');
    expect(result.lines.map((line) => line.text)).toEqual(['Col1 Col2', 'Second line']);
  });

  it('collapses runs of 3 or more blank lines to a single blank line', () => {
    const result = normalizeRequirements('First\n\n\n\n\nSecond');
    expect(result.text).toBe('First\n\nSecond');
  });

  it('leaves runs of 1 or 2 blank lines untouched', () => {
    const result = normalizeRequirements('First\n\nSecond\n\n\nThird');
    expect(result.text).toBe('First\n\nSecond\n\n\nThird');
  });

  it('keeps 1-based line numbers stable over the normalised text, blank lines included', () => {
    const result = normalizeRequirements('# Title\n\nBody line');
    expect(result.lines.map((line) => line.number)).toEqual([1, 2, 3]);
    expect(result.lines.at(1)?.text).toBe('');
  });

  it('detects a markdown heading and assigns its level from the hash count', () => {
    const result = normalizeRequirements('# Title\nIntro text\n## Sub-section\nMore text');
    expect(result.sections.map((section) => ({ title: section.title, level: section.level }))).toEqual([
      { title: 'Title', level: 1 },
      { title: 'Sub-section', level: 2 },
    ]);
  });

  it('detects a numbered heading and derives its level from the numbering depth', () => {
    const result = normalizeRequirements('1. Business goals\nWe want growth\n2.3 Delivery constraints\nGo live in Q1');
    expect(result.sections.map((section) => ({ title: section.title, level: section.level }))).toEqual([
      { title: 'Business goals', level: 1 },
      { title: 'Delivery constraints', level: 2 },
    ]);
  });

  it('does not treat a numbered sentence ending in punctuation as a heading', () => {
    const result = normalizeRequirements('1. We need this delivered by March.\nMore detail on that.');
    expect(result.sections).toHaveLength(1);
    expect(result.sections.at(0)?.title).toBe('Introduction');
  });

  it('detects a short ALL-CAPS line as a heading', () => {
    const result = normalizeRequirements('BUSINESS GOALS\nWe want to grow revenue.');
    expect(result.sections.at(0)?.title).toBe('BUSINESS GOALS');
  });

  it('detects a short colon-terminated line followed by content as a heading', () => {
    const result = normalizeRequirements('Security requirements:\nData must be encrypted at rest.');
    expect(result.sections.at(0)?.title).toBe('Security requirements');
  });

  it('does not treat a trailing colon line with nothing under it as a heading', () => {
    const result = normalizeRequirements('Notes\nSee appendix:');
    expect(result.sections).toHaveLength(1);
    expect(result.sections.at(0)?.title).toBe('Introduction');
  });

  it('puts text before the first heading into an Introduction section', () => {
    const result = normalizeRequirements('Some preamble text.\n# Real heading\nBody.');
    expect(result.sections.map((section) => section.title)).toEqual(['Introduction', 'Real heading']);
    expect(result.sections.at(0)?.lineStart).toBe(1);
    expect(result.sections.at(0)?.lineEnd).toBe(1);
  });

  it('omits the Introduction section when the document starts with a heading', () => {
    const result = normalizeRequirements('# Real heading\nBody.');
    expect(result.sections.map((section) => section.title)).toEqual(['Real heading']);
  });

  it('falls back to a single Introduction section when no heading is detected', () => {
    const result = normalizeRequirements('Just a paragraph.\nAnother paragraph.');
    expect(result.sections).toHaveLength(1);
    expect(result.sections.at(0)).toMatchObject({ id: 'S1', title: 'Introduction', lineStart: 1 });
  });

  it('gives every line a sectionId that matches an entry in sections, and sections cover lineStart..lineEnd', () => {
    const result = normalizeRequirements('# A\nline a1\n## B\nline b1\nline b2\n# C\nline c1');
    const sectionIds = new Set(result.sections.map((section) => section.id));
    for (const line of result.lines) {
      expect(sectionIds.has(line.sectionId)).toBe(true);
    }
    for (const section of result.sections) {
      const linesInSection = result.lines.filter((line) => line.sectionId === section.id);
      expect(linesInSection.length).toBe(section.lineEnd - section.lineStart + 1);
    }
  });

  it('produces a sensible word count for non-Latin (CJK) text with no spaces', () => {
    const result = normalizeRequirements('系统必须支持中文需求文档');
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('produces a sensible word count for mixed Latin and non-Latin text', () => {
    const result = normalizeRequirements('The system must support 中文 and 한국어 input.');
    expect(result.wordCount).toBeGreaterThan(5);
  });

  it('handles an empty string without crashing', () => {
    const result = normalizeRequirements('');
    expect(result.text).toBe('');
    expect(result.wordCount).toBe(0);
    expect(result.lines).toHaveLength(1);
  });
});
