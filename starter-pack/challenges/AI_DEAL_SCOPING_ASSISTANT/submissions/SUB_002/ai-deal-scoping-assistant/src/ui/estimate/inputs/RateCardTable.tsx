/**
 * Role-based rate card (spec 5, "Role-based rates"): one editable day rate per role. Clearing a
 * rate sets it to null rather than 0, which blocks that role's cost instead of pricing it as free.
 */
import type { ReactElement } from 'react';
import type { RoleId, RoleRate } from '../../../domain';
import { Badge, DataTable, NumberInput } from '../../common';
import type { DataTableColumn } from '../../common';

export interface RateCardTableProps {
  rates: RoleRate[];
  currency: string;
  disabled: boolean;
  onChangeRate: (roleId: RoleId, dayRate: number | null) => void;
}

function buildColumns(currency: string, disabled: boolean, onChangeRate: (roleId: RoleId, dayRate: number | null) => void): DataTableColumn<RoleRate>[] {
  return [
    { id: 'role', header: 'Role', render: (rate) => rate.label },
    {
      id: 'rate',
      header: `Day rate (${currency})`,
      render: (rate) => <NumberInput value={rate.dayRate} min={0} disabled={disabled} onChange={(value) => onChangeRate(rate.roleId, value)} />,
    },
    {
      id: 'status',
      header: 'Status',
      render: (rate) => (rate.dayRate === null ? <Badge tone="danger">No rate - cost blocked</Badge> : null),
    },
  ];
}

export function RateCardTable({ rates, currency, disabled, onChangeRate }: RateCardTableProps): ReactElement {
  return (
    <DataTable
      caption={`Role-based day rate card in ${currency}`}
      columns={buildColumns(currency, disabled, onChangeRate)}
      rows={rates}
      getRowId={(rate) => rate.roleId}
    />
  );
}
