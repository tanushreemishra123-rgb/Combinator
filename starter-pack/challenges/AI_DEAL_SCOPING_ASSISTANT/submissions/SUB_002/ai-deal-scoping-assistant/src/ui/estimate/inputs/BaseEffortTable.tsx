/**
 * Collapsible base-effort table (spec 5, "Number and complexity of functional capabilities" and
 * similar drivers; engine rule CR_01): person-days per driver type x complexity. Clearing a cell
 * does not silently reprice that driver at 0 days: the table keeps its last valid value and flags
 * the cell as required until a number is entered again.
 */
import type { ReactElement } from 'react';
import type { BaseEffortRow, Complexity } from '../../../domain';
import { DataTable, Disclosure, NumberInput } from '../../common';
import type { DataTableColumn } from '../../common';
import { COMPLEXITY_OPTIONS } from '../labels';
import { useBlankTracking } from './blankTracking';
import type { BlankTracking } from './blankTracking';
import { withBaseEffortValue } from './configEdits';

export interface BaseEffortTableProps {
  rows: BaseEffortRow[];
  disabled: boolean;
  onChange: (rows: BaseEffortRow[]) => void;
}

function cellValue(row: BaseEffortRow, complexity: Complexity): number {
  return row.days.find((cell) => cell.complexity === complexity)?.value ?? 0;
}

function cellKey(driverType: string, complexity: Complexity): string {
  return `${driverType}|${complexity}`;
}

function buildColumns(
  rows: BaseEffortRow[],
  disabled: boolean,
  onChange: (rows: BaseEffortRow[]) => void,
  blank: BlankTracking<string>,
): DataTableColumn<BaseEffortRow>[] {
  const complexityColumns: DataTableColumn<BaseEffortRow>[] = COMPLEXITY_OPTIONS.map((complexity) => ({
    id: complexity,
    header: complexity,
    align: 'end',
    render: (row) => {
      const key = cellKey(row.driverType, complexity);
      const committed = cellValue(row, complexity);
      return (
        <div className="stack stack-xs">
          <NumberInput
            value={blank.displayValue(key, committed)}
            min={0}
            disabled={disabled}
            onChange={(value) => blank.handleChange(key, value, (next) => onChange(withBaseEffortValue(rows, row.driverType, complexity, next)))}
          />
          {blank.isBlank(key) ? (
            <p className="field-error" role="alert">
              Required - kept at {committed}.
            </p>
          ) : null}
        </div>
      );
    },
  }));
  return [{ id: 'driverType', header: 'Driver type', render: (row) => row.label }, ...complexityColumns];
}

export function BaseEffortTable({ rows, disabled, onChange }: BaseEffortTableProps): ReactElement {
  const blank = useBlankTracking<string>();
  return (
    <Disclosure summary="Base effort (person-days per driver type x complexity)">
      <DataTable
        caption="Base effort in person-days by driver type and complexity level"
        columns={buildColumns(rows, disabled, onChange, blank)}
        rows={rows}
        getRowId={(row) => row.driverType}
      />
    </Disclosure>
  );
}
