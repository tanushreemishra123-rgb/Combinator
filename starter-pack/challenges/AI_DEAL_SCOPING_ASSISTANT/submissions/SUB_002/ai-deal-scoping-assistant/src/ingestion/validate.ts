/** User-facing validation of pasted/uploaded requirements text, ahead of analysis. */
import type { ValidationIssue } from '../domain';
import { MAX_REQUIREMENTS_CHARACTERS, MIN_REQUIREMENTS_CHARACTERS } from './constants';

const HAS_LETTER_PATTERN = /\p{L}/u;

function issue(code: string, message: string): ValidationIssue {
  return { severity: 'error', code, message, refs: [] };
}

/**
 * Flags empty, too-short, too-long, or letter-free requirements text before it is sent for
 * analysis. Returns an empty array when the text is usable.
 */
export function validateRequirementsText(rawText: string): ValidationIssue[] {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return [issue('empty', 'The requirements text is empty. Paste or upload the customer requirements before analyzing.')];
  }
  const issues: ValidationIssue[] = [];
  if (trimmed.length < MIN_REQUIREMENTS_CHARACTERS) {
    issues.push(
      issue(
        'too-short',
        `The requirements text is only ${trimmed.length} characters. Add more detail (at least ${MIN_REQUIREMENTS_CHARACTERS} characters) so the assistant has enough context to analyze.`,
      ),
    );
  }
  if (trimmed.length > MAX_REQUIREMENTS_CHARACTERS) {
    issues.push(
      issue(
        'too-long',
        `The requirements text is ${trimmed.length} characters, over the ${MAX_REQUIREMENTS_CHARACTERS.toLocaleString('en-US')}-character limit. Split it into a shorter document or summarize before uploading.`,
      ),
    );
  }
  if (!HAS_LETTER_PATTERN.test(trimmed)) {
    issues.push(issue('no-letters', 'The requirements text does not contain any readable words. Check that the file was extracted correctly.'));
  }
  return issues;
}
