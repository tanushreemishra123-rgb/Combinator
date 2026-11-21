/** Validation issues raised while building the scope model (e.g. ungrounded claims downgraded to AI-inferred). */
import type { ReactElement } from 'react';
import type { ValidationIssue } from '../../../domain';
import { Badge, Disclosure, RefChips } from '../../common';

export interface ScopeIssuesPanelProps {
  issues: readonly ValidationIssue[];
  onSelectRef: (id: string) => void;
}

const SEVERITY_TONE: ReadonlyMap<ValidationIssue['severity'], 'danger' | 'warning' | 'info'> = new Map([
  ['error', 'danger'],
  ['warning', 'warning'],
  ['info', 'info'],
]);

export function ScopeIssuesPanel({ issues, onSelectRef }: ScopeIssuesPanelProps): ReactElement | null {
  if (issues.length === 0) {
    return null;
  }

  return (
    <Disclosure summary={`Validation issues from this analysis (${issues.length})`}>
      <ul className="stack stack-sm">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`} className="requirements-issue-row">
            <Badge tone={SEVERITY_TONE.get(issue.severity) ?? 'neutral'}>{issue.severity}</Badge>
            <span>{issue.message}</span>
            {issue.refs.length > 0 ? <RefChips refs={issue.refs} onSelect={onSelectRef} /> : null}
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
