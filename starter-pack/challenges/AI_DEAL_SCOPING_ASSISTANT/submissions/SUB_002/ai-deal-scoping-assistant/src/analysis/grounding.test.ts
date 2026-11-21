import { fixtureDocument } from '../test/fixtures';
import { groundScopeItems, looseNormalize } from './grounding';
import { documentFromLines, draft, quoted } from './testKit';

const document = fixtureDocument();

describe('groundScopeItems', () => {
  it('verifies an exact quote and fills section and line references', () => {
    const { items, issues } = groundScopeItems(
      [draft({ id: 'INT_01', kind: 'integration', source: quoted('sync member profiles with our Salesforce CRM') })],
      document,
    );
    expect(items.at(0)?.source).toEqual({
      sectionId: 'S2',
      sectionTitle: 'Functional needs',
      lineStart: 7,
      lineEnd: 7,
      quote: 'sync member profiles with our Salesforce CRM',
      verified: true,
    });
    expect(items.at(0)?.provenance).toBe('customer-stated');
    expect(issues).toEqual([]);
  });

  it('overwrites line references supplied by the model with the located ones', () => {
    const source = { ...quoted('comply with GDPR'), sectionId: 'S9', lineStart: 99, lineEnd: 99, verified: true };
    const { items } = groundScopeItems([draft({ id: 'SEC_01', kind: 'security', source })], document);
    expect(items.at(0)?.source).toMatchObject({ sectionId: 'S3', lineStart: 11, lineEnd: 11, verified: true });
  });

  it('matches quotes that differ only in case, whitespace or quote style', () => {
    const { items, issues } = groundScopeItems(
      [draft({ id: 'NFR_01', kind: 'nonFunctional', source: quoted('  "the PORTAL must be   available 99.9% of the time"  ') })],
      document,
    );
    expect(items.at(0)?.source).toMatchObject({ lineStart: 10, verified: true });
    expect(issues).toEqual([]);
  });

  it('locates a quote spanning several lines', () => {
    const { items } = groundScopeItems(
      [draft({ id: 'FR_01', kind: 'functional', source: quoted('update their profile.\nMembers should be able to search') })],
      document,
    );
    expect(items.at(0)?.source).toMatchObject({ lineStart: 5, lineEnd: 6, verified: true });
  });

  it('accepts a paraphrased quote above the overlap threshold and adopts the real line', () => {
    const { items, issues } = groundScopeItems(
      [draft({ id: 'FR_03', kind: 'functional', source: quoted('AI assistant answers policy questions from the document library') })],
      document,
    );
    expect(items.at(0)?.source).toMatchObject({
      lineStart: 8,
      verified: true,
      quote: 'We would like an AI assistant that answers policy questions from our document library.',
    });
    expect(issues.map((issue) => issue.code)).toEqual(['quote-realigned']);
  });

  it('downgrades a customer-stated item whose quote is not in the source', () => {
    const { items, issues } = groundScopeItems(
      [draft({ id: 'FR_09', kind: 'functional', source: { ...quoted('Members can trade cryptocurrency in the portal'), lineStart: 4, lineEnd: 4 } })],
      document,
    );
    expect(items.at(0)?.provenance).toBe('ai-inferred');
    expect(items.at(0)?.source).toMatchObject({ verified: false, lineStart: 0, lineEnd: 0, sectionId: '' });
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', code: 'ungrounded-claim', refs: ['FR_09'] })]);
  });

  it('downgrades a customer-stated item that has no quote at all', () => {
    const { items, issues } = groundScopeItems(
      [draft({ id: 'FR_10', kind: 'functional', source: null }), draft({ id: 'FR_11', kind: 'functional', source: quoted('   ') })],
      document,
    );
    expect(items.map((item) => item.provenance)).toEqual(['ai-inferred', 'ai-inferred']);
    expect(issues.map((issue) => issue.code)).toEqual(['ungrounded-claim', 'ungrounded-claim']);
  });

  it('keeps inferred and assumed provenance but never marks an unlocated quote as verified', () => {
    const { items, issues } = groundScopeItems(
      [
        draft({ id: 'RSK_01', kind: 'risk', provenance: 'ai-inferred', source: quoted('This sentence does not exist anywhere') }),
        draft({ id: 'ASM_01', kind: 'assumption', provenance: 'assumed', source: null }),
      ],
      document,
    );
    expect(items.map((item) => item.provenance)).toEqual(['ai-inferred', 'assumed']);
    expect(items.at(0)?.source?.verified).toBe(false);
    expect(issues).toEqual([expect.objectContaining({ severity: 'info', code: 'unverified-quote' })]);
  });

  it('does not fuzzy-match very short quotes', () => {
    const { items } = groundScopeItems([draft({ id: 'FR_12', kind: 'functional', source: quoted('portal members') })], document);
    expect(items.at(0)?.source?.verified).toBe(false);
  });

  it('handles an empty document without throwing', () => {
    const { items } = groundScopeItems([draft({ id: 'FR_01', kind: 'functional', source: quoted('anything at all here') })], documentFromLines([]));
    expect(items.at(0)?.provenance).toBe('ai-inferred');
  });
});

describe('looseNormalize', () => {
  it('removes casing, curly quotes and surrounding noise', () => {
    expect(looseNormalize(' “The  Portal”… ')).toBe('the portal');
  });
});
