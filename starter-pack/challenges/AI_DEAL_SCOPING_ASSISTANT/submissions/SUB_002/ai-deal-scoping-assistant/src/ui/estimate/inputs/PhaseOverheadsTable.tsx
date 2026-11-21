/** Phase overheads (engine rule CR_05): Discovery, Testing and Deployment sized as a % of build effort. */
import type { ReactElement } from 'react';
import type { PhaseOverhead } from '../../../domain';
import { DataTable, NumberInput } from '../../common';
import type { DataTableColumn } from '../../common';
import { useBlankTracking } from './blankTracking';
import { withPhaseOverheadPct } from './configEdits';
import type { BlankTracking } from './blankTracking';

export interface PhaseOverheadsTableProps {
  rows: PhaseOverhead[];
  disabled: boolean;
  onChange: (rows: PhaseOverhead[]) => void;
}

/** A blanked cell keeps the phase's last valid percentage and flags itself, rather than silently zeroing the overhead. */
function buildColumns(
  rows: PhaseOverhead[],
  disabled: boolean,
  onChange: (rows: PhaseOverhead[]) => void,
  blank: BlankTracking<string>,
): DataTableColumn<PhaseOverhead>[] {
  return [
    { id: 'phase', header: 'Phase', render: (row) => row.label },
    {
      id: 'pct',
      header: '% of build effort',
      align: 'end',
      render: (row) => (
        <div className="stack stack-xs">
          <NumberInput
            value={blank.displayValue(row.phaseId, row.pctOfBuild)}
            min={0}
            max={100}
            disabled={disabled}
            onChange={(value) => blank.handleChange(row.phaseId, value, (next) => onChange(withPhaseOverheadPct(rows, row.phaseId, next)))}
          />
          {blank.isBlank(row.phaseId) ? (
            <p className="field-error" role="alert">
              Required - kept at {row.pctOfBuild}%.
            </p>
          ) : null}
        </div>
      ),
    },
  ];
}

export function PhaseOverheadsTable({ rows, disabled, onChange }: PhaseOverheadsTableProps): ReactElement {
  const blank = useBlankTracking<string>();
  return (
    <DataTable
      caption="Phase overhead as a percentage of build effort"
      columns={buildColumns(rows, disabled, onChange, blank)}
      rows={rows}
      getRowId={(row) => row.phaseId}
    />
  );
}
