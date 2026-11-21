import type { ZodError, ZodType } from 'zod';
import type { FailureKind } from './types';

export interface ValidationOutcome {
  ok: boolean;
  issues: string[];
  /** Best-effort classification of what went wrong, for the run report. */
  failureKinds: FailureKind[];
}

/** True when a step produced raw text that could not be parsed as JSON. */
export function isMalformed(value: unknown): value is { malformed: true; raw: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).malformed === true &&
    typeof (value as Record<string, unknown>).raw === 'string'
  );
}

export function formatIssues(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}

export function validateAgainst(schema: ZodType, value: unknown): ValidationOutcome {
  if (isMalformed(value)) {
    return {
      ok: false,
      issues: ['(root): output is not valid JSON — the model returned unparseable text'],
      failureKinds: ['invalid-json'],
    };
  }
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, issues: [], failureKinds: [] };

  const issues = formatIssues(result.error);
  const kinds = new Set<FailureKind>();
  for (const issue of result.error.issues) {
    const message = issue.message.toLowerCase();
    const path = issue.path.join('.').toLowerCase();
    if (issue.code === 'invalid_type' && message.includes('undefined')) {
      kinds.add('missing-field');
    } else if (path.includes('confidence') || message.includes('confidence')) {
      kinds.add('low-confidence');
    } else {
      kinds.add('schema');
    }
  }
  return { ok: false, issues, failureKinds: [...kinds] };
}
