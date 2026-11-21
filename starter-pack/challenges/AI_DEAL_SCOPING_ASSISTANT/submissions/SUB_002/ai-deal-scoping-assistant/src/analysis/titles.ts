/**
 * Concise item titles: drop the customer's lead-in ("The portal must be able to ...") and keep the
 * first few meaningful words of what is actually being asked for.
 */

/** Titles are scanned in tables and diagrams, so they stay within a handful of words. */
export const MAX_TITLE_WORDS = 9;
/** A lead-in further into the sentence than this is part of the content, not a preamble. */
const MAX_LEAD_IN_OFFSET = 60;

/** Longest phrases first so "must be able to" is preferred over "must". */
const LEAD_INS: readonly string[] = [
  ' must be able to ', ' should be able to ', ' shall be able to ', ' will be able to ', ' need to be able to ', ' needs to be able to ',
  ' would like to ', ' would like ', ' we want to ', ' we need to ', ' we want ', ' we need ', ' is required to ', ' are required to ',
  ' needs to ', ' need to ', ' has to ', ' have to ', ' must ', ' shall ', ' should ', ' will ', ' wants to ', ' want to ',
];

const TRAILING_STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'the', 'their', 'our', 'with', 'of', 'to', 'in', 'on', 'for', 'or', 'by', 'from', 'at', 'near', 'that', 'which', 'be',
  'is', 'are', 'as', 'its', 'into', 'all', 'any', 'under', 'over', 'than', 'per', 'within', 'between', 'during', 'across', 'via',
  'through', 'including', 'without', 'before', 'after', 'so', 'but', 'while', 'when', 'where', 'who', 'not', 'can', 'will', 'must',
  'should', 'has', 'have', 'was', 'were', 'it', 'they', 'we', 'this', 'these', 'those', 'then', 'also', 'both', 'each', 'every', 'up',
  'about', 'least', 'most', 'such',
]);

const EDGE_PUNCTUATION = /^[\s"'“”([]+|[\s"'“”.,;:!?)\]。]+$/gu;

/** Subjects longer than this are dropped from passive titles unless the predicate alone says too little. */
const MAX_SUBJECT_WORDS = 4;
/** A predicate this short ("under 15 minutes") is meaningless without its subject. */
const MIN_PREDICATE_WORDS = 5;
/** A cut at a joiner ("and", "or") must leave at least this many words to be a meaningful title. */
const MIN_WORDS_BEFORE_JOINER = 3;
/** A cut at a comma needs one word more: an early comma usually separates adjectives or list items. */
const MIN_WORDS_BEFORE_SEPARATOR = 4;
const SUBJECT_DETERMINERS = /^(?:the|all|our|any|each|every)\s+/i;
const CLAUSE_JOINERS: ReadonlySet<string> = new Set(['and', 'or', 'but', 'while', 'so']);

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word !== '').length;
}

/** Number of words before the first joiner or comma - roughly what a shortened title would keep. */
function leadingClauseLength(text: string): number {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const breakIndex = words.findIndex((word) => isJoiner(word) || endsWithSeparator(word));
  return breakIndex === -1 ? words.length : breakIndex;
}

/** "All personal data" + "be encrypted at rest" -> "personal data encrypted at rest". */
function rephrasePassive(subject: string, remainder: string): string {
  if (!remainder.toLowerCase().startsWith('be ')) {
    return remainder;
  }
  const predicate = remainder.slice('be '.length);
  const topic = subject.trim().replace(SUBJECT_DETERMINERS, '');
  const topicWords = countWords(topic);
  if (topicWords === 0) {
    return predicate;
  }
  const predicateIsSelfExplanatory = leadingClauseLength(predicate) >= MIN_PREDICATE_WORDS;
  return topicWords > MAX_SUBJECT_WORDS && predicateIsSelfExplanatory ? predicate : `${topic} ${predicate}`;
}

function stripLeadIn(text: string): string {
  const padded = ` ${text}`;
  const lower = padded.toLowerCase();
  if (lower.length !== padded.length) {
    return text;
  }
  for (const leadIn of LEAD_INS) {
    const index = lower.indexOf(leadIn);
    const remainder = index === -1 || index > MAX_LEAD_IN_OFFSET ? '' : padded.slice(index + leadIn.length).trim();
    if (remainder !== '') {
      return rephrasePassive(padded.slice(0, index), remainder);
    }
  }
  return text;
}

function isJoiner(word: string): boolean {
  return CLAUSE_JOINERS.has(word.toLowerCase());
}

function endsWithSeparator(word: string): boolean {
  return word.endsWith(',') || word.endsWith(';');
}

/**
 * Cuts an over-long title at a clause boundary, else drops dangling stop words. A comma after the
 * opening words wins (what follows is an enumeration or qualifier). Without any comma the last
 * joiner is used, so phrase-level pairs such as "at rest and in transit" stay intact; with an
 * early comma the joiner belongs to a list ("pick, pack and ship") and the title is not cut there.
 */
function shorten(words: readonly string[]): string[] {
  const head = words.slice(0, MAX_TITLE_WORDS);
  const separatorIndex = head.findIndex((word, index) => index >= MIN_WORDS_BEFORE_SEPARATOR && endsWithSeparator(word));
  if (separatorIndex !== -1) {
    return dropTrailingStopWords(head.slice(0, separatorIndex + 1));
  }
  const hasList = head.some(endsWithSeparator);
  const joinerIndex = hasList ? -1 : head.findLastIndex((word, index) => index >= MIN_WORDS_BEFORE_JOINER && isJoiner(word));
  return dropTrailingStopWords(joinerIndex === -1 ? head : head.slice(0, joinerIndex));
}

function dropTrailingStopWords(words: readonly string[]): string[] {
  const kept = [...words];
  while (kept.length > 1 && TRAILING_STOP_WORDS.has((kept.at(-1) ?? '').toLowerCase().replace(EDGE_PUNCTUATION, ''))) {
    kept.pop();
  }
  return kept;
}

function capitalize(text: string): string {
  const [first = '', ...rest] = Array.from(text);
  return first.toUpperCase() + rest.join('');
}

/** Short title for a statement; falls back to the statement itself when nothing can be trimmed. */
export function buildTitle(statementText: string): string {
  const cleaned = statementText.replace(EDGE_PUNCTUATION, '');
  const words = stripLeadIn(cleaned).split(/\s+/).filter((word) => word !== '');
  const limited = words.length > MAX_TITLE_WORDS ? shorten(words) : words;
  const title = limited.join(' ').replace(EDGE_PUNCTUATION, '');
  return capitalize(title === '' ? cleaned : title);
}

/** Ensures a description reads as a full sentence. */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') {
    return trimmed;
  }
  const last = trimmed.at(-1) ?? '';
  return ['.', '?', '!', '。', '？', '！'].includes(last) ? capitalize(trimmed) : `${capitalize(trimmed)}.`;
}
