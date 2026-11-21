/** Pulls a JSON value out of raw model text, tolerating code fences and surrounding prose. */
import { AiProviderError } from './types';

const CODE_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

function stripCodeFence(text: string): string {
  const match = CODE_FENCE_PATTERN.exec(text);
  return match === null ? text : (match.at(1) ?? '');
}

/**
 * Scans for the first balanced `{...}` or `[...]` substring, tracking quoted strings and escapes
 * so braces/brackets inside string values never throw off the depth count.
 */
function findBalancedJson(text: string): string | null {
  let startIndex = -1;
  let openChar = '';
  let closeChar = '';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (startIndex === -1) {
      if (char === '{' || char === '[') {
        startIndex = i;
        openChar = char;
        closeChar = char === '{' ? '}' : ']';
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }
  return null;
}

/**
 * Extracts and parses the first JSON object/array found in `text`. Throws `AiProviderError`
 * (`invalid-response`) when no balanced JSON is found or it fails to parse.
 */
export function extractJson(text: string): unknown {
  const unfenced = stripCodeFence(text);
  const candidate = findBalancedJson(unfenced) ?? findBalancedJson(text);
  if (candidate === null) {
    throw new AiProviderError('invalid-response', 'The AI response did not contain a JSON object or array.');
  }
  try {
    return JSON.parse(candidate);
  } catch {
    throw new AiProviderError('invalid-response', 'The AI response contained malformed JSON that could not be parsed.');
  }
}
