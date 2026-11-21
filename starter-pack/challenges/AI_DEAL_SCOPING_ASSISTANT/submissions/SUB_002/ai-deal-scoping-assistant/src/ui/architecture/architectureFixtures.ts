/**
 * Hand-built architecture-domain fixtures for this workspace's tests, independent of the
 * architecture engine module's own planner output, so these unit tests never depend on another
 * module's runtime behaviour. Every builder takes an optional partial override.
 */
import type { ArchitectureComponent, ArchitectureDesign, GenerationMeta, PlatformRecommendation } from '../../domain';
import type { StageStatusView } from '../../state';

export function fixtureComponent(overrides: Partial<ArchitectureComponent> = {}): ArchitectureComponent {
  return {
    id: 'ARC_01',
    name: 'Primary Relational Database',
    area: 'data-storage',
    logicalComponent: 'managed-relational-db',
    service: 'Azure Database for PostgreSQL - Flexible Server',
    requirementIds: ['DATA_01'],
    assumptionIds: [],
    purpose: 'Stores the core transactional data the application reads and writes.',
    rationale: 'Provides managed relational storage with automated backups, patching and encryption at rest.',
    tradeOffs: ['A managed relational engine caps vertical scale; very high write throughput may need read replicas later.'],
    dependencies: ['Backup', 'Key Management'],
    securityConsiderations: ['Encrypt data at rest and in transit, and restrict network access to the application tier only.'],
    ...overrides,
  };
}

export function fixtureApiComponent(overrides: Partial<ArchitectureComponent> = {}): ArchitectureComponent {
  return fixtureComponent({
    id: 'ARC_02',
    name: 'API Layer',
    area: 'api',
    logicalComponent: 'api-gateway',
    service: 'Azure API Management',
    requirementIds: ['FR_01'],
    assumptionIds: ['ASM_01'],
    purpose: "Exposes the solution's functional capabilities as versioned, governed APIs.",
    rationale: 'Centralizes authentication, throttling and request validation ahead of the runtime.',
    tradeOffs: ['A managed gateway adds a small per-request latency and cost overhead.'],
    dependencies: ['Application Compute Runtime'],
    securityConsiderations: ['Validate and authorize every request before it reaches the runtime.'],
    ...overrides,
  });
}

export function fixtureUnjustifiedComponent(overrides: Partial<ArchitectureComponent> = {}): ArchitectureComponent {
  return fixtureComponent({
    id: 'ARC_03',
    name: 'Search Service',
    area: 'data-storage',
    logicalComponent: 'search-service',
    service: 'Azure AI Search',
    requirementIds: [],
    assumptionIds: [],
    ...overrides,
  });
}

export function fixturePlatformRecommendation(overrides: Partial<PlatformRecommendation> = {}): PlatformRecommendation {
  return {
    recommended: 'azure',
    scores: [
      { platform: 'aws', score: 0, reasons: [] },
      { platform: 'azure', score: 30, reasons: [{ text: 'TECH_01 states a direct preference for Microsoft Azure.', refs: ['TECH_01'], points: 30 }] },
      { platform: 'gcp', score: 0, reasons: [] },
    ],
    explanation: 'Microsoft Azure is recommended based on the reviewed scope and configuration. This is an AI-generated recommendation and should be validated by a solution architect.',
    ...overrides,
  };
}

export function fixtureArchitectureDesign(overrides: Partial<ArchitectureDesign> = {}): ArchitectureDesign {
  return {
    platform: 'azure',
    selection: 'user-selected',
    recommendation: fixturePlatformRecommendation(),
    summary: [{ text: 'The proposed solution architecture targets Microsoft Azure and is composed of 2 components.', refs: ['DATA_01', 'FR_01'], label: 'ai-interpretation' }],
    components: [fixtureComponent(), fixtureApiComponent()],
    flows: [{ from: 'ARC_02', to: 'ARC_01', label: 'Read/write core data', kind: 'data' }],
    environments: [
      { name: 'Development', purpose: 'Feature development and integration testing.', sizing: 'Matches production topology at reduced instance counts.' },
      { name: 'Production', purpose: 'Live environment serving end users under production SLAs.', sizing: 'Sized for 50,000 expected users, with autoscaling enabled.' },
    ],
    deployment: [{ text: 'Releases build and deploy through Azure Pipelines.', refs: ['FR_01'], label: 'ai-interpretation' }],
    availability: [{ text: 'Azure Load Balancer distributes traffic across availability zones.', refs: ['NFR_01'], label: 'ai-interpretation' }],
    backupDr: [{ text: 'Azure Backup takes policy-driven, encrypted backups on a defined schedule.', refs: ['NFR_01'], label: 'ai-interpretation' }],
    securityControls: [{ text: 'Microsoft Entra External ID enforces authentication and MFA.', refs: ['SEC_01'], label: 'ai-interpretation' }],
    ...overrides,
  };
}

export function fixtureGenerationMeta(overrides: Partial<GenerationMeta> = {}): GenerationMeta {
  return {
    providerId: 'mock-heuristic',
    providerLabel: 'Mock Heuristic Engine',
    mode: 'mock',
    usedFallback: false,
    generatedAt: '2026-09-19T00:00:00.000Z',
    durationMs: 90,
    scopeVersion: 1,
    issues: [],
    ...overrides,
  };
}

export function fixtureStageStatus(overrides: Partial<StageStatusView> = {}): StageStatusView {
  return {
    stageId: 'architecture',
    label: 'Cloud solution architecture',
    status: 'empty',
    reviewed: false,
    staleReasons: [],
    prerequisite: null,
    ...overrides,
  };
}
