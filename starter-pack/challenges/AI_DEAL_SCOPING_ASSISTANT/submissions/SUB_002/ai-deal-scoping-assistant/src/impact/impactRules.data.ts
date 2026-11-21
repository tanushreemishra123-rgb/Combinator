/**
 * Declarative change-impact rule table. For every kind of change it lists
 *  - `areas`: the candidate areas of each output section, the selector that finds the concrete
 *    generated elements behind the area in the session, and why the area depends on the change;
 *  - `preserved`: areas that provably do not depend on the change, with the rule that says so.
 * The analysis engine (analyzeImpact.ts) only evaluates this table against real trace data; no AI
 * is involved in deciding what is affected.
 */
import type { ChangeKind, OutputSectionId, ScopeItemKind } from '../domain';
import type { AreaRule, ElementSelector, ImpactRule, PreservedArea } from './types';

const TRACE: ElementSelector = { type: 'trace' };
const WHOLE_SECTION: ElementSelector = { type: 'whole-section' };
const TARGET_DRIVER: ElementSelector = { type: 'target-driver' };

const VOLUME_SIGNALS = ['nfr:scalability', 'nfr:performance', 'nfr:availability'] as const;
const VOLUME_TARGET = 'an availability, performance or scalability target';

const REGION_SIGNALS = ['security:data-residency', 'compliance:gdpr', 'compliance:hipaa', 'compliance:fedramp', 'nfr:availability', 'nfr:localization'] as const;
const REGION_TARGET = 'a data-residency, regulatory, availability or localisation expectation';

const SCOPE_UNTOUCHED_BY_CONFIG: PreservedArea = {
  section: 'scope',
  area: 'Reviewed requirement model',
  reason: 'A configuration change never rewrites reviewed requirements, assumptions or answers; they stay exactly as approved.',
};

const SCOPE_OTHER_ITEMS: PreservedArea = {
  section: 'scope',
  area: 'Other reviewed scope items',
  reason: 'Only the edited item changed; every other reviewed requirement, assumption and answer is kept as approved.',
};

function preserved(section: OutputSectionId, area: string, reason: string): PreservedArea {
  return { section, area, reason };
}

/** The same preservation statement for several sections (e.g. everything except the commercials). */
function preservedEverywhere(sections: readonly OutputSectionId[], areaBySection: ReadonlyMap<OutputSectionId, string>, reason: string): PreservedArea[] {
  return sections.map((section) => preserved(section, areaBySection.get(section) ?? section, reason));
}

const SECTION_AREAS: ReadonlyMap<OutputSectionId, string> = new Map([
  ['prd', 'PRD narrative, personas and user journeys'],
  ['functionalScope', 'Functional scope, modules and delivery packages'],
  ['architecture', 'Cloud solution architecture'],
  ['dataIntegration', 'Data strategy and integration architecture'],
  ['aiStrategy', 'AI solution approach'],
  ['estimate', 'Workstreams, effort and timeline'],
  ['commercials', 'ROM commercials'],
]);

const DESIGN_SECTIONS: readonly OutputSectionId[] = ['prd', 'functionalScope', 'architecture', 'dataIntegration', 'aiStrategy'];

/** Area labels used when a change is followed through requirement-to-output trace links. */
interface TraceLabels {
  prd: string;
  functionalScope: string;
  architecture: string;
  dataIntegration: string;
  aiStrategy: string;
  estimate: string;
}

const DEFAULT_TRACE_LABELS: TraceLabels = {
  prd: 'PRD statements and user journeys',
  functionalScope: 'Capabilities and delivery packages',
  architecture: 'Architecture components',
  dataIntegration: 'Data domains, data topics and integrations',
  aiStrategy: 'AI use cases and frameworks',
  estimate: 'Workstreams and effort drivers',
};

const ESTIMATE_TRACE_AREAS: readonly AreaRule[] = [
  {
    section: 'estimate',
    area: DEFAULT_TRACE_LABELS.estimate,
    action: 'regenerate',
    selector: TRACE,
    because: 'Driver selection, complexity and delivery sequencing were suggested from the changed item.',
  },
  {
    section: 'commercials',
    area: 'ROM commercials',
    action: 'recalculate',
    selector: TRACE,
    because: 'The ROM is the priced sum of these workstreams and is recalculated once their inputs are refreshed.',
  },
];

function designTraceAreas(labels: TraceLabels): AreaRule[] {
  return [
    { section: 'prd', area: labels.prd, action: 'regenerate', selector: TRACE, because: 'The PRD restates the item, so its wording, priority and open points must match the reviewed scope model.' },
    { section: 'functionalScope', area: labels.functionalScope, action: 'regenerate', selector: TRACE, because: 'Capability scope, priority and acceptance criteria are derived from the item.' },
    { section: 'architecture', area: labels.architecture, action: 'regenerate', selector: TRACE, because: 'The purpose and rationale of these components are justified by the item.' },
    { section: 'dataIntegration', area: labels.dataIntegration, action: 'regenerate', selector: TRACE, because: 'These data and integration decisions are justified by the item.' },
    { section: 'aiStrategy', area: labels.aiStrategy, action: 'regenerate', selector: TRACE, because: 'These AI design decisions are justified by the item.' },
  ];
}

/** Rule for a change to one reviewed scope item: follow its trace links through every deliverable. */
function traceRule(labels: TraceLabels = DEFAULT_TRACE_LABELS): ImpactRule {
  return { areas: [...designTraceAreas(labels), ...ESTIMATE_TRACE_AREAS], preserved: [SCOPE_OTHER_ITEMS] };
}

const SECURITY_TRACE_LABELS: TraceLabels = {
  ...DEFAULT_TRACE_LABELS,
  prd: 'Security and compliance statements',
  architecture: 'Security controls and components',
  dataIntegration: 'Data privacy, retention and integration security',
  aiStrategy: 'AI privacy and safety safeguards',
};

const PRIORITY_RULE: ImpactRule = {
  areas: [
    ...designTraceAreas({ ...DEFAULT_TRACE_LABELS, prd: 'Requirement priorities in the PRD', functionalScope: 'Capability priority and delivery packaging' }).filter(
      (area) => area.section === 'prd' || area.section === 'functionalScope',
    ),
    ...ESTIMATE_TRACE_AREAS,
  ],
  preserved: [
    ...preservedEverywhere(
      ['architecture', 'dataIntegration', 'aiStrategy'],
      SECTION_AREAS,
      'Priority changes sequencing and coverage expectations, not the technical design of what is built.',
    ),
    SCOPE_OTHER_ITEMS,
  ],
};

/** Commercial parameters price the effort; they never feed back into scope, design or effort. */
function commercialOnlyRule(area: string, because: string, preservedReason: string): ImpactRule {
  return {
    areas: [{ section: 'commercials', area, action: 'recalculate', selector: WHOLE_SECTION, because }],
    preserved: [...preservedEverywhere([...DESIGN_SECTIONS, 'estimate'], SECTION_AREAS, preservedReason), SCOPE_UNTOUCHED_BY_CONFIG],
  };
}

/** A reviewer's complexity setting feeds the calculation engine only. */
function complexityRule(because: string, preservedReason: string): ImpactRule {
  return {
    areas: [
      { section: 'estimate', area: 'Workstream effort and timeline', action: 'recalculate', selector: TARGET_DRIVER, because },
      {
        section: 'commercials',
        area: 'ROM commercials',
        action: 'recalculate',
        selector: TARGET_DRIVER,
        because: 'The cost of the workstream that contains the driver is re-priced from the recalculated effort.',
      },
    ],
    preserved: [...preservedEverywhere(DESIGN_SECTIONS, SECTION_AREAS, preservedReason), SCOPE_UNTOUCHED_BY_CONFIG],
  };
}

const EXPECTED_USERS_RULE: ImpactRule = {
  areas: [
    {
      section: 'architecture',
      area: 'Volume-bound requirements',
      action: 'regenerate',
      selector: { type: 'requirements-with-signals', signals: VOLUME_SIGNALS, targetPhrase: VOLUME_TARGET },
      because: 'These targets were reviewed against the previous user volume and the architecture that realises them must be re-validated against the new one.',
    },
    {
      section: 'architecture',
      area: 'Scalability architecture',
      action: 'regenerate',
      selector: { type: 'cites-signals', signals: VOLUME_SIGNALS, targetPhrase: VOLUME_TARGET },
      because: 'Compute scaling, load balancing and availability design are sized from the expected user volume.',
    },
    {
      section: 'architecture',
      area: 'Caching strategy',
      action: 'regenerate',
      selector: { type: 'facets', facets: ['logical:cache', 'logical:web-hosting-cdn'], facetNoun: 'the caching and content-delivery layer' },
      because: 'Cache and content-delivery capacity is planned from concurrent usage.',
    },
    {
      section: 'architecture',
      area: 'Database sizing',
      action: 'regenerate',
      selector: {
        type: 'facets',
        facets: ['logical:managed-relational-db', 'logical:nosql-document-db', 'logical:search-service', 'logical:object-storage', 'logical:data-warehouse'],
        facetNoun: 'the data storage layer',
      },
      because: 'Storage capacity, replicas and partitioning are sized from the user volume.',
    },
    {
      section: 'dataIntegration',
      area: 'Volume-bound data and integration design',
      action: 'regenerate',
      selector: { type: 'cites-signals', signals: VOLUME_SIGNALS, targetPhrase: VOLUME_TARGET },
      because: 'Throughput, synchronisation frequency and storage tiers planned against these targets scale with the user volume.',
    },
    {
      section: 'estimate',
      area: 'Performance testing effort',
      action: 'regenerate',
      selector: { type: 'facets', facets: ['driver:nonFunctional'], facetNoun: 'the non-functional hardening and performance testing drivers' },
      because: 'Load, performance and resilience testing is scoped from the target user volume.',
    },
    {
      section: 'estimate',
      area: 'Cloud infrastructure effort and cost assumptions',
      action: 'regenerate',
      selector: { type: 'facets', facets: ['driver:infrastructure'], facetNoun: 'the cloud infrastructure drivers' },
      because: 'Infrastructure complexity and the cloud cost assumptions are banded by the expected user volume.',
    },
    {
      section: 'commercials',
      area: 'ROM estimate',
      action: 'recalculate',
      selector: { type: 'facets', facets: ['driver:nonFunctional', 'driver:infrastructure'], facetNoun: 'the volume-dependent workstreams' },
      because: 'The ROM is re-priced from the refreshed delivery effort of these workstreams.',
    },
  ],
  preserved: [
    preserved('prd', 'Customer personas and user journeys', 'User volume does not change who the users are or what they need to do.'),
    preserved('functionalScope', 'Core workflows and capabilities', 'Functional behaviour is the same at any user volume; only the capacity behind it changes.'),
    preserved('dataIntegration', 'Integrations that are not volume-bound', 'Interfaces, protocols and authentication with existing systems do not depend on the number of users.'),
    preserved('aiStrategy', 'AI use cases, safeguards and evaluation approach', 'The AI solution pattern and its safeguards do not depend on the number of users.'),
    SCOPE_UNTOUCHED_BY_CONFIG,
  ],
};

const CLOUD_PLATFORM_RULE: ImpactRule = {
  areas: [
    { section: 'architecture', area: 'Cloud service mapping of every component', action: 'regenerate', selector: WHOLE_SECTION, because: 'Every logical component is re-mapped to the equivalent managed service of the newly selected platform.' },
    { section: 'dataIntegration', area: 'Data and integration services', action: 'regenerate', selector: WHOLE_SECTION, because: 'Storage, pipeline and integration services are named per cloud platform.' },
    { section: 'aiStrategy', area: 'AI model hosting and platform services', action: 'regenerate', selector: WHOLE_SECTION, because: 'Model hosting, retrieval and guardrail services are chosen from the selected platform.' },
    {
      section: 'estimate',
      area: 'Cloud infrastructure effort',
      action: 'regenerate',
      selector: { type: 'facets', facets: ['driver:infrastructure'], facetNoun: 'the cloud infrastructure drivers' },
      because: 'Landing zone, deployment pipeline and platform set-up effort depend on the target platform.',
    },
    {
      section: 'commercials',
      area: 'ROM commercials',
      action: 'recalculate',
      selector: { type: 'facets', facets: ['driver:infrastructure'], facetNoun: 'the infrastructure workstreams' },
      because: 'The ROM is re-priced from the refreshed infrastructure effort.',
    },
  ],
  preserved: [
    preserved('prd', 'PRD', 'The PRD describes business needs and user outcomes, which are platform-neutral.'),
    preserved('functionalScope', 'Functional scope', 'Capabilities, modules and delivery packages describe what is built, not where it is hosted.'),
    SCOPE_UNTOUCHED_BY_CONFIG,
  ],
};

const DEADLINE_RULE: ImpactRule = {
  areas: [
    { section: 'estimate', area: 'Timeline and deadline assessment', action: 'recalculate', selector: WHOLE_SECTION, because: 'The deadline feasibility note and required team size are recomputed from the unchanged effort and the new deadline.' },
  ],
  preserved: [
    ...preservedEverywhere(DESIGN_SECTIONS, SECTION_AREAS, 'The delivery deadline constrains when the solution is delivered, not what is built or how it is designed.'),
    preserved('commercials', 'ROM commercials', 'The ROM prices effort with the rate card; a deadline changes the feasibility assessment, not the priced effort.'),
    SCOPE_UNTOUCHED_BY_CONFIG,
  ],
};

const ENVIRONMENTS_RULE: ImpactRule = {
  areas: [
    {
      section: 'architecture',
      area: 'Environment and deployment plan',
      action: 'regenerate',
      selector: { type: 'facets', facets: ['area:environments', 'area:deployment'], facetNoun: 'the environment and deployment plan' },
      because: 'The environment list and promotion path are generated from the configured number of environments.',
    },
    {
      section: 'estimate',
      area: 'Environment effort uplift',
      action: 'recalculate',
      selector: { type: 'facets', facets: ['driver:infrastructure'], facetNoun: 'the cloud infrastructure drivers' },
      because: 'Each environment above the baseline adds the configured percentage to infrastructure effort.',
    },
    {
      section: 'commercials',
      area: 'ROM commercials',
      action: 'recalculate',
      selector: { type: 'facets', facets: ['driver:infrastructure'], facetNoun: 'the infrastructure workstreams' },
      because: 'The ROM is re-priced from the recalculated infrastructure effort.',
    },
  ],
  preserved: [
    ...preservedEverywhere(['prd', 'functionalScope', 'dataIntegration', 'aiStrategy'], SECTION_AREAS, 'The number of environments changes how the solution is deployed, not its scope, data design or AI approach.'),
    SCOPE_UNTOUCHED_BY_CONFIG,
  ],
};

const TARGET_REGIONS_RULE: ImpactRule = {
  areas: [
    {
      section: 'architecture',
      area: 'Regional deployment, availability and disaster recovery',
      action: 'regenerate',
      selector: { type: 'facets', facets: ['area:deployment', 'area:availability', 'area:backup-dr', 'area:data-storage'], facetNoun: 'the regional deployment, storage and recovery design' },
      because: 'Region placement, replication and failover are designed for the configured target regions.',
    },
    {
      section: 'architecture',
      area: 'Region-bound requirements',
      action: 'regenerate',
      selector: { type: 'cites-signals', signals: REGION_SIGNALS, targetPhrase: REGION_TARGET },
      because: 'These expectations are met differently depending on where the solution is hosted.',
    },
    {
      section: 'dataIntegration',
      area: 'Data residency, retention and recovery',
      action: 'regenerate',
      selector: { type: 'facets', facets: ['topic:privacy-security', 'topic:retention', 'topic:backup-recovery', 'topic:transactional-storage'], facetNoun: 'the region-dependent data topics' },
      because: 'Where data is stored, retained and recovered follows the target regions.',
    },
    { section: 'aiStrategy', area: 'AI data privacy and model region', action: 'regenerate', selector: WHOLE_SECTION, because: 'Model endpoints and prompt data must stay inside the configured regions.' },
    {
      section: 'estimate',
      area: 'Cloud infrastructure effort',
      action: 'regenerate',
      selector: { type: 'facets', facets: ['driver:infrastructure'], facetNoun: 'the cloud infrastructure drivers' },
      because: 'Infrastructure complexity is banded by the number of target regions.',
    },
    {
      section: 'commercials',
      area: 'ROM commercials',
      action: 'recalculate',
      selector: { type: 'facets', facets: ['driver:infrastructure'], facetNoun: 'the infrastructure workstreams' },
      because: 'The ROM is re-priced from the refreshed infrastructure effort.',
    },
  ],
  preserved: [
    ...preservedEverywhere(['prd', 'functionalScope'], SECTION_AREAS, 'Target regions change where the solution runs, not the business needs or the functional scope.'),
    SCOPE_UNTOUCHED_BY_CONFIG,
  ],
};

const AI_PROVIDER_RULE: ImpactRule = {
  areas: [
    { section: 'aiStrategy', area: 'Model options, frameworks and AI architecture pattern', action: 'regenerate', selector: WHOLE_SECTION, because: 'Model and framework recommendations are selected for the preferred AI provider.' },
    {
      section: 'architecture',
      area: 'AI and ML components',
      action: 'regenerate',
      selector: { type: 'facets', facets: ['area:ai-ml'], facetNoun: 'the AI and ML layer' },
      because: 'The model-serving and retrieval services must match the preferred AI provider.',
    },
  ],
  preserved: [
    ...preservedEverywhere(['prd', 'functionalScope', 'dataIntegration'], SECTION_AREAS, 'The AI provider preference changes which models serve the AI use cases, not the requirements, scope or data design.'),
    ...preservedEverywhere(['estimate', 'commercials'], SECTION_AREAS, 'AI effort drivers are sized by use-case complexity, not by the model vendor.'),
    SCOPE_UNTOUCHED_BY_CONFIG,
  ],
};

const PRODUCTIVITY_RULE: ImpactRule = {
  areas: [
    { section: 'estimate', area: 'Effort and timeline of every workstream', action: 'recalculate', selector: WHOLE_SECTION, because: 'Productivity, team size and the estimation baseline tables scale the effort and calendar time of every workstream.' },
    { section: 'commercials', area: 'ROM commercials', action: 'recalculate', selector: WHOLE_SECTION, because: 'The ROM is re-priced from the recalculated effort.' },
  ],
  preserved: [
    ...preservedEverywhere(DESIGN_SECTIONS, SECTION_AREAS, 'Delivery productivity changes how long the work takes, not what is built or how it is designed.'),
    SCOPE_UNTOUCHED_BY_CONFIG,
  ],
};

const COMMERCIAL_PRESERVED_REASON = 'Commercial parameters only price the estimated effort; scope, design and effort are not derived from them.';

export const IMPACT_RULES: ReadonlyMap<ChangeKind, ImpactRule> = new Map<ChangeKind, ImpactRule>([
  ['cloud-platform', CLOUD_PLATFORM_RULE],
  ['expected-users', EXPECTED_USERS_RULE],
  ['delivery-deadline', DEADLINE_RULE],
  ['environments', ENVIRONMENTS_RULE],
  ['target-regions', TARGET_REGIONS_RULE],
  ['ai-provider-preference', AI_PROVIDER_RULE],
  ['requirement-priority', PRIORITY_RULE],
  ['requirement-text', traceRule()],
  ['scope-inclusion', traceRule()],
  ['security-requirement', traceRule(SECURITY_TRACE_LABELS)],
  ['assumption', traceRule()],
  ['question-resolved', traceRule()],
  ['integration-complexity', complexityRule('Integration effort is looked up from the base-effort table at the newly set complexity.', 'A complexity setting feeds the calculation engine only; the integration design and every other deliverable stay as reviewed.')],
  ['driver-complexity', complexityRule('Driver effort is looked up from the base-effort table at the newly set complexity.', 'A complexity setting feeds the calculation engine only; scope and design deliverables stay as reviewed.')],
  ['rate-card', commercialOnlyRule('Role costs and ROM commercials', 'Workstream costs are effort days multiplied by the role day rates, so every priced line is recalculated.', COMMERCIAL_PRESERVED_REASON)],
  ['contingency', commercialOnlyRule('Contingency and ROM total', 'Contingency is a percentage of the subtotal and the ROM is subtotal plus contingency.', COMMERCIAL_PRESERVED_REASON)],
  ['currency', commercialOnlyRule('Currency of all commercial figures', 'Every cost, subtotal, contingency and ROM value is expressed in the configured currency.', COMMERCIAL_PRESERVED_REASON)],
  ['productivity', PRODUCTIVITY_RULE],
]);

/** Kinds of change whose citations are also followed through linked (relatedIds) scope items. */
export const LINKED_ITEM_KINDS: ReadonlySet<ChangeKind> = new Set<ChangeKind>(['assumption', 'question-resolved']);

/** Sections whose elements cite other generated elements, so citations are followed one hop further. */
export const ONE_HOP_SECTIONS: ReadonlySet<OutputSectionId> = new Set<OutputSectionId>(['estimate', 'commercials']);

const REQUIREMENT_COVERAGE: readonly OutputSectionId[] = ['prd', 'functionalScope', 'architecture', 'estimate', 'commercials'];
const NARRATIVE_AND_PLAN: readonly OutputSectionId[] = ['prd', 'estimate'];

/**
 * Sections that must pick up a scope item of each kind when it is newly included: nothing cites a
 * new item yet, so the trace walk alone would wrongly report every section as unaffected.
 */
export const SECTIONS_COVERING_KIND: ReadonlyMap<ScopeItemKind, readonly OutputSectionId[]> = new Map<ScopeItemKind, readonly OutputSectionId[]>([
  ['business', ['prd', 'functionalScope']],
  ['persona', ['prd']],
  ['functional', REQUIREMENT_COVERAGE],
  ['nonFunctional', ['prd', 'architecture', 'estimate', 'commercials']],
  ['existingSystem', ['prd', 'dataIntegration']],
  ['integration', [...REQUIREMENT_COVERAGE, 'dataIntegration']],
  ['data', ['prd', 'architecture', 'dataIntegration', 'estimate', 'commercials']],
  ['security', ['prd', 'architecture', 'dataIntegration', 'estimate', 'commercials']],
  ['technology', ['architecture']],
  ['constraint', NARRATIVE_AND_PLAN],
  ['dependency', NARRATIVE_AND_PLAN],
  ['risk', NARRATIVE_AND_PLAN],
  ['gap', NARRATIVE_AND_PLAN],
  ['assumption', NARRATIVE_AND_PLAN],
  ['question', ['prd']],
]);
