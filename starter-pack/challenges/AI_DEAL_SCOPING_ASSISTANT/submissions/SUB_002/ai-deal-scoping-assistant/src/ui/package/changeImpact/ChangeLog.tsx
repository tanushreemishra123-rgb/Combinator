/** "Change log" of applied ImpactReports, newest first, with the sections resolved by each. */
import type { ReactElement } from 'react';
import type { ImpactReport } from '../../../domain';
import { sectionLabel } from '../../../impact';
import { Badge, Card, EmptyState, formatDateTime } from '../../common';

export interface ChangeLogProps {
  reports: ImpactReport[];
}

function ChangeLogEntry({ report }: { report: ImpactReport }): ReactElement {
  return (
    <li className="change-log-entry">
      <div className="cluster">
        <p className="change-log-label">{report.change.label}</p>
        <span className="text-subtle text-xs">{formatDateTime(report.createdAt)}</span>
      </div>
      <div className="cluster">
        <span className="text-sm text-muted">Resolved sections:</span>
        {report.resolvedSections.length === 0 ? (
          <span className="text-subtle text-sm">None yet</span>
        ) : (
          report.resolvedSections.map((section) => (
            <Badge key={section} tone="success">
              {sectionLabel(section)}
            </Badge>
          ))
        )}
      </div>
    </li>
  );
}

export function ChangeLog({ reports }: ChangeLogProps): ReactElement {
  if (reports.length === 0) {
    return (
      <Card title="Change log">
        <EmptyState title="No changes applied yet" message="Every change you apply is recorded here, newest first, with the sections it has resolved." />
      </Card>
    );
  }
  const newestFirst = [...reports].reverse();
  return (
    <Card title="Change log">
      <ul className="stack stack-md change-log-list">
        {newestFirst.map((report) => (
          <ChangeLogEntry key={report.id} report={report} />
        ))}
      </ul>
    </Card>
  );
}
