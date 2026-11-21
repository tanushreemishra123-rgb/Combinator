/** Role allocation with cost (spec 5, "Roles or skill categories"; engine rule CR_09). Shared by a single workstream and the overall role summary. */
import type { ReactElement } from 'react';
import type { RoleAllocation } from '../../../domain';
import { Badge, DataTable, formatNumber } from '../../common';
import type { DataTableColumn } from '../../common';
import { formatMoney } from '../../../estimation';

export interface RoleAllocationTableProps {
  roles: RoleAllocation[];
  currency: string;
  caption: string;
}

function CostCell({ role, currency }: { role: RoleAllocation; currency: string }): ReactElement {
  if (role.cost === null) {
    return <Badge tone="danger">Cost blocked - no day rate</Badge>;
  }
  return <span>{formatMoney(role.cost, currency)}</span>;
}

function buildColumns(currency: string): DataTableColumn<RoleAllocation>[] {
  return [
    { id: 'role', header: 'Role', render: (role) => role.label },
    { id: 'days', header: 'Days', align: 'end', render: (role) => formatNumber(role.days) },
    { id: 'rate', header: 'Day rate', align: 'end', render: (role) => (role.dayRate === null ? 'No rate' : `${formatNumber(role.dayRate)} ${currency}`) },
    { id: 'cost', header: 'Cost', align: 'end', render: (role) => <CostCell role={role} currency={currency} /> },
  ];
}

export function RoleAllocationTable({ roles, currency, caption }: RoleAllocationTableProps): ReactElement {
  return <DataTable caption={caption} columns={buildColumns(currency)} rows={roles} getRowId={(role) => role.roleId} />;
}
