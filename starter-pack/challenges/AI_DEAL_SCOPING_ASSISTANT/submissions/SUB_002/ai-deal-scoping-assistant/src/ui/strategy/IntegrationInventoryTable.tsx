/**
 * Integration inventory table (spec 4, "Integration Architecture"): system, direction, pattern,
 * complexity and readiness in the row; protocol, authentication, error handling, retry, monitoring,
 * data synchronisation and the implementing architecture components behind an expand toggle.
 */
import type { ReactElement } from 'react';
import type { ArchitectureComponent, IntegrationSpec } from '../../domain';
import { Badge, ComplexityBadge, DataTable, EmptyState, KeyValueList, RefChips } from '../common';
import type { DataTableColumn } from '../common';
import { ReadinessBadge, SystemTypeBadge } from './badges';
import { componentLabelsFor } from './componentNames';

export interface IntegrationInventoryTableProps {
  integrations: IntegrationSpec[];
  componentLookup: ReadonlyMap<string, ArchitectureComponent>;
  onSelectRequirement: (id: string) => void;
}

const DIRECTION_LABELS: ReadonlyMap<IntegrationSpec['direction'], string> = new Map([
  ['inbound', 'Inbound'],
  ['outbound', 'Outbound'],
  ['bidirectional', 'Bidirectional'],
]);

const PATTERN_LABELS: ReadonlyMap<IntegrationSpec['pattern'], string> = new Map([
  ['api', 'API'],
  ['event', 'Event'],
  ['batch', 'Batch'],
  ['file', 'File'],
]);

function buildColumns(onSelectRequirement: (id: string) => void): DataTableColumn<IntegrationSpec>[] {
  return [
    {
      id: 'name',
      header: 'Integration',
      render: (integration) => (
        <>
          <strong>{integration.name}</strong>
          <div className="text-muted text-sm">{integration.system}</div>
        </>
      ),
    },
    { id: 'type', header: 'System type', render: (integration) => <SystemTypeBadge systemType={integration.systemType} /> },
    { id: 'direction', header: 'Direction', render: (integration) => DIRECTION_LABELS.get(integration.direction) ?? integration.direction },
    { id: 'pattern', header: 'Pattern', render: (integration) => <Badge tone="info">{PATTERN_LABELS.get(integration.pattern) ?? integration.pattern}</Badge> },
    { id: 'complexity', header: 'Complexity', render: (integration) => <ComplexityBadge complexity={integration.complexity} /> },
    { id: 'readiness', header: 'Readiness', render: (integration) => <ReadinessBadge readiness={integration.readiness} /> },
    {
      id: 'requirements',
      header: 'Requirements',
      render: (integration) => <RefChips refs={integration.requirementIds} onSelect={onSelectRequirement} />,
    },
  ];
}

function expandedDetail(integration: IntegrationSpec, componentLookup: ReadonlyMap<string, ArchitectureComponent>): ReactElement {
  const components = componentLabelsFor(integration.componentIds, componentLookup);
  return (
    <KeyValueList
      columns={2}
      items={[
        { key: 'Protocol', value: integration.protocol },
        { key: 'Authentication', value: integration.authentication },
        { key: 'Error handling', value: integration.errorHandling },
        { key: 'Retry behaviour', value: integration.retry },
        { key: 'Monitoring', value: integration.monitoring },
        { key: 'Data synchronisation', value: integration.dataSync },
        {
          key: 'Implementing architecture components',
          value: components.length > 0 ? components.join(', ') : 'Not yet mapped to an architecture component.',
        },
      ]}
    />
  );
}

export function IntegrationInventoryTable({ integrations, componentLookup, onSelectRequirement }: IntegrationInventoryTableProps): ReactElement {
  return (
    <DataTable
      columns={buildColumns(onSelectRequirement)}
      rows={integrations}
      getRowId={(integration) => integration.id}
      caption="Integration inventory: internal and external systems, their pattern, protocol and readiness"
      renderExpanded={(integration) => expandedDetail(integration, componentLookup)}
      emptyState={<EmptyState title="No integrations yet" message="Integrations are identified from the reviewed integration and existing-system requirements." />}
    />
  );
}
