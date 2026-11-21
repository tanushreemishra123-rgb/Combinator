import { isValidIdForKind } from '../domain';
import { normalizeIds } from './idNormalizer';
import { draft } from './testKit';

describe('normalizeIds', () => {
  it('leaves well-formed unique IDs and their references untouched', () => {
    const drafts = [draft({ id: 'FR_01', kind: 'functional', relatedIds: ['Q_01'] }), draft({ id: 'Q_01', kind: 'question', relatedIds: ['FR_01'] })];
    const { items, issues } = normalizeIds(drafts);
    expect(items).toEqual(drafts);
    expect(issues).toEqual([]);
  });

  it('renumbers malformed and wrongly prefixed IDs with the prefix of their kind', () => {
    const { items, issues } = normalizeIds([
      draft({ id: 'req-1', kind: 'functional' }),
      draft({ id: 'FR_01', kind: 'integration' }),
      draft({ id: 'FR_01', kind: 'functional' }),
    ]);
    expect(items.map((item) => item.id)).toEqual(['FR_02', 'INT_01', 'FR_01']);
    expect(items.every((item) => isValidIdForKind(item.id, item.kind))).toBe(true);
    expect(issues.filter((issue) => issue.code === 'id-reassigned')).toHaveLength(2);
  });

  it('makes duplicate IDs unique without taking an ID another item validly holds', () => {
    const { items } = normalizeIds([
      draft({ id: 'FR_01', kind: 'functional' }),
      draft({ id: 'FR_01', kind: 'functional' }),
      draft({ id: 'FR_02', kind: 'functional' }),
    ]);
    expect(items.map((item) => item.id)).toEqual(['FR_01', 'FR_03', 'FR_02']);
  });

  it('remaps relatedIds to the new IDs', () => {
    const { items } = normalizeIds([
      draft({ id: 'integration-crm', kind: 'integration', relatedIds: ['dep-a', 'gap 1'] }),
      draft({ id: 'dep-a', kind: 'dependency', relatedIds: ['integration-crm'] }),
      draft({ id: 'gap 1', kind: 'gap', relatedIds: ['integration-crm'] }),
    ]);
    expect(items.map((item) => item.id)).toEqual(['INT_01', 'DEP_01', 'GAP_01']);
    expect(items.at(0)?.relatedIds).toEqual(['DEP_01', 'GAP_01']);
    expect(items.at(1)?.relatedIds).toEqual(['INT_01']);
  });

  it('drops dangling, duplicate and self references and reports the dangling ones', () => {
    const { items, issues } = normalizeIds([
      draft({ id: 'FR_01', kind: 'functional', relatedIds: ['FR_01', 'Q_01', 'Q_01', 'Q_99', 'ghost'] }),
      draft({ id: 'Q_01', kind: 'question' }),
    ]);
    expect(items.at(0)?.relatedIds).toEqual(['Q_01']);
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', code: 'dangling-reference', refs: ['FR_01'] })]);
    expect(issues.at(0)?.message).toContain('Q_99, ghost');
  });

  it('returns an empty result for no drafts', () => {
    expect(normalizeIds([])).toEqual({ items: [], issues: [] });
  });
});
