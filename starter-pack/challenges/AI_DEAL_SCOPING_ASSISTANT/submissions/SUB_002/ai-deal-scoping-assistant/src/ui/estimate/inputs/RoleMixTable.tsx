/** Read-only role mix (engine rule CR_09): how each driver type's effort is split across roles. */
import type { ReactElement } from 'react';
import type { RoleId, RoleMixRow, RoleRate } from '../../../domain';
import { DataTable, formatNumber } from '../../common';
import type { DataTableColumn } from '../../common';
import { mixRowLabel } from '../labels';

export interface RoleMixTableProps {
  rows: RoleMixRow[];
  rates: RoleRate[];
}

function roleLabel(rates: readonly RoleRate[], roleId: RoleId): string {
  return rates.find((rate) => rate.roleId === roleId)?.label ?? roleId;
}

function shareList(rates: readonly RoleRate[], row: RoleMixRow): string {
  return row.shares.map((share) => `${roleLabel(rates, share.roleId)} ${formatNumber(share.pct)}%`).join(', ');
}

function buildColumns(rates: readonly RoleRate[]): DataTableColumn<RoleMixRow>[] {
  return [
    { id: 'driverType', header: 'Driver type', render: (row) => mixRowLabel(row.driverType) },
    { id: 'shares', header: 'Role shares', render: (row) => shareList(rates, row) },
  ];
}

export function RoleMixTable({ rows, rates }: RoleMixTableProps): ReactElement {
  return <DataTable caption="Role mix share of effort by driver type" columns={buildColumns(rates)} rows={rows} getRowId={(row) => row.driverType} />;
}
