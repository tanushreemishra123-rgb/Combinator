/**
 * Expandable driver table (spec 5, "Estimate Drivers"): one row per scope driver behind a
 * workstream, with the reviewer's own complexity override replacing the AI suggestion (rule CR_01).
 */
import type { ReactElement } from 'react';
import type { Complexity, EstimateDriver } from '../../../domain';
import { Badge, DataTable, RefChips, Select } from '../../common';
import type { DataTableColumn, SelectOption } from '../../common';
import { COMPLEXITY_OPTIONS, driverTypeLabel } from '../labels';

export interface DriverTableProps {
  drivers: EstimateDriver[];
  disabled: boolean;
  onSetDriverComplexity: (driverId: string, complexity: Complexity) => void;
  onSelectRequirement: (id: string) => void;
}

const COMPLEXITY_SELECT_OPTIONS: SelectOption[] = COMPLEXITY_OPTIONS.map((complexity) => ({ value: complexity, label: complexity }));

function isComplexity(value: string): value is Complexity {
  return (COMPLEXITY_OPTIONS as readonly string[]).includes(value);
}

function SourceTag({ driver }: { driver: EstimateDriver }): ReactElement {
  return driver.complexitySource === 'user-set' ? <Badge tone="primary">User-set</Badge> : <Badge tone="violet">AI-suggested</Badge>;
}

function buildColumns(disabled: boolean, onSetDriverComplexity: (driverId: string, complexity: Complexity) => void, onSelectRequirement: (id: string) => void): DataTableColumn<EstimateDriver>[] {
  return [
    { id: 'id', header: 'ID', render: (driver) => <Badge tone="neutral">{driver.id}</Badge> },
    { id: 'label', header: 'Driver', render: (driver) => driver.label },
    { id: 'type', header: 'Type', render: (driver) => driverTypeLabel(driver.type) },
    {
      id: 'complexity',
      header: 'Complexity',
      render: (driver) => (
        <Select
          value={driver.complexity}
          options={COMPLEXITY_SELECT_OPTIONS}
          disabled={disabled}
          onChange={(value) => {
            if (isComplexity(value)) {
              onSetDriverComplexity(driver.id, value);
            }
          }}
        />
      ),
    },
    { id: 'source', header: 'Source', render: (driver) => <SourceTag driver={driver} /> },
    { id: 'unitDays', header: 'Unit days', align: 'end', render: (driver) => driver.unitDays },
    { id: 'rationale', header: 'Rationale', render: (driver) => driver.rationale },
    { id: 'refs', header: 'References', render: (driver) => <RefChips refs={driver.refIds} onSelect={onSelectRequirement} /> },
  ];
}

export function DriverTable({ drivers, disabled, onSetDriverComplexity, onSelectRequirement }: DriverTableProps): ReactElement {
  return (
    <DataTable
      caption="Estimate drivers with their type, complexity, source, rationale, unit days and references"
      columns={buildColumns(disabled, onSetDriverComplexity, onSelectRequirement)}
      rows={drivers}
      getRowId={(driver) => driver.id}
    />
  );
}
