/** Finding constructors and the grading rule shared by every quality check. */
import type { QualityCheck, ScopeItem } from '../domain';
import type { GradedFinding, QualityCheckSpec, QualityContext } from './types';

/** Prefix of every notice raised for content that does not exist yet. */
export const NOT_GENERATED = 'Not generated yet';

export function fail(message: string, refs: readonly string[] = []): GradedFinding {
  return { message, refs: [...refs], severity: 'fail', notice: false };
}

export function warn(message: string, refs: readonly string[] = []): GradedFinding {
  return { message, refs: [...refs], severity: 'warn', notice: false };
}

/** 'Not generated yet: <what is missing and what that means for this check>.' */
export function notGenerated(detail: string, severity: GradedFinding['severity'] = 'warn'): GradedFinding {
  return { message: `${NOT_GENERATED}: ${detail}`, refs: [], severity, notice: true };
}

const AMOUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** 120000 -> '120,000' for effort and money figures quoted in findings. */
export function formatAmount(value: number): string {
  return AMOUNT.format(value);
}

/** 'FR_02 "Policy document search and download"' - how findings name a scope item. */
export function nameItem(item: Pick<ScopeItem, 'id' | 'title'>): string {
  return `${item.id} "${item.title}"`;
}

/** Critical items first, otherwise the original (scope model) order. */
export function criticalFirst(items: readonly ScopeItem[]): ScopeItem[] {
  return [...items.filter((item) => item.critical), ...items.filter((item) => !item.critical)];
}

function statusOf(findings: readonly GradedFinding[]): QualityCheck['status'] {
  if (findings.some((finding) => finding.severity === 'fail')) {
    return 'fail';
  }
  return findings.length > 0 ? 'warn' : 'pass';
}

/**
 * Grading rule: any failing finding fails the check, any other finding makes it a warning, no
 * finding passes. Failing findings are listed first; `count` excludes notices.
 */
export function gradeCheck(spec: QualityCheckSpec, context: QualityContext): QualityCheck {
  const findings = spec.run(context);
  const ordered = [...findings.filter((finding) => finding.severity === 'fail'), ...findings.filter((finding) => finding.severity === 'warn')];
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    status: statusOf(findings),
    count: findings.filter((finding) => !finding.notice).length,
    findings: ordered.map((finding) => ({ message: finding.message, refs: finding.refs })),
  };
}
