import { containsNumber, containsTerm, findFirstTerm, hasNumberNear, normalizeForMatch, tokenize } from './textMatch';

describe('normalizeForMatch', () => {
  it('lower-cases, unifies hyphens and collapses whitespace', () => {
    expect(normalizeForMatch('  Real-Time   Single_Sign-On ')).toBe('real time single sign on');
  });
});

describe('containsTerm', () => {
  it('matches longer terms as word stems', () => {
    expect(containsTerm('all data is encrypted at rest', 'encrypt')).toBe(true);
  });

  it('does not match inside a word', () => {
    expect(containsTerm('we will reintegrate later', 'integrat')).toBe(false);
  });

  it('requires short terms to be whole words but tolerates a plural s', () => {
    expect(containsTerm('our aim is growth', 'ai')).toBe(false);
    expect(containsTerm('an ai assistant', 'ai')).toBe(true);
    expect(containsTerm('documented apis exist', 'api')).toBe(true);
    expect(containsTerm('a sapling', 'sap')).toBe(false);
  });

  it('finds a later valid occurrence after an invalid one', () => {
    expect(containsTerm('email and ai', 'ai')).toBe(true);
  });

  it('never matches the empty term', () => {
    expect(containsTerm('anything', '')).toBe(false);
  });

  it('returns the first matching cue of a list', () => {
    expect(findFirstTerm('users must log in', ['shall', 'must', 'log in'])).toBe('must');
    expect(findFirstTerm('nothing here', ['shall'])).toBeUndefined();
  });
});

describe('number helpers', () => {
  it('detects a number followed by a noun within the window', () => {
    expect(hasNumberNear('support 50,000 registered members', ['member'], 3)).toBe(true);
    expect(hasNumberNear('support 50,000 registered members', ['member'], 1)).toBe(false);
    expect(hasNumberNear('store 500gb of files', ['gb'], 1)).toBe(true);
    expect(hasNumberNear('many members', ['member'], 3)).toBe(false);
  });

  it('recognises numeric tokens including currency amounts', () => {
    expect(containsNumber('budget of $250k')).toBe(true);
    expect(containsNumber('the system must be fast')).toBe(false);
  });

  it('tokenises non-Latin text without throwing', () => {
    expect(tokenize(normalizeForMatch('Система должна работать'))).toEqual(['система', 'должна', 'работать']);
  });
});
