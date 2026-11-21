/**
 * "Historical Topcoder projects" (spec 5: "Historical Topcoder project data may be displayed
 * separately as contextual information. It must not silently replace the current solution's
 * scope-based estimation logic."). Reads static seed data only - never the calculated estimate -
 * and says so plainly so it can never be mistaken for an input to the numbers above.
 */
import type { ReactElement } from 'react';
import { getHistoricalReferences } from '../../../estimation';
import { Callout, Card, DataTable, formatNumber } from '../../common';
import type { DataTableColumn } from '../../common';
import type { HistoricalProjectReference } from '../../../domain';

const COLUMNS: DataTableColumn<HistoricalProjectReference>[] = [
  { id: 'name', header: 'Project', render: (project) => project.name },
  { id: 'category', header: 'Category', render: (project) => project.category },
  { id: 'summary', header: 'Summary', render: (project) => project.summary },
  { id: 'duration', header: 'Duration', align: 'end', render: (project) => `${formatNumber(project.durationWeeks)} weeks` },
  { id: 'effort', header: 'Effort', align: 'end', render: (project) => `${formatNumber(project.effortPersonWeeks)} person-weeks` },
  { id: 'model', header: 'Delivery model', render: (project) => project.deliveryModel },
];

export function HistoricalReferencesSection(): ReactElement {
  const projects = getHistoricalReferences();

  return (
    <Card title="Illustrative historical delivery references (context only)" subtitle="Illustrative sample data, not actual Topcoder records. It plays no part in the calculation above.">
      <div className="stack stack-md">
        <Callout tone="info">Shown for context only - these figures are never read by the calculation engine and never replace the scope-based estimate above.</Callout>
        <DataTable caption="Illustrative historical delivery references, shown for context only" columns={COLUMNS} rows={[...projects]} getRowId={(project) => project.id} />
      </div>
    </Card>
  );
}
