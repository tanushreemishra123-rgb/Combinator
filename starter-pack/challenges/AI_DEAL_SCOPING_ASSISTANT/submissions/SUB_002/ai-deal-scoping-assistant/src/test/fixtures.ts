/**
 * Small hand-written fixtures for unit tests. They are independent of the seed scenarios and of
 * every engine module, so each module can be tested in isolation.
 */
import { createSession } from '../domain';
import type {
  CustomerContext,
  NormalizedDocument,
  Priority,
  Provenance,
  ScopeItem,
  ScopeItemKind,
  ScopeModel,
  ScopingSession,
  SolutionConfig,
  SourceLine,
} from '../domain';
import { createDefaultEstimationConfig, createDefaultSolutionConfig } from '../seed/estimationDefaults';

export const FIXTURE_NOW = '2026-09-19T00:00:00.000Z';

const FIXTURE_LINES: readonly string[] = [
  '# Member Portal Modernisation',
  '## Business goals',
  'We want to reduce call-centre volume by 30% by letting members self-serve online.',
  '## Functional needs',
  'Members must be able to register, sign in with SSO and update their profile.',
  'Members should be able to search and download their policy documents.',
  'The portal must sync member profiles with our Salesforce CRM in near real time.',
  'We would like an AI assistant that answers policy questions from our document library.',
  '## Non-functional and security',
  'The portal must be available 99.9% of the time and support 50,000 registered members.',
  'All personal data must be encrypted at rest and in transit and comply with GDPR.',
  '## Delivery',
  'We need to go live before the annual renewal period; our team prefers Microsoft Azure.',
];

export function fixtureDocument(): NormalizedDocument {
  const sectionTitles: readonly [number, string, string][] = [
    [2, 'S1', 'Business goals'],
    [4, 'S2', 'Functional needs'],
    [9, 'S3', 'Non-functional and security'],
    [12, 'S4', 'Delivery'],
  ];
  let sectionId = 'S0';
  const lines: SourceLine[] = FIXTURE_LINES.map((text, index) => {
    const number = index + 1;
    const heading = sectionTitles.find(([line]) => line === number);
    if (heading !== undefined) {
      sectionId = heading[1];
    }
    return { number, text, sectionId };
  });
  return {
    text: FIXTURE_LINES.join('\n'),
    lines,
    sections: [
      { id: 'S0', title: 'Member Portal Modernisation', level: 1, lineStart: 1, lineEnd: 1 },
      { id: 'S1', title: 'Business goals', level: 2, lineStart: 2, lineEnd: 3 },
      { id: 'S2', title: 'Functional needs', level: 2, lineStart: 4, lineEnd: 8 },
      { id: 'S3', title: 'Non-functional and security', level: 2, lineStart: 9, lineEnd: 11 },
      { id: 'S4', title: 'Delivery', level: 2, lineStart: 12, lineEnd: 13 },
    ],
    wordCount: FIXTURE_LINES.join(' ').split(/\s+/).length,
  };
}

interface ItemSpec {
  id: string;
  kind: ScopeItemKind;
  title: string;
  description: string;
  priority?: Priority;
  provenance?: Provenance;
  line?: number;
  relatedIds?: string[];
  signals?: string[];
  resolved?: boolean;
  critical?: boolean;
  affectsInputs?: ScopeItem['affectsInputs'];
}

function item(spec: ItemSpec): ScopeItem {
  const document = fixtureDocument();
  const line = spec.line === undefined ? undefined : document.lines.find((l) => l.number === spec.line);
  const section = line === undefined ? undefined : document.sections.find((s) => s.id === line.sectionId);
  return {
    id: spec.id,
    kind: spec.kind,
    title: spec.title,
    description: spec.description,
    priority: spec.priority ?? 'Medium',
    provenance: spec.provenance ?? 'customer-stated',
    source:
      line === undefined
        ? null
        : {
            sectionId: line.sectionId,
            sectionTitle: section?.title ?? '',
            lineStart: line.number,
            lineEnd: line.number,
            quote: line.text,
            verified: true,
          },
    relatedIds: spec.relatedIds ?? [],
    affectsInputs: spec.affectsInputs ?? [],
    critical: spec.critical ?? false,
    signals: spec.signals ?? [],
    review: 'approved',
    inScope: true,
    userEdited: false,
    resolved: spec.resolved ?? false,
    resolution: '',
  };
}

/** Approved scope model with at least one item of every kind. */
export function fixtureScope(): ScopeModel {
  const items: ScopeItem[] = [
    item({ id: 'BR_01', kind: 'business', title: 'Reduce call-centre volume', description: 'Reduce call-centre volume by 30% through member self-service.', priority: 'High', line: 3 }),
    item({ id: 'PER_01', kind: 'persona', title: 'Member', description: 'Insurance member who self-serves online.', provenance: 'ai-inferred', line: 5 }),
    item({ id: 'FR_01', kind: 'functional', title: 'Registration, SSO sign-in and profile', description: 'Members register, sign in with SSO and update their profile.', priority: 'High', line: 5, relatedIds: ['Q_01'], signals: ['capability:identity', 'security:sso'] }),
    item({ id: 'FR_02', kind: 'functional', title: 'Policy document search and download', description: 'Members search and download their policy documents.', line: 6, signals: ['capability:search', 'capability:documents'] }),
    item({ id: 'FR_03', kind: 'functional', title: 'AI policy assistant', description: 'AI assistant answers policy questions from the document library.', priority: 'Low', line: 8, relatedIds: ['ASM_01'], signals: ['ai:assistant', 'ai:rag'] }),
    item({ id: 'NFR_01', kind: 'nonFunctional', title: '99.9% availability', description: 'Portal is available 99.9% of the time.', priority: 'High', line: 10, signals: ['nfr:availability'] }),
    item({ id: 'NFR_02', kind: 'nonFunctional', title: 'Scale to 50,000 members', description: 'Support 50,000 registered members.', line: 10, signals: ['nfr:scalability'] }),
    item({ id: 'SYS_01', kind: 'existingSystem', title: 'Salesforce CRM', description: 'Existing Salesforce CRM holds member profiles.', line: 7, signals: ['integration:crm'] }),
    item({ id: 'INT_01', kind: 'integration', title: 'Salesforce CRM profile sync', description: 'Sync member profiles with Salesforce CRM in near real time.', priority: 'High', line: 7, relatedIds: ['DEP_01', 'GAP_01'], signals: ['integration:crm', 'integration:realtime'] }),
    item({ id: 'DATA_01', kind: 'data', title: 'Member and policy document data', description: 'Store member profiles and policy documents.', provenance: 'ai-inferred', line: 6, signals: ['data:documents', 'data:pii'] }),
    item({ id: 'SEC_01', kind: 'security', title: 'Encryption and GDPR', description: 'Encrypt personal data at rest and in transit; comply with GDPR.', priority: 'High', line: 11, signals: ['security:encryption', 'compliance:gdpr'] }),
    item({ id: 'TECH_01', kind: 'technology', title: 'Microsoft Azure preferred', description: 'Customer team prefers Microsoft Azure.', line: 13, signals: ['cloud:azure'] }),
    item({ id: 'CON_01', kind: 'constraint', title: 'Go-live before renewal period', description: 'Go live before the annual renewal period.', line: 13, relatedIds: ['Q_02'] }),
    item({ id: 'DEP_01', kind: 'dependency', title: 'Salesforce API access', description: 'Salesforce API credentials and sandbox access are required.', provenance: 'ai-inferred' }),
    item({ id: 'RSK_01', kind: 'risk', title: 'Document library quality', description: 'Poorly structured policy documents may reduce AI answer quality.', provenance: 'ai-inferred' }),
    item({ id: 'GAP_01', kind: 'gap', title: 'CRM API readiness unknown', description: 'The readiness and limits of the Salesforce APIs are not stated.', provenance: 'ai-inferred', critical: true, affectsInputs: ['integrationReadiness'] }),
    item({ id: 'ASM_01', kind: 'assumption', title: 'Policy documents are digitised', description: 'Policy documents are available as text-searchable files.', provenance: 'assumed' }),
    item({ id: 'Q_01', kind: 'question', title: 'Which identity provider is used for SSO?', description: 'Which identity provider should the portal federate with?', provenance: 'ai-inferred' }),
    item({ id: 'Q_02', kind: 'question', title: 'What is the go-live date?', description: 'What is the exact date of the annual renewal period?', provenance: 'ai-inferred', critical: true, affectsInputs: ['deliveryDeadline'] }),
  ];
  return { summary: 'Member self-service portal with CRM sync and an AI policy assistant.', items, version: 1, approvedAt: FIXTURE_NOW, approvedVersion: 1, issues: [] };
}

export function fixtureCustomer(): CustomerContext {
  return {
    customerName: 'Northwind Mutual',
    industry: 'Insurance',
    opportunityName: 'Member Portal Modernisation',
    region: 'EU',
    engagementType: 'Fixed-scope delivery',
    notes: '',
  };
}

export function fixtureConfig(overrides: Partial<SolutionConfig> = {}): SolutionConfig {
  return { ...createDefaultSolutionConfig(), cloudPlatform: 'azure', cloudSelectionMode: 'user-selected', expectedUsers: 50_000, environments: 3, ...overrides };
}

/** Session with an approved scope model and no generated outputs yet. */
export function fixtureSession(): ScopingSession {
  const session = createSession({
    id: 'session-fixture',
    name: 'Fixture session',
    now: FIXTURE_NOW,
    config: fixtureConfig(),
    estimationConfig: createDefaultEstimationConfig(),
  });
  return {
    ...session,
    customer: fixtureCustomer(),
    input: { rawText: fixtureDocument().text, documents: [], normalized: fixtureDocument(), scenarioId: null },
    scope: fixtureScope(),
  };
}
