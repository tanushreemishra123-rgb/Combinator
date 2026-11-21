/**
 * Term matching primitives shared by the signal matcher, the classifier and the gap checklist.
 *
 * Matching is deliberately regex-free for the vocabulary itself: every term is a plain lower-case
 * string located with `indexOf` plus a word-boundary check, so the keyword tables stay data and no
 * pattern is ever built from a variable.
 */

/** Terms of this length or shorter ('sso', 'erp', 'ai') must match a whole word, not a word start. */
export const WHOLE_WORD_MAX_LENGTH = 3;

const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const SEPARATORS = /[-_‐-―]/g;
const APOSTROPHES = /[‘’]/g;
const WHITESPACE = /\s+/g;

/** Lower-cases, unifies hyphen/underscore/apostrophe variants and collapses whitespace. */
export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(SEPARATORS, ' ').replace(APOSTROPHES, "'").replace(WHITESPACE, ' ').trim();
}

function isWordCharacter(character: string): boolean {
  return character !== '' && WORD_CHARACTER.test(character);
}

/** A short term may be followed by a plural 's' ("APIs", "KPIs") and still count as a whole word. */
function endsOnWordBoundary(text: string, end: number): boolean {
  const next = text.charAt(end);
  if (!isWordCharacter(next)) {
    return true;
  }
  return next === 's' && !isWordCharacter(text.charAt(end + 1));
}

function isMatchAt(text: string, term: string, index: number): boolean {
  if (isWordCharacter(text.charAt(index - 1)) && isWordCharacter(term.charAt(0))) {
    return false;
  }
  return term.length > WHOLE_WORD_MAX_LENGTH || endsOnWordBoundary(text, index + term.length);
}

/**
 * True when `term` occurs in `normalizedText` at the start of a word. Longer terms act as stems
 * ('encrypt' matches 'encryption'); short terms must be whole words so 'ai' never matches 'aim'.
 * Both arguments must already be normalised with {@link normalizeForMatch}.
 */
export function containsTerm(normalizedText: string, term: string): boolean {
  if (term === '') {
    return false;
  }
  let index = normalizedText.indexOf(term);
  while (index !== -1) {
    if (isMatchAt(normalizedText, term, index)) {
      return true;
    }
    index = normalizedText.indexOf(term, index + 1);
  }
  return false;
}

/** First term of the list found in the text, or undefined - callers use it as the matched cue. */
export function findFirstTerm(normalizedText: string, terms: readonly string[]): string | undefined {
  return terms.find((term) => containsTerm(normalizedText, term));
}

export function containsAnyTerm(normalizedText: string, terms: readonly string[]): boolean {
  return findFirstTerm(normalizedText, terms) !== undefined;
}

/** Word tokens (letters and digits, any script) of an already normalised text. */
export function tokenize(normalizedText: string): string[] {
  return normalizedText.split(/[^\p{L}\p{N}.,%$€£]+/u).filter((word) => word !== '');
}

const LEADING_DIGIT = /^[$€£]?\d/;

export function isNumericToken(token: string): boolean {
  return LEADING_DIGIT.test(token);
}

export function containsNumber(normalizedText: string): boolean {
  return tokenize(normalizedText).some(isNumericToken);
}

/**
 * True when a numeric token is followed, within `window` tokens, by a token starting with one of
 * the given nouns ("50,000 registered members", "200 concurrent users").
 */
export function hasNumberNear(normalizedText: string, nouns: readonly string[], window: number): boolean {
  const tokens = tokenize(normalizedText);
  return tokens.some((token, index) => {
    if (!isNumericToken(token)) {
      return false;
    }
    const following = tokens.slice(index, index + window + 1);
    return following.some((candidate) => nouns.some((noun) => stripNumber(candidate).startsWith(noun)));
  });
}

/** "500gb" -> "gb" so units glued to the number are still recognised. */
function stripNumber(token: string): string {
  return token.replace(/^[$€£\d.,]+/, '');
}
