/**
 * Declarative rule tables the planner (planner.ts) walks to assemble a solution architecture.
 *
 * There are two tables:
 *  - FOUNDATION_RULES: components every architecture includes (web front end, API layer, compute,
 *    database, identity, observability, CI/CD, secrets, backup, network protection). They are
 *    still required to cite the scope items that justify them - see `nfrSecSignals` below - so the
 *    planner never invents a rationale for a component nothing in the reviewed scope supports.
 *  - CONDITIONAL_RULES: components only included when the reviewed scope carries a matching
 *    signal (see src/domain/signals.ts), e.g. an AI use case, an integration, or a data domain.
 *
 * Keeping this as one data table (rather than per-component branches in planner.ts) is what keeps
 * the planner itself small, and guarantees the AWS/Azure/GCP variants of an architecture always
 * propose the same logical components - only the concrete `service` differs (see catalog/).
 */
import type { ScopeItemKind, ScopeModel, SignalGroup, SolutionConfig } from '../domain';

/** Display names shared between a component's own rule and other rules' `dependencies` list. */
export const COMPONENT_NAMES = {
  webFrontEnd: 'Web Front End',
  apiLayer: 'API Layer',
  computeRuntime: 'Application Compute Runtime',
  relationalDb: 'Primary Relational Database',
  identity: 'Customer Identity and Access Management',
  monitoring: 'Monitoring',
  logging: 'Centralized Logging',
  ciCd: 'CI/CD Pipeline',
  infrastructureAsCode: 'Infrastructure as Code',
  secretsManager: 'Secrets Manager',
  keyManagement: 'Key Management',
  backup: 'Backup',
  networkProtection: 'Network Protection',
  wafDdos: 'WAF / DDoS Protection',
  integrationApiManagement: 'Integration API Management',
  integrationService: 'Integration Service',
  messageQueue: 'Message Queue',
  eventBus: 'Event Bus',
  sftp: 'SFTP / File Transfer',
  scheduler: 'Scheduler',
  dataWarehouse: 'Data Warehouse',
  etlPipeline: 'ETL Pipeline',
  objectStorage: 'Object Storage',
  biReporting: 'BI / Reporting',
  llmPlatform: 'LLM Platform',
  vectorSearch: 'Vector Search',
  documentAi: 'Document AI / OCR',
  mlPlatform: 'ML Platform',
  availabilityScaling: 'High Availability & Autoscaling',
  drMultiRegion: 'Disaster Recovery / Multi-Region',
  cache: 'Cache',
  searchService: 'Search Service',
  notification: 'Notification Service',
  workflowOrchestration: 'Workflow Orchestration',
  mobileBackend: 'Mobile Backend',
} as const;

/** Expected concurrent users above which caching/autoscaling is called out even without an explicit NFR. */
export const HIGH_USER_VOLUME_THRESHOLD = 10_000;

/** A component every architecture proposes, provided the reviewed scope justifies it. */
export interface FoundationRule {
  key: string;
  logicalComponent: string;
  name: string;
  purpose: string;
  /** Lower-cased and appended after the service name to read '<service> <fragment>.' in the
   *  assembled rationale (see planner.ts buildRationale). */
  rationaleFragment: string;
  tradeOffs: readonly string[];
  dependencies: readonly string[];
  securityConsiderations: readonly string[];
  /** NFR/security signal ids checked first for a direct justification (see justification.ts). */
  nfrSecSignals: readonly string[];
  /** Exact signal ids that justify this component when no direct NFR/security item matched - any
   *  in-scope item of a citable kind (justification.ts CITABLE_REQUIREMENT_KINDS), not only NFR/security. */
  relatedSignals?: readonly string[];
  /** Whole signal groups that justify this component the same way as relatedSignals. */
  relatedGroups?: readonly SignalGroup[];
  /** Item kinds that justify this component directly, bypassing signal matching entirely - for a
   *  driver that carries no domain signal of its own (e.g. a delivery constraint behind CI/CD). */
  relatedKinds?: readonly ScopeItemKind[];
  /** Alternate purpose/rationale text used only when every reviewed persona is internal staff, so the
   *  narrative never talks about customers, end users or self-service sign-up for an internal tool. */
  internalAudienceText?: { purpose?: string; rationaleFragment?: string };
}

/** A component only proposed when the reviewed scope carries a matching signal. */
export interface ConditionalRule {
  key: string;
  logicalComponent: string;
  name: string;
  purpose: string;
  rationaleFragment: string;
  tradeOffs: readonly string[];
  dependencies: readonly string[];
  securityConsiderations: readonly string[];
  /** Any in-scope item carrying one of these signals triggers inclusion and supplies the citation. */
  triggerSignals: readonly string[];
  /** When set, also triggers on (and cites) any in-scope item carrying any signal from this whole group. */
  triggerGroup?: SignalGroup;
  /** When set, only items of this scope-item kind count toward the trigger (narrows triggerSignals/triggerGroup). */
  requireKind?: ScopeItemKind;
  /** Optional extra trigger evaluated against config (e.g. expected user volume) alongside signals. */
  additionalTrigger?: (scope: ScopeModel, config: SolutionConfig) => boolean;
  /** Named lighter-weight option to fall back on while every citing item is Low-priority or still
   *  undefined (justification.ts isLowConfidenceJustification) - the component is still proposed, but
   *  flagged with a trade-off instead of committed to outright. */
  lightweightAlternative?: string;
}

export const FOUNDATION_RULES: readonly FoundationRule[] = [
  {
    key: 'web-front-end',
    logicalComponent: 'web-hosting-cdn',
    name: COMPONENT_NAMES.webFrontEnd,
    purpose: 'Serves the customer-facing web experience and delivers static assets close to users.',
    rationaleFragment: 'serves the web experience with edge caching, TLS termination and low first-byte latency worldwide',
    tradeOffs: [
      'Edge caching improves latency but requires explicit cache-invalidation on release.',
      'A globally distributed edge adds a small recurring data-transfer cost versus single-region hosting.',
    ],
    dependencies: [COMPONENT_NAMES.apiLayer, COMPONENT_NAMES.identity],
    securityConsiderations: [
      'Enforce HTTPS-only delivery and a strict Content-Security-Policy at the edge.',
      'Restrict direct access to origin storage so all traffic is served through the CDN.',
    ],
    nfrSecSignals: ['nfr:usability', 'nfr:accessibility', 'nfr:performance', 'nfr:localization'],
    relatedSignals: ['capability:portal'],
    internalAudienceText: {
      purpose: 'Serves the internal web experience and delivers static assets close to the staff who use it.',
    },
  },
  {
    key: 'api-layer',
    logicalComponent: 'api-gateway',
    name: COMPONENT_NAMES.apiLayer,
    purpose: "Exposes the solution's functional capabilities as versioned, governed APIs for the front end and integrations.",
    rationaleFragment: 'centralizes authentication, throttling and request validation ahead of the application compute runtime',
    tradeOffs: [
      'A managed gateway adds a small per-request latency and cost overhead versus calling services directly.',
      'API versioning policy must be agreed early to avoid breaking existing client integrations.',
    ],
    dependencies: [COMPONENT_NAMES.computeRuntime, COMPONENT_NAMES.identity],
    securityConsiderations: [
      'Apply request-rate throttling and payload-size limits to reduce abuse and denial-of-service exposure.',
      'Validate and authorize every request against the identity provider before it reaches the runtime.',
    ],
    nfrSecSignals: ['nfr:performance', 'nfr:scalability', 'security:rbac'],
    relatedGroups: ['integration', 'capability'],
  },
  {
    key: 'compute-runtime',
    logicalComponent: 'container-runtime',
    name: COMPONENT_NAMES.computeRuntime,
    purpose: 'Hosts the backend business logic that implements the reviewed functional requirements.',
    rationaleFragment: 'runs the backend services with managed autoscaling so capacity tracks real traffic without manual intervention',
    tradeOffs: [
      'Container-based hosting requires a build/release pipeline for every deployable service.',
      'Autoscaling limits must be tuned against real traffic before go-live to avoid cost or latency surprises.',
    ],
    dependencies: [COMPONENT_NAMES.relationalDb, COMPONENT_NAMES.monitoring],
    securityConsiderations: [
      'Run containers with least-privilege service identities and no long-lived static credentials.',
      'Scan container images for known vulnerabilities before each release.',
    ],
    nfrSecSignals: ['nfr:scalability', 'nfr:performance', 'nfr:maintainability'],
  },
  {
    key: 'relational-db',
    logicalComponent: 'managed-relational-db',
    name: COMPONENT_NAMES.relationalDb,
    purpose: 'Stores the core transactional data the application reads and writes.',
    rationaleFragment: 'provides managed relational storage with automated backups, patching and encryption at rest',
    tradeOffs: [
      'A managed relational engine caps vertical scale; very high write throughput may need read replicas or partitioning later.',
      'Schema migrations must be coordinated with application deployments to avoid downtime.',
    ],
    dependencies: [COMPONENT_NAMES.backup, COMPONENT_NAMES.keyManagement],
    securityConsiderations: [
      'Encrypt data at rest and in transit, and restrict network access to the application tier only.',
      'Apply least-privilege database roles per service rather than a single shared credential.',
    ],
    nfrSecSignals: ['nfr:scalability', 'nfr:performance', 'security:encryption'],
    relatedKinds: ['data'],
  },
  {
    key: 'identity',
    logicalComponent: 'identity-customer',
    name: COMPONENT_NAMES.identity,
    purpose: 'Handles registration, sign-in, session management and multi-factor authentication for end users.',
    rationaleFragment: 'provides managed sign-up, sign-in, SSO federation and MFA so authentication is never implemented by hand',
    tradeOffs: [
      'A managed identity provider constrains custom sign-in UX to its supported customization hooks.',
      'Federating with an external identity provider (SSO) adds a dependency on that provider’s availability.',
    ],
    dependencies: [COMPONENT_NAMES.secretsManager],
    securityConsiderations: [
      'Enforce MFA for privileged accounts and require strong password/session policies for all users.',
      'Log every authentication and authorization decision for audit purposes.',
    ],
    nfrSecSignals: ['security:sso', 'security:mfa', 'security:rbac'],
    relatedSignals: ['security:sso', 'security:mfa', 'security:rbac'],
    internalAudienceText: {
      purpose:
        'Federates sign-in, session management and multi-factor authentication for internal staff against the existing identity provider, rather than a new customer-style registration system.',
      rationaleFragment: 'federates sign-in, session management and MFA for internal staff against the existing identity provider, with no new self-registration flow to build',
    },
  },
  {
    key: 'monitoring',
    logicalComponent: 'monitoring',
    name: COMPONENT_NAMES.monitoring,
    purpose: 'Tracks infrastructure and application health so incidents are detected before customers report them.',
    rationaleFragment: 'aggregates metrics and dashboards with alerting thresholds tied to the availability and performance targets',
    tradeOffs: [
      'Alert thresholds must be tuned to avoid both alert fatigue and missed incidents.',
      'Detailed metric retention adds a recurring storage cost proportional to system scale.',
    ],
    dependencies: [COMPONENT_NAMES.logging, COMPONENT_NAMES.computeRuntime],
    securityConsiderations: ['Restrict dashboard and alert access to operations and engineering roles only.'],
    nfrSecSignals: ['nfr:observability'],
    relatedSignals: ['nfr:availability', 'security:audit'],
    relatedGroups: ['compliance'],
    internalAudienceText: {
      purpose: 'Tracks infrastructure and application health so incidents are detected before internal staff are blocked by them.',
    },
  },
  {
    key: 'logging',
    logicalComponent: 'logging',
    name: COMPONENT_NAMES.logging,
    purpose: 'Centralizes application and infrastructure logs for troubleshooting and audit.',
    rationaleFragment: 'aggregates structured logs from every service with a defined, policy-driven retention period',
    tradeOffs: [
      'Centralized log retention has a direct storage cost that scales with request volume.',
      'Log content must be scrubbed of personal or sensitive data before it is retained.',
    ],
    dependencies: [COMPONENT_NAMES.monitoring],
    securityConsiderations: [
      'Redact personal or sensitive data from log payloads before they are written.',
      'Restrict log access to authorized operations staff and retain an access audit trail.',
    ],
    nfrSecSignals: ['nfr:observability', 'security:audit'],
    relatedSignals: ['nfr:availability', 'security:audit'],
    relatedGroups: ['compliance'],
  },
  {
    key: 'ci-cd',
    logicalComponent: 'ci-cd',
    name: COMPONENT_NAMES.ciCd,
    purpose: 'Automates build, test and release of every service into each environment.',
    rationaleFragment: 'runs the build/test/release pipeline consistently across development, test and production',
    tradeOffs: ['A fully automated pipeline needs an initial investment in test coverage to be trustworthy for production releases.'],
    dependencies: [COMPONENT_NAMES.infrastructureAsCode],
    securityConsiderations: [
      'Require code review and passing automated security scans before a release can be promoted.',
      'Keep deployment credentials scoped to the pipeline identity, never to individual engineers.',
    ],
    nfrSecSignals: ['nfr:maintainability'],
    relatedKinds: ['technology', 'constraint'],
  },
  {
    key: 'infrastructure-as-code',
    logicalComponent: 'infrastructure-as-code',
    name: COMPONENT_NAMES.infrastructureAsCode,
    purpose: 'Defines every environment declaratively so dev/test/prod stay reproducible and auditable.',
    rationaleFragment: 'provisions and updates cloud resources declaratively, so environment drift is detected instead of accumulating silently',
    tradeOffs: ['Declarative provisioning has a learning curve for teams used to manual console changes.'],
    dependencies: [COMPONENT_NAMES.ciCd],
    securityConsiderations: ['Store infrastructure state and variables in a controlled, access-audited location, never in source control in plain text.'],
    nfrSecSignals: ['nfr:maintainability'],
    relatedKinds: ['technology', 'constraint'],
  },
  {
    key: 'secrets-manager',
    logicalComponent: 'secrets-manager',
    name: COMPONENT_NAMES.secretsManager,
    purpose: 'Stores and rotates credentials, API keys and connection strings used by every service.',
    rationaleFragment: 'centralizes credential storage with automatic rotation and fine-grained access policies',
    tradeOffs: ['Every service must be updated to fetch secrets at runtime rather than reading them from local configuration.'],
    dependencies: [COMPONENT_NAMES.keyManagement],
    securityConsiderations: [
      'Grant read access to a secret only to the specific service identities that need it.',
      'Rotate credentials on a defined schedule and immediately after any suspected exposure.',
    ],
    nfrSecSignals: ['security:secrets'],
    relatedSignals: ['security:encryption'],
    relatedKinds: ['integration'],
  },
  {
    key: 'key-management',
    logicalComponent: 'key-management',
    name: COMPONENT_NAMES.keyManagement,
    purpose: 'Manages the encryption keys that protect data at rest across storage and database services.',
    rationaleFragment: 'issues and rotates encryption keys with a full audit trail of every key-use event',
    tradeOffs: ['Customer-managed keys add operational responsibility for key rotation and recovery policy.'],
    dependencies: [],
    securityConsiderations: ['Rotate keys on a defined schedule and restrict key administration to a small, audited group.'],
    nfrSecSignals: ['security:encryption', 'security:secrets'],
    relatedSignals: ['security:encryption'],
    relatedKinds: ['integration'],
  },
  {
    key: 'backup',
    logicalComponent: 'backup',
    name: COMPONENT_NAMES.backup,
    purpose: 'Protects stored data with policy-driven, regularly tested backups.',
    rationaleFragment: 'takes policy-driven, encrypted backups on a defined schedule with a tested restore procedure',
    tradeOffs: ['Backup retention has a direct storage cost that scales with data volume and retention period.'],
    dependencies: [COMPONENT_NAMES.relationalDb],
    securityConsiderations: ['Encrypt backups at rest and test restores on a regular schedule, not only after an incident.'],
    nfrSecSignals: ['nfr:availability'],
    relatedSignals: ['nfr:availability', 'data:retention'],
  },
  {
    key: 'network-protection',
    logicalComponent: 'private-networking',
    name: COMPONENT_NAMES.networkProtection,
    purpose: 'Isolates backend services on a private network so they are not directly reachable from the public internet.',
    rationaleFragment: 'keeps service-to-service traffic off the public internet and restricts inbound access to approved paths only',
    tradeOffs: ['Private networking adds configuration overhead when a new service or integration needs external connectivity.'],
    dependencies: [],
    securityConsiderations: [
      'Default to deny-all network rules and open only the specific paths a service requires.',
      'Log and periodically review network access-control changes.',
    ],
    nfrSecSignals: ['security:network', 'security:data-residency'],
    relatedGroups: ['security', 'compliance'],
  },
  {
    key: 'waf-ddos',
    logicalComponent: 'waf-ddos',
    name: COMPONENT_NAMES.wafDdos,
    purpose: 'Filters malicious inbound traffic and absorbs volumetric attacks at the edge, in front of the public entry point.',
    rationaleFragment: 'inspects inbound requests against managed and custom rule sets and mitigates volumetric attacks before they reach the application',
    tradeOffs: ['Rule tuning is required to avoid false positives blocking legitimate traffic.'],
    dependencies: [],
    securityConsiderations: [
      'Enable managed rule sets for common web exploits and review blocked-request logs regularly.',
      'Alert on traffic patterns consistent with a volumetric or application-layer attack.',
    ],
    nfrSecSignals: ['security:network', 'security:data-residency'],
    relatedGroups: ['security', 'compliance'],
  },
];

export const CONDITIONAL_RULES: readonly ConditionalRule[] = [
  {
    key: 'integration-api-management',
    logicalComponent: 'api-gateway',
    name: COMPONENT_NAMES.integrationApiManagement,
    purpose: 'Publishes governed, versioned endpoints for partner and internal system integrations, separate from the product’s own front-end API.',
    rationaleFragment: 'exposes integration endpoints with independent throttling, auth and monitoring from the customer-facing API',
    tradeOffs: ['Running a second managed API surface adds a small recurring cost versus reusing the front-end API layer.'],
    dependencies: [COMPONENT_NAMES.integrationService],
    securityConsiderations: ['Require mutual authentication (API key or mTLS) for every partner system calling this surface.'],
    triggerSignals: [],
    triggerGroup: 'integration',
    requireKind: 'integration',
  },
  {
    key: 'integration-service',
    logicalComponent: 'integration-service',
    name: COMPONENT_NAMES.integrationService,
    purpose: 'Coordinates data exchange with the external systems identified in the reviewed scope.',
    rationaleFragment: 'provides managed connectors, retry and error-handling policy for each external-system integration',
    tradeOffs: ['Each new external system requires its own connector configuration, credential and monitoring setup.'],
    dependencies: [COMPONENT_NAMES.messageQueue],
    securityConsiderations: ['Store integration credentials in the secrets manager and scope them per external system.'],
    triggerSignals: [],
    triggerGroup: 'integration',
    requireKind: 'integration',
  },
  {
    key: 'message-queue',
    logicalComponent: 'message-queue',
    name: COMPONENT_NAMES.messageQueue,
    purpose: 'Decouples integration producers and consumers so a slow or unavailable external system does not block the application.',
    rationaleFragment: 'buffers integration messages with dead-letter handling so failed deliveries are retried rather than lost',
    tradeOffs: ['Asynchronous delivery means consumers must tolerate eventual, not immediate, consistency.'],
    dependencies: [],
    securityConsiderations: ['Encrypt messages in transit and at rest, and restrict queue access to the integration service identity.'],
    triggerSignals: [],
    triggerGroup: 'integration',
    requireKind: 'integration',
  },
  {
    key: 'event-bus',
    logicalComponent: 'event-bus',
    name: COMPONENT_NAMES.eventBus,
    purpose: 'Routes near-real-time events between the application and external systems that require immediate synchronization.',
    rationaleFragment: 'routes schema-validated events to subscribers with sub-second delivery for real-time synchronization needs',
    tradeOffs: ['Event-driven synchronization requires each consumer to handle duplicate or out-of-order delivery.'],
    dependencies: [COMPONENT_NAMES.integrationService],
    securityConsiderations: ['Restrict event publication to authenticated service identities and validate event schemas at the bus.'],
    triggerSignals: ['integration:realtime'],
  },
  {
    key: 'sftp-file-transfer',
    logicalComponent: 'sftp-file-transfer',
    name: COMPONENT_NAMES.sftp,
    purpose: 'Exchanges files with external systems that only support batch file transfer rather than APIs or events.',
    rationaleFragment: 'provides a managed SFTP endpoint backed by object storage for scheduled partner file exchange',
    tradeOffs: ['File-based exchange typically has higher latency and weaker delivery guarantees than an API or event integration.'],
    dependencies: [COMPONENT_NAMES.objectStorage, COMPONENT_NAMES.scheduler],
    securityConsiderations: ['Restrict file transfer accounts to the minimum directories required and rotate their credentials regularly.'],
    triggerSignals: ['integration:file'],
    requireKind: 'integration',
  },
  {
    key: 'scheduler',
    logicalComponent: 'scheduler',
    name: COMPONENT_NAMES.scheduler,
    purpose: 'Triggers recurring batch jobs such as scheduled data synchronization and report generation.',
    rationaleFragment: 'triggers batch jobs on a defined cron schedule with built-in retry on failure',
    tradeOffs: ['Scheduled jobs need monitoring of their own to detect a silently skipped or failed run.'],
    dependencies: [COMPONENT_NAMES.integrationService],
    securityConsiderations: ['Run scheduled jobs under a dedicated, least-privilege service identity.'],
    triggerSignals: ['integration:batch'],
  },
  {
    key: 'data-warehouse',
    logicalComponent: 'data-warehouse',
    name: COMPONENT_NAMES.dataWarehouse,
    purpose: 'Provides a column-oriented analytical store for cross-domain reporting and analysis.',
    rationaleFragment: 'holds curated, query-optimized data separate from transactional load so reporting never competes with production traffic',
    tradeOffs: ['A separate analytical store adds pipeline latency between an event occurring and it being reportable.'],
    dependencies: [COMPONENT_NAMES.etlPipeline],
    securityConsiderations: ['Apply row/column-level access controls so analysts see only the data domains they are authorized for.'],
    triggerSignals: ['data:warehouse', 'data:reporting'],
    lightweightAlternative: 'a small set of reporting views directly in the primary relational database',
  },
  {
    key: 'etl-pipeline',
    logicalComponent: 'etl-pipeline',
    name: COMPONENT_NAMES.etlPipeline,
    purpose: 'Moves and transforms data from source systems into the analytical store or between domains.',
    rationaleFragment: 'runs scheduled extraction and transformation jobs with data-quality checks before data lands downstream',
    tradeOffs: ['Pipeline failures require monitoring and a defined re-run/backfill procedure to avoid silent data gaps.'],
    dependencies: [COMPONENT_NAMES.scheduler],
    securityConsiderations: ['Mask or tokenize sensitive fields during transformation before data reaches lower-trust environments.'],
    triggerSignals: ['data:etl', 'data:migration'],
    lightweightAlternative: 'a single scheduled export/import job instead of a dedicated pipeline',
  },
  {
    key: 'object-storage',
    logicalComponent: 'object-storage',
    name: COMPONENT_NAMES.objectStorage,
    purpose: 'Stores documents and other unstructured content referenced by the application.',
    rationaleFragment: 'stores unstructured content durably with lifecycle policies and encryption at rest',
    tradeOffs: ['Large unstructured content volumes need an explicit lifecycle/retention policy to control storage cost.'],
    dependencies: [COMPONENT_NAMES.keyManagement],
    securityConsiderations: ['Generate time-limited access URLs rather than exposing storage buckets/containers directly.'],
    triggerSignals: ['data:documents'],
  },
  {
    key: 'bi-reporting',
    logicalComponent: 'bi-reporting',
    name: COMPONENT_NAMES.biReporting,
    purpose: 'Delivers self-service dashboards and reports to business stakeholders over the warehouse.',
    rationaleFragment: 'provides governed, self-service dashboards over curated warehouse data',
    tradeOffs: ['Self-service reporting requires a governed semantic layer to prevent conflicting metric definitions.'],
    dependencies: [COMPONENT_NAMES.dataWarehouse],
    securityConsiderations: ['Scope dashboard access by role so stakeholders see only their authorized data domains.'],
    triggerSignals: ['data:reporting', 'capability:reporting'],
    lightweightAlternative: 'scheduled exports or database-backed reporting views instead of a dedicated BI platform',
  },
  {
    key: 'llm-platform',
    logicalComponent: 'llm-platform',
    name: COMPONENT_NAMES.llmPlatform,
    purpose: 'Provides managed access to foundation models for the AI use cases identified in the reviewed scope.',
    rationaleFragment: 'gives managed, guardrailed access to foundation models so AI functionality is not built on an unmanaged model endpoint',
    tradeOffs: ['Model responses are probabilistic; outputs affecting decisions need a human-review step (see AI solution approach).'],
    dependencies: [COMPONENT_NAMES.secretsManager],
    securityConsiderations: ['Apply content-safety guardrails and never send unmasked personal data in a prompt without a documented basis.'],
    triggerSignals: [],
    triggerGroup: 'ai',
  },
  {
    key: 'vector-search',
    logicalComponent: 'vector-search',
    name: COMPONENT_NAMES.vectorSearch,
    purpose: 'Retrieves the most relevant grounding content for retrieval-augmented AI responses.',
    rationaleFragment: 'indexes content as embeddings so the AI assistant retrieves grounded context instead of relying on model memory alone',
    tradeOffs: ['Retrieval quality depends on how the source content is chunked and kept up to date; this needs an ongoing content-ops process.'],
    dependencies: [COMPONENT_NAMES.llmPlatform, COMPONENT_NAMES.objectStorage],
    securityConsiderations: ['Enforce the same access controls on retrieved content as on the source documents, so retrieval cannot bypass permissions.'],
    triggerSignals: ['ai:rag'],
    lightweightAlternative: 'direct keyword search over the primary database instead of a vector index',
  },
  {
    key: 'document-ai',
    logicalComponent: 'document-ai',
    name: COMPONENT_NAMES.documentAi,
    purpose: 'Extracts structured text and data from scanned or unstructured source documents.',
    rationaleFragment: 'extracts structured text, tables and key-value pairs from source documents before they are indexed or processed',
    tradeOffs: ['Extraction accuracy varies with source document quality and may need a human-review step for low-confidence results.'],
    dependencies: [COMPONENT_NAMES.objectStorage],
    securityConsiderations: ['Route extracted personal data through the same encryption and access controls as the rest of the data estate.'],
    triggerSignals: ['ai:extraction'],
    lightweightAlternative: 'manual data entry backed by the object storage upload flow instead of automated extraction',
  },
  {
    key: 'ml-platform',
    logicalComponent: 'ml-platform',
    name: COMPONENT_NAMES.mlPlatform,
    purpose: 'Trains, deploys and monitors the predictive models behind forecasting, anomaly detection or recommendation use cases.',
    rationaleFragment: 'trains and serves predictive models with drift monitoring, distinct from the generative LLM platform',
    tradeOffs: ['Predictive models need a labeled training dataset and ongoing retraining as behavior/data patterns shift.'],
    dependencies: [COMPONENT_NAMES.dataWarehouse],
    securityConsiderations: ['Monitor for model drift and bias, and restrict retraining access to the ML engineering team.'],
    triggerSignals: ['ai:forecasting', 'ai:anomaly', 'ai:recommendation'],
    lightweightAlternative: 'a simple rules-based heuristic instead of a trained model until enough labeled data exists',
  },
  {
    key: 'availability-scaling',
    logicalComponent: 'availability-scaling',
    name: COMPONENT_NAMES.availabilityScaling,
    purpose: 'Distributes traffic and compute capacity across multiple availability zones to sustain the required uptime.',
    rationaleFragment: 'spreads compute across multiple availability zones with automatic failover and load-based scaling',
    tradeOffs: ['Multi-AZ deployment increases baseline infrastructure cost versus a single-instance deployment.'],
    dependencies: [COMPONENT_NAMES.computeRuntime],
    securityConsiderations: ['Ensure failover paths are exercised in a game-day/DR test, not only documented.'],
    triggerSignals: ['nfr:availability'],
    requireKind: 'nonFunctional',
  },
  {
    key: 'dr-multi-region',
    logicalComponent: 'dr-multi-region',
    name: COMPONENT_NAMES.drMultiRegion,
    purpose: 'Provides a cross-region recovery path so the service can be restored after a regional outage.',
    rationaleFragment: 'replicates critical data and configuration to a secondary region with a documented recovery time/point objective',
    tradeOffs: ['A warm or hot standby region roughly doubles the infrastructure cost of the protected components.'],
    dependencies: [COMPONENT_NAMES.backup, COMPONENT_NAMES.relationalDb],
    securityConsiderations: ['Keep the secondary region’s access controls and encryption configuration in parity with primary.'],
    triggerSignals: ['nfr:availability'],
    requireKind: 'nonFunctional',
    lightweightAlternative: 'relying on the primary region’s tested backups for recovery instead of a warm standby region',
  },
  {
    key: 'cache',
    logicalComponent: 'cache',
    name: COMPONENT_NAMES.cache,
    purpose: 'Reduces database load and read latency for frequently accessed data under high concurrent usage.',
    rationaleFragment: 'serves hot read paths from memory so the relational database is not the scaling bottleneck under peak load',
    tradeOffs: ['Cached data can briefly go stale after a write; time-to-live and invalidation rules must be defined per data type.'],
    dependencies: [COMPONENT_NAMES.relationalDb],
    securityConsiderations: ['Encrypt cache traffic and avoid caching personal data beyond the minimum required time-to-live.'],
    triggerSignals: ['nfr:scalability', 'nfr:performance'],
    additionalTrigger: (_scope, config) => config.expectedUsers !== null && config.expectedUsers >= HIGH_USER_VOLUME_THRESHOLD,
    lightweightAlternative: 'relying on the primary database’s own query performance instead of a dedicated cache',
  },
  {
    key: 'search-service',
    logicalComponent: 'search-service',
    name: COMPONENT_NAMES.searchService,
    purpose: 'Provides fast, relevant search and discovery over application content.',
    rationaleFragment: 'indexes application content for fast, relevance-ranked search rather than relying on database queries',
    tradeOffs: ['A dedicated search index must be kept synchronized with the source of truth, adding a small propagation delay.'],
    dependencies: [COMPONENT_NAMES.computeRuntime],
    securityConsiderations: ['Apply the same authorization filters to search results as to direct data access, so search cannot leak restricted content.'],
    triggerSignals: ['capability:search'],
    lightweightAlternative: 'database-backed filtering and sorting instead of a dedicated search index',
  },
  {
    key: 'notification',
    logicalComponent: 'notification',
    name: COMPONENT_NAMES.notification,
    purpose: 'Delivers email, SMS and push notifications and alerts to end users.',
    rationaleFragment: 'delivers multi-channel notifications with delivery tracking, separate from the transactional data path',
    tradeOffs: ['Delivery across third-party email/SMS/push channels is subject to those channels’ own rate and deliverability limits.'],
    dependencies: [COMPONENT_NAMES.eventBus],
    securityConsiderations: ['Honor user opt-out/consent preferences and avoid placing sensitive personal data in notification payloads.'],
    triggerSignals: ['capability:notifications'],
    lightweightAlternative: 'transactional email sent directly from the application compute runtime instead of a dedicated notification service',
  },
  {
    key: 'workflow-orchestration',
    logicalComponent: 'workflow-orchestration',
    name: COMPONENT_NAMES.workflowOrchestration,
    purpose: 'Coordinates multi-step approval and workflow processes that span several services.',
    rationaleFragment: 'tracks each workflow step’s state durably so a partially completed process can resume after a failure',
    tradeOffs: ['Orchestrated workflows add operational complexity versus simple synchronous calls and need their own monitoring.'],
    dependencies: [COMPONENT_NAMES.computeRuntime],
    securityConsiderations: ['Enforce the same authorization checks at each workflow step as would apply to a direct API call.'],
    triggerSignals: ['capability:workflow'],
    lightweightAlternative: 'sequential logic in the application compute runtime instead of a dedicated orchestrator',
  },
  {
    key: 'mobile-backend',
    logicalComponent: 'mobile-backend',
    name: COMPONENT_NAMES.mobileBackend,
    purpose: 'Supports the native/mobile client with authentication, offline sync and push registration.',
    rationaleFragment: 'provides mobile-optimized authentication and data-sync primitives distinct from the web front end',
    tradeOffs: ['Mobile clients require their own release/rollout process, independent of the web front end’s deployment cadence.'],
    dependencies: [COMPONENT_NAMES.apiLayer, COMPONENT_NAMES.identity],
    securityConsiderations: ['Use short-lived tokens with refresh for mobile sessions given the higher risk of device loss.'],
    triggerSignals: ['capability:mobile'],
    lightweightAlternative: 'a responsive web experience through the existing API layer instead of a dedicated mobile backend',
  },
];
