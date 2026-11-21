/**
 * Hand-built PRD-domain fixtures for this workspace's tests, independent of the PRD engine
 * module's own output shape, so these unit tests never depend on another module's runtime
 * behaviour. Every builder takes an optional partial override.
 */
import type {
  Capability,
  CoverageReport,
  CoverageRow,
  FunctionalScope,
  GenerationMeta,
  PrdBundle,
  PrdDocument,
  PrdSection,
  TracedStatement,
  UnsupportedAddition,
  UserJourney,
} from '../../domain';
import { PRD_SECTION_IDS } from '../../domain';
import type { StageStatusView } from '../../state';

const SECTION_TITLE_BY_ID: ReadonlyMap<string, string> = new Map([
  ['overview', 'Product or solution overview'],
  ['businessProblem', 'Business problem'],
  ['objectives', 'Business objectives'],
  ['personas', 'Target users and personas'],
  ['journeys', 'User journeys or key workflows'],
  ['functionalRequirements', 'Functional requirements'],
  ['nonFunctionalRequirements', 'Non-functional requirements'],
  ['integrations', 'Integrations'],
  ['dependencies', 'Dependencies'],
  ['assumptions', 'Assumptions'],
  ['risks', 'Risks'],
  ['outOfScope', 'Out-of-scope items'],
  ['openQuestions', 'Open questions'],
  ['traceability', 'Requirement traceability'],
]);

export function fixtureStatement(overrides: Partial<TracedStatement> = {}): TracedStatement {
  return { text: 'FR_01 - Registration: Members can register and sign in with SSO.', refs: ['FR_01'], label: 'customer-requested', ...overrides };
}

export function fixtureJourney(overrides: Partial<UserJourney> = {}): UserJourney {
  return {
    id: 'JNY_01',
    name: 'Member journey',
    persona: 'PER_01',
    steps: ['Step 1: Member signs in with SSO.', 'Step 2: Member searches policy documents.'],
    requirementIds: ['FR_01', 'FR_02'],
    ...overrides,
  };
}

export function fixtureCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: 'CAP_01',
    name: 'Identity, Sign-In and Profile Management',
    scope: 'Provide self-service registration, authentication and profile management.',
    requirementIds: ['FR_01'],
    priority: 'High',
    dependencies: ['Identity provider access'],
    label: 'customer-requested',
    module: 'Platform Foundation',
    workstream: 'Identity and Access',
    deliveryPackage: 'Package 1 - Foundation',
    acceptance: ['A new user can register and sign in without manual provisioning.'],
    ...overrides,
  };
}

export function fixtureEnhancement(overrides: Partial<Capability> = {}): Capability {
  return fixtureCapability({
    id: 'ENH_01',
    name: 'Observability and Operations Dashboard',
    label: 'recommended-enhancement',
    dependencies: [],
    module: 'Platform Operations',
    workstream: 'Non-Functional Hardening',
    ...overrides,
  });
}

export function fixturePrdDocument(overrides: Partial<PrdDocument> = {}): PrdDocument {
  const sections: PrdSection[] = PRD_SECTION_IDS.map((id) => ({
    id,
    title: SECTION_TITLE_BY_ID.get(id) ?? id,
    statements: id === 'journeys' ? [] : [fixtureStatement()],
  }));
  return { title: 'Northwind Mutual - Product Requirements Document', sections, journeys: [fixtureJourney()], ...overrides };
}

export function fixtureFunctionalScope(overrides: Partial<FunctionalScope> = {}): FunctionalScope {
  return {
    capabilities: [fixtureCapability()],
    recommendedEnhancements: [fixtureEnhancement()],
    modules: [{ name: 'Platform Foundation', capabilityIds: ['CAP_01'], requirementIds: ['FR_01'] }],
    workstreams: [{ name: 'Identity and Access', capabilityIds: ['CAP_01'], requirementIds: ['FR_01'] }],
    deliveryPackages: [
      {
        name: 'Package 1 - Foundation',
        capabilityIds: ['CAP_01'],
        requirementIds: ['FR_01'],
        engagementModel: 'dedicated-team',
        suggestedChallengeTypes: ['Development challenge series', 'QA / bug hunt'],
      },
    ],
    outOfScope: [fixtureStatement({ text: 'Decommissioning the legacy CRM is out of scope.', refs: [], label: 'out-of-scope' })],
    ...overrides,
  };
}

export function fixturePrdBundle(overrides: { prd?: Partial<PrdDocument>; functionalScope?: Partial<FunctionalScope> } = {}): PrdBundle {
  return { prd: fixturePrdDocument(overrides.prd), functionalScope: fixtureFunctionalScope(overrides.functionalScope) };
}

export function fixtureCoverageRow(overrides: Partial<CoverageRow> = {}): CoverageRow {
  return {
    requirementId: 'FR_01',
    title: 'Registration, SSO sign-in and profile',
    kind: 'functional',
    priority: 'High',
    capabilityIds: ['CAP_01'],
    componentIds: [],
    strategyIds: [],
    workstreamIds: [],
    covered: true,
    ...overrides,
  };
}

export function fixtureUnsupportedAddition(overrides: Partial<UnsupportedAddition> = {}): UnsupportedAddition {
  return {
    targetType: 'capability',
    targetId: 'ENH_01',
    label: 'Observability and Operations Dashboard',
    reason:
      'Recommended enhancement "Observability and Operations Dashboard" (ENH_01) cites an id not present in the approved scope model: NFR_99.',
    unknownRefs: ['NFR_99'],
    ...overrides,
  };
}

export function fixtureCoverageReport(overrides: Partial<CoverageReport> = {}): CoverageReport {
  const rows = overrides.rows ?? [
    fixtureCoverageRow(),
    fixtureCoverageRow({ requirementId: 'FR_02', title: 'Policy document search and download', priority: 'Medium', capabilityIds: [], covered: false }),
  ];
  return {
    rows,
    links: [],
    totalRequirements: rows.length,
    coveredRequirements: rows.filter((row) => row.covered).length,
    coveragePct: 50,
    highPriorityCoveragePct: 100,
    uncoveredIds: rows.filter((row) => !row.covered).map((row) => row.requirementId),
    unsupportedAdditions: [fixtureUnsupportedAddition()],
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
    durationMs: 120,
    scopeVersion: 1,
    issues: [],
    ...overrides,
  };
}

export function fixtureStageStatus(overrides: Partial<StageStatusView> = {}): StageStatusView {
  return {
    stageId: 'prd',
    label: 'PRD and functional scope',
    status: 'empty',
    reviewed: false,
    staleReasons: [],
    prerequisite: null,
    ...overrides,
  };
}
