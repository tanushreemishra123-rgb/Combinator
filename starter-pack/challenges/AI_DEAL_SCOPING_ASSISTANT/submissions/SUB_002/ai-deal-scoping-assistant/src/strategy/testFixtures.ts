/**
 * Hand-built architecture design used only by this folder's tests, kept independent of the
 * architecture module's runtime behaviour so a planner change there cannot break these tests.
 */
import type { ArchitectureComponent, ArchitectureDesign, TracedStatement } from '../domain';

function component(partial: Omit<ArchitectureComponent, 'purpose' | 'rationale' | 'tradeOffs' | 'dependencies' | 'securityConsiderations' | 'assumptionIds'>): ArchitectureComponent {
  return {
    ...partial,
    purpose: `${partial.name} implements the ${partial.area} area of the solution.`,
    rationale: `${partial.service} is the managed service selected for ${partial.logicalComponent} on this platform.`,
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
    assumptionIds: [],
  };
}

/** Azure architecture with one component per area strategy tests need, wired to fixtureScope()'s requirement ids. */
export function fixtureArchitectureDesign(): ArchitectureDesign {
  const components: ArchitectureComponent[] = [
    component({ id: 'ARC_01', name: 'Member Portal Web App', area: 'user-apps', logicalComponent: 'web-app', service: 'Azure Static Web Apps', requirementIds: ['FR_01'] }),
    component({ id: 'ARC_02', name: 'API Gateway', area: 'api', logicalComponent: 'api-gateway', service: 'Azure API Management', requirementIds: ['FR_01'] }),
    component({ id: 'ARC_03', name: 'Core Application Service', area: 'backend', logicalComponent: 'container-app', service: 'Azure Container Apps', requirementIds: ['FR_02'] }),
    component({ id: 'ARC_04', name: 'Member Transactional Store', area: 'data-storage', logicalComponent: 'relational-db', service: 'Azure SQL Database', requirementIds: ['DATA_01'] }),
    component({ id: 'ARC_05', name: 'Analytics Warehouse', area: 'data-storage', logicalComponent: 'data-warehouse', service: 'Azure Synapse Analytics', requirementIds: ['DATA_01'] }),
    component({ id: 'ARC_06', name: 'Integration Event Bus', area: 'messaging', logicalComponent: 'event-bus', service: 'Azure Service Bus', requirementIds: ['INT_01'] }),
    component({ id: 'ARC_07', name: 'Integration Platform', area: 'integration', logicalComponent: 'integration-platform', service: 'Azure Logic Apps', requirementIds: ['INT_01'] }),
    component({ id: 'ARC_08', name: 'Identity Provider', area: 'identity', logicalComponent: 'identity', service: 'Microsoft Entra ID', requirementIds: ['FR_01'] }),
    component({ id: 'ARC_09', name: 'Platform Monitoring', area: 'observability', logicalComponent: 'monitoring', service: 'Azure Monitor', requirementIds: [] }),
    component({ id: 'ARC_10', name: 'Secrets and Encryption', area: 'security', logicalComponent: 'secrets', service: 'Azure Key Vault', requirementIds: ['SEC_01'] }),
    component({ id: 'ARC_11', name: 'AI Assistant Platform', area: 'ai-ml', logicalComponent: 'ai-orchestration', service: 'Azure AI Foundry', requirementIds: ['FR_03'] }),
    component({ id: 'ARC_12', name: 'Backup Vault', area: 'backup-dr', logicalComponent: 'backup', service: 'Azure Backup', requirementIds: ['NFR_01'] }),
  ];
  const summary: TracedStatement[] = [{ text: 'Azure landing zone sized for 50,000 members.', refs: ['NFR_02'], label: 'ai-interpretation' }];
  return {
    platform: 'azure',
    summary,
    components,
    flows: [],
    environments: [],
    deployment: [],
    availability: [],
    backupDr: [],
    securityControls: [],
    selection: 'ai-recommended',
    recommendation: {
      recommended: 'azure',
      scores: [{ platform: 'azure', score: 10, reasons: [{ text: 'Customer team prefers Microsoft Azure.', refs: ['TECH_01'], points: 10 }] }],
      explanation: 'Azure scores highest because the customer team prefers it.',
    },
  };
}
