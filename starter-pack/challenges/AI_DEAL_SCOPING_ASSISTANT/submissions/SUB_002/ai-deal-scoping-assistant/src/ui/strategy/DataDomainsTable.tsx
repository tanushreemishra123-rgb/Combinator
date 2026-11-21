/** Major data domains table (spec 4, "Major data domains"): sources, ownership and classification. */
import type { ReactElement } from 'react';
import type { DataDomain } from '../../domain';
import { DataTable, EmptyState, RefChips } from '../common';
import type { DataTableColumn } from '../common';
import { ClassificationBadge } from './badges';

export interface DataDomainsTableProps {
  domains: DataDomain[];
  onSelectRequirement: (id: string) => void;
}

function buildColumns(onSelectRequirement: (id: string) => void): DataTableColumn<DataDomain>[] {
  return [
    { id: 'name', header: 'Data domain', render: (domain) => domain.name },
    { id: 'description', header: 'Description', render: (domain) => domain.description },
    { id: 'sources', header: 'Sources', render: (domain) => domain.sources.join('; ') },
    { id: 'owner', header: 'Ownership', render: (domain) => domain.owner },
    { id: 'classification', header: 'Classification', render: (domain) => <ClassificationBadge classification={domain.classification} /> },
    {
      id: 'requirements',
      header: 'Requirements',
      render: (domain) => <RefChips refs={domain.requirementIds} onSelect={onSelectRequirement} />,
    },
  ];
}

export function DataDomainsTable({ domains, onSelectRequirement }: DataDomainsTableProps): ReactElement {
  return (
    <DataTable
      columns={buildColumns(onSelectRequirement)}
      rows={domains}
      getRowId={(domain) => domain.id}
      caption="Major data domains, their sources, ownership and classification"
      emptyState={<EmptyState title="No data domains yet" message="Data domains are identified from the reviewed data requirements." />}
    />
  );
}
