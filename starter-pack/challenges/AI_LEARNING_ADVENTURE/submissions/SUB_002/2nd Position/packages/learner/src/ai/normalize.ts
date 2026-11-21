export function normalizeAiText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function significantWords(value: string): string[] {
  return normalizeAiText(value)
    .split(' ')
    .filter((word) => word.length >= 4);
}

export function containsAnswerLeak(output: string, correctOptionTexts: readonly string[]): boolean {
  // nosemgrep: ajinabraham.njsscan.dos.regex_dos.regex_dos, gitlab.nodejs_scan.javascript-dos-rule-regex_dos
  const normalizedOutput = normalizeAiText(output);
  if (normalizedOutput.length === 0) return false;

  for (const optionText of correctOptionTexts) {
    const normalizedOption = normalizeAiText(optionText);
    if (normalizedOption.length === 0) continue;
    if (normalizedOption.length >= 3 && normalizedOutput.includes(normalizedOption)) return true;

    const words = normalizedOption.split(' ').filter((word) => word.length > 0);
    if (words.length >= 4) {
      const windowSize = Math.max(4, Math.ceil(words.length * 0.7));
      for (let i = 0; i <= words.length - windowSize; i++) {
        const phrase = words.slice(i, i + windowSize).join(' ');
        if (normalizedOutput.includes(phrase)) return true;
      }
    }
  }

  // nosemgrep: ajinabraham.njsscan.dos.regex_dos.regex_dos, gitlab.nodejs_scan.javascript-dos-rule-regex_dos
  return (
    /\b(the|your|correct)\s+(answer|choice|option)\s+is\b/.test(normalizedOutput) ||
    /\b(choose|select)\s+(option\s+)?[a-d]\b/.test(normalizedOutput) ||
    /\boption\s+[a-d]\s+is\s+correct\b/.test(normalizedOutput)
  );
}

export interface HintGuardResult {
  safe: boolean;
  reason?: 'empty' | 'answer_leak' | 'answer_reveal';
}

export function guardHintOutput(
  output: string,
  correctOptionTexts: readonly string[] = [],
): HintGuardResult {
  if (normalizeAiText(output).length === 0) return { safe: false, reason: 'empty' };
  if (isAnswerRevealRequest(output) || containsAnswerLeak(output, correctOptionTexts)) {
    return { safe: false, reason: isAnswerRevealRequest(output) ? 'answer_reveal' : 'answer_leak' };
  }
  return { safe: true };
}

export function isAnswerRevealRequest(message: string): boolean {
  const normalized = normalizeAiText(message);
  return [
    /\bwhat is the (correct )?answer\b/,
    /\btell me the (correct )?answer\b/,
    /\breveal the (correct )?answer\b/,
    /\bwhich option is correct\b/,
    /\bjust give me the answer\b/,
    /\banswer key\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function isObviouslyOffScope(message: string): boolean {
  const normalized = normalizeAiText(message);
  return [
    /\bweather\b/,
    /\brecipe\b/,
    /\bpolitic(?:s|al)\b/,
    /\bcelebrity\b/,
    /\bmedical diagnosis\b/,
    /\blegal advice\b/,
    /\bwrite (?:a|the) full app\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function hasGroundingAnchor(output: string, authoredExplanation: string): boolean {
  const outputWords = new Set(significantWords(output));
  const explanationWords = significantWords(authoredExplanation);
  if (explanationWords.length === 0) return true;
  const matches = explanationWords.filter((word) => outputWords.has(word)).length;
  return matches >= Math.min(2, explanationWords.length);
}

export function isNearDuplicate(value: string, previousValues: readonly string[]): boolean {
  const normalized = normalizeAiText(value);
  if (normalized.length === 0) return true;
  return previousValues.some((previous) => {
    const words = new Set(significantWords(previous));
    const currentWords = significantWords(value);
    if (words.size === 0 || currentWords.length === 0) return false;
    const overlap = currentWords.filter((word) => words.has(word)).length;
    return overlap / Math.max(words.size, currentWords.length) >= 0.75;
  });
}
