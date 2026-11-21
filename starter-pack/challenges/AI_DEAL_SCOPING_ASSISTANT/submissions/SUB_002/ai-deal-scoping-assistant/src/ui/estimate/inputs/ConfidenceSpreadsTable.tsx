/** Read-only confidence spreads (engine rule CR_08): how far the low/high range sits from the likely value. */
import type { ReactElement } from 'react';
import type { ConfidenceSpread } from '../../../domain';
import { DataTable, formatNumber } from '../../common';
import type { DataTableColumn } from '../../common';

export interface ConfidenceSpreadsTableProps {
  rows: ConfidenceSpread[];
}

const COLUMNS: DataTableColumn<ConfidenceSpread>[] = [
  { id: 'confidence', header: 'Confidence', render: (row) => row.confidence },
  { id: 'low', header: 'Low', align: 'end', render: (row) => `-${formatNumber(row.lowPct)}%` },
  { id: 'high', header: 'High', align: 'end', render: (row) => `+${formatNumber(row.highPct)}%` },
];

export function ConfidenceSpreadsTable({ rows }: ConfidenceSpreadsTableProps): ReactElement {
  return <DataTable caption="Range width applied around the likely value by confidence level" columns={COLUMNS} rows={rows} getRowId={(row) => row.confidence} />;
}
