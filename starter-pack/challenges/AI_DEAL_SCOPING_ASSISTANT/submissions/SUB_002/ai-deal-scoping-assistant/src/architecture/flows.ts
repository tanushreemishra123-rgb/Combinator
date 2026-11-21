/**
 * Builds the request/event/data/batch/auth/telemetry flows between architecture components, plus
 * the flows to external systems identified by integration scope items (kind 'existingSystem').
 * Static edges are a data table keyed by the same rule `key`s as componentRules.data.ts; an edge is
 * only emitted when both its endpoints were actually planned, so the diagram never dangles.
 */
import type { ArchitectureComponent, ArchitectureFlow, DiagramEdgeKind, ScopeItem, ScopeModel } from '../domain';
import { makeExternalId } from './externalRef';
import { itemsOfKind, labelWithPhaseNote, matchingExternalSystems } from './scopeQueries';

interface FlowRule {
  fromKey: string;
  toKey: string;
  label: string;
  kind: DiagramEdgeKind;
}

const FLOW_RULES: readonly FlowRule[] = [
  { fromKey: 'web-front-end', toKey: 'api-layer', label: 'User requests', kind: 'request' },
  { fromKey: 'mobile-backend', toKey: 'api-layer', label: 'Mobile API calls', kind: 'request' },
  { fromKey: 'api-layer', toKey: 'compute-runtime', label: 'Route to business logic', kind: 'request' },
  { fromKey: 'api-layer', toKey: 'identity', label: 'Authenticate and authorize', kind: 'auth' },
  { fromKey: 'compute-runtime', toKey: 'relational-db', label: 'Read/write core data', kind: 'data' },
  { fromKey: 'compute-runtime', toKey: 'cache', label: 'Cache reads', kind: 'data' },
  { fromKey: 'compute-runtime', toKey: 'object-storage', label: 'Store documents', kind: 'data' },
  { fromKey: 'compute-runtime', toKey: 'search-service', label: 'Index and query content', kind: 'data' },
  { fromKey: 'compute-runtime', toKey: 'notification', label: 'Send notifications', kind: 'event' },
  { fromKey: 'compute-runtime', toKey: 'workflow-orchestration', label: 'Coordinate multi-step process', kind: 'event' },
  { fromKey: 'compute-runtime', toKey: 'llm-platform', label: 'Model inference', kind: 'request' },
  { fromKey: 'llm-platform', toKey: 'vector-search', label: 'Retrieve grounding context', kind: 'data' },
  { fromKey: 'compute-runtime', toKey: 'document-ai', label: 'Extract document content', kind: 'request' },
  { fromKey: 'compute-runtime', toKey: 'ml-platform', label: 'Score prediction', kind: 'request' },
  { fromKey: 'api-layer', toKey: 'integration-api-management', label: 'Expose integration endpoints', kind: 'request' },
  { fromKey: 'integration-api-management', toKey: 'integration-service', label: 'Route integration calls', kind: 'request' },
  { fromKey: 'scheduler', toKey: 'integration-service', label: 'Trigger batch synchronization', kind: 'batch' },
  { fromKey: 'integration-service', toKey: 'message-queue', label: 'Queue outbound messages', kind: 'event' },
  { fromKey: 'integration-service', toKey: 'sftp-file-transfer', label: 'Exchange files', kind: 'batch' },
  { fromKey: 'etl-pipeline', toKey: 'data-warehouse', label: 'Load curated data', kind: 'batch' },
  { fromKey: 'data-warehouse', toKey: 'bi-reporting', label: 'Reporting queries', kind: 'data' },
  { fromKey: 'object-storage', toKey: 'etl-pipeline', label: 'Source raw files', kind: 'batch' },
  { fromKey: 'compute-runtime', toKey: 'monitoring', label: 'Emit metrics', kind: 'telemetry' },
  { fromKey: 'compute-runtime', toKey: 'logging', label: 'Emit logs', kind: 'telemetry' },
  { fromKey: 'relational-db', toKey: 'backup', label: 'Scheduled backup', kind: 'batch' },
  { fromKey: 'relational-db', toKey: 'dr-multi-region', label: 'Replicate for disaster recovery', kind: 'data' },
  { fromKey: 'compute-runtime', toKey: 'availability-scaling', label: 'Scale under load', kind: 'telemetry' },
];

function staticFlows(componentsByKey: ReadonlyMap<string, ArchitectureComponent>): ArchitectureFlow[] {
  const flows: ArchitectureFlow[] = [];
  for (const rule of FLOW_RULES) {
    const from = componentsByKey.get(rule.fromKey);
    const to = componentsByKey.get(rule.toKey);
    if (from !== undefined && to !== undefined) {
      flows.push({ from: from.id, to: to.id, label: rule.label, kind: rule.kind });
    }
  }
  return flows;
}

/** The existing-system item (if any) this integration item most likely talks to, by shared signal. */
function matchedExistingSystemTitle(scope: ScopeModel, integrationItem: ScopeItem): string | undefined {
  return matchingExternalSystems(scope, integrationItem).at(0)?.title;
}

function integrationFlowKind(item: ScopeItem): DiagramEdgeKind {
  if (item.signals.includes('integration:realtime')) {
    return 'event';
  }
  if (item.signals.includes('integration:batch')) {
    return 'batch';
  }
  if (item.signals.includes('integration:file')) {
    return 'data';
  }
  return 'request';
}

/** One flow per integration item to the external system it exchanges data with, when planned. */
function externalSystemFlows(componentsByKey: ReadonlyMap<string, ArchitectureComponent>, scope: ScopeModel): ArchitectureFlow[] {
  const integrationService = componentsByKey.get('integration-service');
  if (integrationService === undefined) {
    return [];
  }
  return itemsOfKind(scope, 'integration').map((item) => {
    const label = labelWithPhaseNote(matchedExistingSystemTitle(scope, item) ?? item.title, item);
    return {
      from: integrationService.id,
      to: makeExternalId(item.id, label),
      label: `Synchronize ${label}`,
      kind: integrationFlowKind(item),
    };
  });
}

export function buildFlows(componentsByKey: ReadonlyMap<string, ArchitectureComponent>, scope: ScopeModel): ArchitectureFlow[] {
  return [...staticFlows(componentsByKey), ...externalSystemFlows(componentsByKey, scope)];
}
