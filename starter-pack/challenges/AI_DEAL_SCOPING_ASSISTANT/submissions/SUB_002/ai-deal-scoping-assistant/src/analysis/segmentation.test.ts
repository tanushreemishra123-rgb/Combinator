import { fixtureDocument } from '../test/fixtures';
import { MAX_STATEMENTS, MAX_STATEMENT_CHARACTERS, dedupeStatements, segmentDocument, splitSentences } from './segmentation';
import { documentFromLines } from './testKit';

describe('splitSentences', () => {
  it('splits sentences and semicolon clauses but keeps decimals and abbreviations intact', () => {
    expect(splitSentences('Uptime must be 99.9%. Use SSO, e.g. Okta; budget is fixed.')).toEqual([
      'Uptime must be 99.9%.',
      'Use SSO, e.g. Okta',
      'budget is fixed.',
    ]);
  });

  it('splits on CJK terminators', () => {
    expect(splitSentences('系统必须支持单点登录。系统应该很快。')).toEqual(['系统必须支持单点登录。', '系统应该很快。']);
  });
});

describe('segmentDocument', () => {
  it('skips headings and keeps line number and section for every statement', () => {
    const statements = segmentDocument(fixtureDocument());
    expect(statements.map((statement) => statement.lineNumber)).toEqual([3, 5, 6, 7, 8, 10, 11, 13, 13]);
    const sso = statements.find((statement) => statement.lineNumber === 5);
    expect(sso?.sectionId).toBe('S2');
    expect(sso?.sectionTitle).toBe('Functional needs');
    expect(statements.at(-1)?.text).toBe('our team prefers Microsoft Azure.');
  });

  it('strips bullet and numbering markers while keeping the wording verbatim', () => {
    const document = documentFromLines(['- Users must log in', '2) Admins shall export reports', '* [ ] Optional dark mode', 'a. Support SSO']);
    const texts = segmentDocument(document).map((statement) => statement.text);
    expect(texts).toEqual(['Users must log in', 'Admins shall export reports', '[ ] Optional dark mode', 'Support SSO']);
    for (const statement of segmentDocument(document)) {
      expect(document.lines.find((line) => line.number === statement.lineNumber)?.text).toContain(statement.text);
    }
  });

  it("separates the customer's requirement label from the statement instead of analysing it", () => {
    const document = documentFromLines(['BR1. The solution must cut handling time.', '- **FR-02**: Agents must upload photos. They should add notes.', 'EDI 214 files arrive nightly.']);
    const statements = segmentDocument(document);
    expect(statements.map((statement) => [statement.label, statement.text])).toEqual([
      ['BR', 'The solution must cut handling time.'],
      ['FR', 'Agents must upload photos.'],
      ['FR', 'They should add notes.'],
      ['', 'EDI 214 files arrive nightly.'],
    ]);
  });

  it('drops lines without letters and very short fragments', () => {
    const document = documentFromLines(['---', '| --- | --- |', '12', 'ok', 'We need a customer portal']);
    expect(segmentDocument(document).map((statement) => statement.text)).toEqual(['We need a customer portal']);
  });

  it('cuts very long statements at a word boundary so the quote stays a verbatim prefix', () => {
    const long = `The system must ${'process records '.repeat(60)}quickly`;
    const [statement] = segmentDocument(documentFromLines([long]));
    expect(statement?.text.length).toBeLessThanOrEqual(MAX_STATEMENT_CHARACTERS);
    expect(long.startsWith(statement?.text ?? 'missing')).toBe(true);
  });

  it('caps the number of statements for very long documents', () => {
    const lines = Array.from({ length: MAX_STATEMENTS + 50 }, (_, index) => `The system must support feature number ${index}.`);
    expect(segmentDocument(documentFromLines(lines))).toHaveLength(MAX_STATEMENTS);
  });

  it('returns no statements for an empty document', () => {
    expect(segmentDocument(documentFromLines([]))).toEqual([]);
  });
});

describe('dedupeStatements', () => {
  it('removes statements that differ only in case, spacing or punctuation', () => {
    const document = documentFromLines(['Users must log in.', 'users  must log-in', 'Users must log out.']);
    expect(dedupeStatements(segmentDocument(document)).map((statement) => statement.lineNumber)).toEqual([1, 3]);
  });
});
