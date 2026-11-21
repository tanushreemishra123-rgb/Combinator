/** "Integration architecture" package section (spec 6): the integration table, data flows and the data-flow diagram. */
import { diagramToMermaid } from '../../diagram';
import type { DataFlow, DiagramModel, IntegrationSpec, PackageSection, ScopingSession } from '../../domain';
import { notGeneratedCallout, provenanceBlock, refsCell, tableOrParagraph, headingBlock } from '../text';

const INTEGRATION_COLUMNS = ['ID', 'Integration', 'System', 'Direction', 'Pattern', 'Authentication', 'Error handling and retry', 'Data synchronization', 'Monitoring', 'Complexity', 'Readiness', 'Requirements'] as const;

const READINESS_TEXT: ReadonlyMap<IntegrationSpec['readiness'], string> = new Map([
  ['confirmed', 'Confirmed with customer'],
  ['unknown', 'Not yet confirmed'],
]);

function integrationRow(integration: IntegrationSpec): string[] {
  return [
    integration.id,
    integration.name,
    `${integration.system} (${integration.systemType})`,
    integration.direction,
    `${integration.pattern} - ${integration.protocol}`,
    integration.authentication,
    `${integration.errorHandling} Retry: ${integration.retry}`,
    integration.dataSync.trim().length > 0 ? integration.dataSync : 'Not specified',
    integration.monitoring,
    integration.complexity,
    READINESS_TEXT.get(integration.readiness) ?? 'Not yet confirmed',
    refsCell(integration.requirementIds),
  ];
}

function flowRow(flow: DataFlow): string[] {
  const payload = flow.payload.trim().length > 0 ? flow.payload : 'Not specified';
  const mechanism = flow.mechanism.trim().length > 0 ? flow.mechanism : 'Not specified';
  return [flow.from, flow.to, payload, mechanism];
}

export function buildIntegrationArchitectureSection(session: ScopingSession, diagram: DiagramModel | undefined): PackageSection {
  const plan = session.outputs.dataIntegration.data;
  if (plan === null) {
    return { id: 'integration-architecture', title: 'Integration architecture', blocks: [notGeneratedCallout('the integration architecture has not been generated yet')] };
  }
  const provenance = provenanceBlock(session.outputs.dataIntegration.meta);
  const diagramBlock =
    diagram === undefined
      ? notGeneratedCallout('the solution architecture has not been generated yet, so no data-flow diagram is available')
      : ({ type: 'diagram', title: diagram.title, mermaid: diagramToMermaid(diagram), diagramId: 'data-flow' } as const);
  return {
    id: 'integration-architecture',
    title: 'Integration architecture',
    blocks: [
      ...(provenance === null ? [] : [provenance]),
      headingBlock(3, 'Integrations'),
      tableOrParagraph([...INTEGRATION_COLUMNS], plan.integrations.map(integrationRow), 'No integrations were identified in the reviewed scope.'),
      headingBlock(3, 'Data flows'),
      tableOrParagraph(['From', 'To', 'Payload', 'Mechanism'], plan.flows.map(flowRow), 'No data flows were mapped.'),
      headingBlock(3, 'Data and integration flow diagram'),
      diagramBlock,
    ],
  };
}
