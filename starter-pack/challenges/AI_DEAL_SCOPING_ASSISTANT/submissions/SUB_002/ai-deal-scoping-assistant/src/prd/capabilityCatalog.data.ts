/**
 * Signal -> capability lookup table that drives the deterministic PRD planner (see plan.ts /
 * capabilities.ts). Every non-NFR signal in src/domain/signals.ts (capability:*, integration:*,
 * data:*, ai:*, security:*) has exactly one row here so a reviewed requirement carrying that
 * signal is routed to a named capability with a module, workstream, delivery package, opening
 * scope sentence, acceptance hints and a suggested Topcoder challenge type. Several signals that
 * describe the same real capability (e.g. ai:assistant and ai:rag) intentionally share a
 * `capabilityName` so their requirements merge into one capability instead of duplicating it.
 * A requirement whose signals match none of these rows falls back to `CORE_PLATFORM_CAPABILITY`
 * (see capabilities.ts) so nothing from the reviewed scope is ever silently dropped.
 */

/** Topcoder challenge shapes a delivery package can be decomposed into (see assemble.ts). */
export type ChallengeType = 'Design challenge' | 'Development challenge series' | 'Data science challenge';

export interface CapabilityCatalogEntry {
  /** Fully-qualified signal id this row matches, e.g. 'capability:identity'. */
  signal: string;
  capabilityName: string;
  module: string;
  workstream: string;
  deliveryPackage: string;
  /** Opening sentence of the capability's scope paragraph; the planner appends the concrete requirement titles and system names. */
  scopeIntro: string;
  acceptanceHints: readonly string[];
  challengeType: ChallengeType;
  /**
   * True for a signal that describes a cross-cutting mechanism or purpose (a transfer protocol or
   * cadence, a broad BI/warehouse product family, generic audit logging) rather than a specific named
   * system or control. Such a signal is prone to matching a passing mention on a requirement whose
   * primary ask a more specific sibling signal already names (for example one Okta requirement
   * fanning into both "Identity Provider Integration" and "Data Warehouse and BI Integration").
   * When a broad and a specific capability end up citing the identical requirement set,
   * capabilities.ts folds the broad one into the specific one instead of billing/tracing it twice.
   */
  broadSignal?: boolean;
}

const PACKAGE_1_FOUNDATION = 'Package 1 - Foundation';
const PACKAGE_2_DATA_INTEGRATION = 'Package 2 - Data and Integration';
const PACKAGE_3_AI_CAPABILITIES = 'Package 3 - AI Capabilities';
const PACKAGE_4_SECURITY_COMPLIANCE = 'Package 4 - Security and Compliance';

const APPLICATION_EXPERIENCE = 'Application Experience';
const PLATFORM_FOUNDATION = 'Platform Foundation';
const SYSTEMS_INTEGRATION = 'Systems Integration';
const DATA_PLATFORM = 'Data Platform';
const AI_CAPABILITIES = 'AI Capabilities';
const SECURITY_AND_COMPLIANCE = 'Security and Compliance';

/** capability:* signals - the product's own user-facing capabilities (Package 1). */
const CAPABILITY_SIGNAL_ROWS: readonly CapabilityCatalogEntry[] = [
  {
    signal: 'capability:identity',
    capabilityName: 'Identity, Sign-In and Profile Management',
    module: PLATFORM_FOUNDATION,
    workstream: 'Identity and Access',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro:
      "Provide self-service registration, authentication and profile management so users can create and maintain their own account without support intervention.",
    acceptanceHints: [
      'A new user can register, verify their identity and sign in without manual provisioning.',
      'A signed-in user can update their own profile and the change is reflected immediately.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'capability:search',
    capabilityName: 'Search and Discovery',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide search and discovery so users can find the records, documents or catalog entries relevant to their task.',
    acceptanceHints: [
      'A keyword search returns relevant results ranked by relevance within an acceptable response time.',
      'Search results respect the same access controls as the underlying records.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:documents',
    capabilityName: 'Document Management',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide document management covering upload, storage, retrieval and lifecycle control for the files the solution manages.',
    acceptanceHints: [
      'A user can upload, view and download a document of a supported type and size.',
      'Document versions and access are tracked so an auditor can reconstruct who accessed what.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:payments',
    capabilityName: 'Payments and Billing',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide payments and billing so users can pay, be invoiced or reconcile charges through the platform.',
    acceptanceHints: [
      'A payment can be captured end to end and the resulting invoice matches the amount charged.',
      'A failed or disputed payment is surfaced to the user and to finance without manual reconciliation.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'capability:notifications',
    capabilityName: 'Notifications and Alerts',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide notifications and alerts so users and administrators are informed of relevant events across the channels they use.',
    acceptanceHints: [
      'A triggering event produces a notification on every configured channel within the agreed delay.',
      'A user can manage which notification categories they receive.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:reporting',
    capabilityName: 'Dashboards and Reporting',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide dashboards and reporting so stakeholders can monitor operational and business metrics without manual data extraction.',
    acceptanceHints: [
      'A named stakeholder dashboard loads the current metrics without a manual export step.',
      'Report figures reconcile with the underlying transactional data for a sample period.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:workflow',
    capabilityName: 'Workflow and Approvals',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide workflow and approvals so multi-step processes route to the right approver with a visible status at every stage.',
    acceptanceHints: [
      'A submitted item routes to the correct approver and its status is visible to the submitter.',
      'An approval or rejection is recorded with the approver identity and a timestamp.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'capability:admin',
    capabilityName: 'Administration and Configuration',
    module: PLATFORM_FOUNDATION,
    workstream: 'Platform Administration',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide administration and configuration tooling so operators can manage users, settings and reference data without engineering support.',
    acceptanceHints: [
      'An administrator can manage users, roles and reference data through the UI, not a database script.',
      'A configuration change takes effect without a code deployment.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'capability:mobile',
    capabilityName: 'Mobile Experience',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide a mobile experience so users can complete their core tasks from a phone or tablet.',
    acceptanceHints: [
      'The core tasks in scope are usable on the supported phone and tablet breakpoints.',
      'Mobile performance meets the same response-time targets as the desktop experience.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:portal',
    capabilityName: 'Self-Service Portal',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide a self-service portal that gives users a single place to manage their account, requests and records.',
    acceptanceHints: [
      'A user can complete their primary self-service task without contacting support.',
      'The portal reflects the current state of the underlying records without a stale cache.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:catalog',
    capabilityName: 'Catalog and Inventory Management',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide catalog and inventory management so users can browse, search and maintain the items the platform tracks.',
    acceptanceHints: [
      'A catalog item can be created, updated and retired without a database change.',
      'Stock or availability figures shown to users match the underlying inventory record.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:scheduling',
    capabilityName: 'Scheduling and Booking',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide scheduling and booking so users can reserve time slots, resources or appointments and manage changes to them.',
    acceptanceHints: [
      'A user can book, reschedule and cancel a slot without double-booking a resource.',
      'Booking changes trigger the corresponding notification to every affected party.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:messaging',
    capabilityName: 'Messaging and Collaboration',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide messaging and collaboration so users can communicate and share updates inside the platform instead of external channels.',
    acceptanceHints: [
      'A message sent inside the platform reaches its recipient without relying on a personal email account.',
      'A conversation thread retains its history for the parties involved.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:orders',
    capabilityName: 'Orders and Fulfilment',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide order and fulfilment management covering order capture, status tracking and completion.',
    acceptanceHints: [
      'An order can be placed, tracked through its fulfilment states and marked complete.',
      'Order status shown to the user matches the fulfilment system of record.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:content',
    capabilityName: 'Content Management',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide content management so editors can author, review and publish content without a code deployment.',
    acceptanceHints: [
      'A non-technical editor can create, review and publish a content item without engineering support.',
      'Published content renders correctly on every supported surface.',
    ],
    challengeType: 'Design challenge',
  },
  {
    signal: 'capability:forms',
    capabilityName: 'Forms and Data Capture',
    module: APPLICATION_EXPERIENCE,
    workstream: 'Core Product Experience',
    deliveryPackage: PACKAGE_1_FOUNDATION,
    scopeIntro: 'Provide forms and structured data capture so users can submit the information the process requires with built-in validation.',
    acceptanceHints: [
      'A form rejects incomplete or invalid submissions with a clear, field-level message.',
      'A submitted form is stored in a structured shape a downstream process can consume.',
    ],
    challengeType: 'Design challenge',
  },
];

/** integration:* signals - exchanges with named or pattern-described external systems (Package 2). */
const INTEGRATION_SIGNAL_ROWS: readonly CapabilityCatalogEntry[] = [
  {
    signal: 'integration:crm',
    capabilityName: 'CRM Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Integrate with the customer's CRM platform so account and contact records stay consistent between the two systems.",
    acceptanceHints: [
      'A record created or changed in either system is reflected in the other within the agreed latency.',
      'A CRM outage degrades gracefully instead of blocking the primary user flow.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:erp',
    capabilityName: 'ERP Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Integrate with the customer's ERP platform so financial and operational master data stays consistent between the two systems.",
    acceptanceHints: [
      'Financial or operational records posted from the platform reconcile with the ERP ledger.',
      'A rejected ERP transaction is surfaced back to the originating user.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:payment-gateway',
    capabilityName: 'Payment Gateway Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Integrate with a PCI-compliant payment gateway so card and payment data never needs to be stored by the platform itself.',
    acceptanceHints: [
      'Card data entered by a user reaches the gateway directly without transiting the application backend unencrypted.',
      'A gateway decline or timeout is handled without double-charging the user.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:identity-provider',
    capabilityName: 'Identity Provider Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Integrate with the customer's identity provider so users authenticate with their existing corporate or consumer credentials.",
    acceptanceHints: [
      'A user federates in through the configured identity provider without a separate platform password.',
      'A deprovisioned identity-provider account loses platform access on its next sign-in attempt.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:email-sms',
    capabilityName: 'Email and SMS Gateway Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Integrate with an email and SMS gateway so transactional and notification messages are delivered through an auditable provider.',
    acceptanceHints: [
      'A triggering event produces a delivered message with a provider delivery receipt on record.',
      'A bounced or undeliverable message is retried or flagged rather than silently dropped.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:legacy',
    capabilityName: 'Legacy System Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Integrate with the identified legacy or mainframe system so existing records remain authoritative where the reviewed scope requires it.',
    acceptanceHints: [
      "A read or write against the legacy system succeeds within that system's documented interface constraints.",
      'A legacy-system failure is contained and reported rather than corrupting platform data.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:ehr',
    capabilityName: 'Clinical System Integration (HL7/FHIR)',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Integrate with the clinical system over HL7/FHIR so patient and encounter data is exchanged in a standards-based, auditable format.',
    acceptanceHints: [
      'An HL7/FHIR message exchanged with the clinical system validates against the agreed profile.',
      'Every clinical-data exchange is logged for the audit trail the compliance requirement demands.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:data-warehouse',
    capabilityName: 'Data Warehouse and BI Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Integrate with the customer's data warehouse or BI platform so reporting draws from a single governed source instead of ad hoc extracts.",
    acceptanceHints: [
      'A scheduled extract lands in the warehouse on the agreed cadence with row counts reconciled.',
      'A schema change on either side is caught before it breaks the downstream reports.',
    ],
    challengeType: 'Development challenge series',
    broadSignal: true,
  },
  {
    signal: 'integration:hr',
    capabilityName: 'HR Platform Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Integrate with the customer's HR platform so employee and organisational data stays consistent between the two systems.",
    acceptanceHints: [
      'A new hire or role change in the HR platform is reflected in the platform without manual re-entry.',
      'A termination in the HR platform revokes the corresponding platform access.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:itsm',
    capabilityName: 'ITSM Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Integrate with the customer's ITSM platform so incidents and change records raised by the solution follow the customer's existing process.",
    acceptanceHints: [
      'An incident raised by the platform creates a corresponding ITSM ticket with the right severity.',
      'Ticket status changes in the ITSM platform are reflected back to the originating user.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:esign',
    capabilityName: 'E-Signature Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Integrate with an e-signature service so agreements generated by the solution can be signed and stored with a verifiable audit trail.',
    acceptanceHints: [
      'A generated agreement can be sent for signature and the signed copy is stored against the record it belongs to.',
      'The signature audit trail is retrievable for every executed agreement.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:maps',
    capabilityName: 'Maps and Geolocation Integration',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Integrate with a maps and geolocation provider so location-based features resolve addresses and distances reliably.',
    acceptanceHints: [
      'An entered address resolves to a valid geocoded location or a clear error.',
      'Distance or routing calculations match the values the mapping provider returns.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'integration:realtime',
    capabilityName: 'Real-Time Integration Platform',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Build a real-time, event-driven exchange so downstream systems receive updates as they happen rather than on a batch delay.',
    acceptanceHints: [
      'An event published by the platform reaches every subscriber within the agreed real-time latency budget.',
      'A dropped or duplicate event is detected rather than silently corrupting downstream state.',
    ],
    challengeType: 'Development challenge series',
    broadSignal: true,
  },
  {
    signal: 'integration:batch',
    capabilityName: 'Batch Integration Platform',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Build a scheduled batch exchange so large or non-urgent data sets are synchronised on a predictable, monitored cadence.',
    acceptanceHints: [
      'A scheduled batch run completes within its window and its row counts reconcile with the source.',
      'A failed batch run alerts the operations team instead of silently skipping that cycle.',
    ],
    challengeType: 'Development challenge series',
    broadSignal: true,
  },
  {
    signal: 'integration:file',
    capabilityName: 'File-Based Integration Platform',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Build a file-based exchange so data moves through the file formats and drop locations the counterpart system already expects.",
    acceptanceHints: [
      'A file dropped in the agreed location is picked up, validated and processed within the agreed window.',
      'A malformed file is quarantined with a reason instead of failing the whole batch silently.',
    ],
    challengeType: 'Development challenge series',
    broadSignal: true,
  },
  {
    signal: 'integration:api',
    capabilityName: 'API Integration Platform',
    module: SYSTEMS_INTEGRATION,
    workstream: 'Integration Layer',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Build an API-based exchange so counterpart systems can integrate through a documented, versioned interface.',
    acceptanceHints: [
      'The published API contract matches what the integrated system actually receives in production.',
      'A breaking API change follows the agreed versioning policy instead of breaking an existing consumer.',
    ],
    challengeType: 'Development challenge series',
    broadSignal: true,
  },
];

/** data:* signals - data domains, pipelines and quality controls (Package 2). */
const DATA_SIGNAL_ROWS: readonly CapabilityCatalogEntry[] = [
  {
    signal: 'data:migration',
    capabilityName: 'Data Migration',
    module: DATA_PLATFORM,
    workstream: 'Data Management',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Migrate existing records into the new platform with a validated mapping from each legacy field to its target.',
    acceptanceHints: [
      'A migration dry run reconciles record counts and key fields against the source system.',
      'Migration rejects or exceptions are reviewable rather than silently dropped.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'data:warehouse',
    capabilityName: 'Analytical Data Warehouse',
    module: DATA_PLATFORM,
    workstream: 'Analytics and Data Engineering',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Stand up an analytical data warehouse so historical and cross-domain data is queryable without touching production systems.',
    acceptanceHints: [
      'A cross-domain analytical query returns results without querying the production transactional database.',
      'Warehouse data is refreshed on the agreed schedule with a visible last-updated timestamp.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'data:etl',
    capabilityName: 'Data Pipelines and ETL',
    module: DATA_PLATFORM,
    workstream: 'Analytics and Data Engineering',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Build the data pipelines and ETL jobs that move and transform data between the platform's data domains.",
    acceptanceHints: [
      'A pipeline run is idempotent and can be safely re-run after a failure.',
      'Pipeline failures alert the owning team with enough context to diagnose the cause.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'data:streaming',
    capabilityName: 'Streaming Data Platform',
    module: DATA_PLATFORM,
    workstream: 'Analytics and Data Engineering',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Build a streaming data pipeline so time-sensitive events are processed and made available with low latency.',
    acceptanceHints: [
      'An event is available to downstream consumers within the agreed streaming latency budget.',
      'Consumer lag is monitored and alerts before it breaches the agreed threshold.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'data:pii',
    capabilityName: 'Personal Data Protection',
    module: DATA_PLATFORM,
    workstream: 'Data Management',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Classify and protect the personal or sensitive data the solution collects, with access limited to what each role needs.",
    acceptanceHints: [
      'Every data field holding personal data is classified and its access is restricted by role.',
      'A subject-access or deletion request can be fulfilled without a manual database query.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'data:documents',
    capabilityName: 'Document and Content Data Management',
    module: DATA_PLATFORM,
    workstream: 'Data Management',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Manage documents and unstructured content as first-class data, indexed so it can be searched, retrieved and governed.',
    acceptanceHints: [
      'A stored document is retrievable by its metadata without a full-text scan of every file.',
      'Document storage enforces the same access controls as the record it belongs to.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'data:retention',
    capabilityName: 'Data Retention and Archival',
    module: DATA_PLATFORM,
    workstream: 'Data Management',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Apply retention and archival rules so data is kept only as long as policy and regulation require.',
    acceptanceHints: [
      'Data past its retention period is archived or purged on the configured schedule.',
      'An archival or purge run produces an auditable record of what was removed and when.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'data:master-data',
    capabilityName: 'Master and Reference Data Management',
    module: DATA_PLATFORM,
    workstream: 'Data Management',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Establish master and reference data ownership so every system reads the same authoritative version of shared entities.',
    acceptanceHints: [
      'Every consuming system reads the same value for a shared master-data attribute.',
      'A master-data change propagates to every subscriber without manual synchronisation.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'data:reporting',
    capabilityName: 'Reporting Data Marts',
    module: DATA_PLATFORM,
    workstream: 'Analytics and Data Engineering',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: "Build the reporting data marts that power the dashboards stakeholders rely on.",
    acceptanceHints: [
      'A report built on the data mart reconciles with the transactional source for a sample period.',
      'The data mart refreshes before stakeholders need the report each cycle.',
    ],
    challengeType: 'Data science challenge',
    broadSignal: true,
  },
  {
    signal: 'data:telemetry',
    capabilityName: 'IoT and Telemetry Data Platform',
    module: DATA_PLATFORM,
    workstream: 'Data Management',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Ingest IoT and telemetry data from connected devices into a structure the platform can query and alert on.',
    acceptanceHints: [
      'Telemetry from a connected device is ingested and queryable within the agreed latency.',
      'A device that stops reporting is flagged rather than silently going quiet.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'data:quality',
    capabilityName: 'Data Quality and Reconciliation',
    module: DATA_PLATFORM,
    workstream: 'Analytics and Data Engineering',
    deliveryPackage: PACKAGE_2_DATA_INTEGRATION,
    scopeIntro: 'Implement data-quality checks and reconciliation so discrepancies between systems are caught before they reach reporting.',
    acceptanceHints: [
      'A scheduled reconciliation run reports discrepancies between the source and target systems.',
      'A data-quality rule failure blocks the affected record from reaching downstream reporting.',
    ],
    challengeType: 'Data science challenge',
  },
];

/** ai:* signals - AI use cases (Package 3). ai:assistant and ai:rag share one capability because a RAG-grounded assistant is a single deliverable. */
const AI_SIGNAL_ROWS: readonly CapabilityCatalogEntry[] = [
  {
    signal: 'ai:assistant',
    capabilityName: 'AI Conversational Assistant',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: "Deliver a conversational AI assistant that answers user questions in natural language, grounded in the platform's own content.",
    acceptanceHints: [
      "A representative sample of user questions is answered correctly and grounded in the platform's source content.",
      'A question the assistant cannot answer confidently is declined rather than answered with an invented fact.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:rag',
    capabilityName: 'AI Conversational Assistant',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: "Deliver a conversational AI assistant that answers user questions in natural language, grounded in the platform's own content.",
    acceptanceHints: [
      "A representative sample of user questions is answered correctly and grounded in the platform's source content.",
      'A question the assistant cannot answer confidently is declined rather than answered with an invented fact.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:classification',
    capabilityName: 'AI Classification and Routing',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: 'Deliver AI-based classification and routing so incoming items are categorised and sent to the right queue automatically.',
    acceptanceHints: [
      'A labelled evaluation set is classified at or above the agreed accuracy target.',
      'A low-confidence classification is routed to a human reviewer instead of an automatic decision.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:extraction',
    capabilityName: 'AI Document Extraction',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: 'Deliver AI-based document extraction so structured data is pulled from unstructured documents without manual re-keying.',
    acceptanceHints: [
      'Fields extracted from a representative document sample match manual extraction at the agreed accuracy target.',
      'A low-confidence extraction is flagged for human verification before it is used downstream.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:recommendation',
    capabilityName: 'AI Recommendations Engine',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: 'Deliver AI-based recommendations so users are shown the next-best option based on their context and history.',
    acceptanceHints: [
      'Recommendation relevance is measurable against a baseline through an agreed offline or online metric.',
      'A user without sufficient history still receives a sensible default recommendation.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:forecasting',
    capabilityName: 'AI Forecasting and Prediction',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: 'Deliver AI-based forecasting so planning decisions are informed by a predictive model rather than manual trend-spotting.',
    acceptanceHints: [
      'The forecast error against held-out historical data is within the agreed tolerance.',
      'A forecast is accompanied by a confidence range rather than presented as a single certain figure.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:summarization',
    capabilityName: 'AI Summarization',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: 'Deliver AI-based summarisation so long documents or threads are condensed into a reviewable summary.',
    acceptanceHints: [
      'A generated summary is reviewed against the source document and preserves every material fact.',
      'The summary clearly labels itself as AI-generated wherever it is surfaced to a user.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:anomaly',
    capabilityName: 'AI Anomaly and Fraud Detection',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: 'Deliver AI-based anomaly and fraud detection so unusual activity is flagged for review as it happens.',
    acceptanceHints: [
      'A seeded anomalous or fraudulent case in the evaluation set is flagged for review.',
      'The false-positive rate on normal activity stays within the agreed operational tolerance.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:generation',
    capabilityName: 'AI Content Generation',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: 'Deliver AI-based content generation so drafts of routine content are produced for a human to review and approve.',
    acceptanceHints: [
      'Every AI-generated draft is routed through a human approval step before publication.',
      'Generated content is labelled as AI-assisted wherever it reaches an end user.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:vision',
    capabilityName: 'AI Computer Vision',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: 'Deliver AI-based computer vision so images or video submitted to the platform are automatically interpreted.',
    acceptanceHints: [
      'A representative image or video sample is interpreted at or above the agreed accuracy target.',
      'A low-confidence result is routed to a human reviewer rather than acted on automatically.',
    ],
    challengeType: 'Data science challenge',
  },
  {
    signal: 'ai:speech',
    capabilityName: 'AI Speech and Voice Interface',
    module: AI_CAPABILITIES,
    workstream: 'AI and Machine Learning',
    deliveryPackage: PACKAGE_3_AI_CAPABILITIES,
    scopeIntro: 'Deliver AI-based speech and voice interaction so users can complete tasks by talking instead of typing.',
    acceptanceHints: [
      'A representative sample of spoken requests is transcribed and actioned correctly.',
      'The voice interface degrades to a text fallback when recognition confidence is low.',
    ],
    challengeType: 'Data science challenge',
  },
];

/** security:* signals - security and compliance controls (Package 4). */
const SECURITY_SIGNAL_ROWS: readonly CapabilityCatalogEntry[] = [
  {
    signal: 'security:sso',
    capabilityName: 'Single Sign-On',
    module: SECURITY_AND_COMPLIANCE,
    workstream: 'Security Controls',
    deliveryPackage: PACKAGE_4_SECURITY_COMPLIANCE,
    scopeIntro: "Implement single sign-on so users authenticate once against the agreed identity provider across the whole solution.",
    acceptanceHints: [
      'A user signs in once and reaches every in-scope application without re-authenticating.',
      'A session is revoked at the identity provider takes effect on the platform within the agreed window.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'security:mfa',
    capabilityName: 'Multi-Factor Authentication',
    module: SECURITY_AND_COMPLIANCE,
    workstream: 'Security Controls',
    deliveryPackage: PACKAGE_4_SECURITY_COMPLIANCE,
    scopeIntro: 'Implement multi-factor authentication so a compromised password alone cannot grant access to the platform.',
    acceptanceHints: [
      'Sign-in requires a second factor for every account in the roles the reviewed scope designates.',
      'A user can recover access through a documented, auditable process when they lose their second factor.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'security:rbac',
    capabilityName: 'Role-Based Access Control',
    module: SECURITY_AND_COMPLIANCE,
    workstream: 'Security Controls',
    deliveryPackage: PACKAGE_4_SECURITY_COMPLIANCE,
    scopeIntro: "Implement role-based access control so each user's permissions match their responsibilities and nothing more.",
    acceptanceHints: [
      'A user assigned a role can perform only the actions that role is permitted.',
      'A permission change made through role administration takes effect without a redeploy.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'security:encryption',
    capabilityName: 'Data Encryption',
    module: SECURITY_AND_COMPLIANCE,
    workstream: 'Security Controls',
    deliveryPackage: PACKAGE_4_SECURITY_COMPLIANCE,
    scopeIntro: 'Implement encryption at rest and in transit for the data classes the reviewed scope identifies as sensitive.',
    acceptanceHints: [
      'Sensitive data at rest is encrypted and the encryption keys are managed outside the application code.',
      'Every network path carrying sensitive data uses TLS with no plaintext fallback.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'security:audit',
    capabilityName: 'Audit Logging and Compliance Monitoring',
    module: SECURITY_AND_COMPLIANCE,
    workstream: 'Security Controls',
    deliveryPackage: PACKAGE_4_SECURITY_COMPLIANCE,
    scopeIntro: 'Implement audit logging so every access to sensitive data or privileged action can be reconstructed after the fact.',
    acceptanceHints: [
      'A privileged action is recorded with who performed it, when, and against which record.',
      'Audit records are tamper-evident and retained for the period compliance requires.',
    ],
    challengeType: 'Development challenge series',
    broadSignal: true,
  },
  {
    signal: 'security:secrets',
    capabilityName: 'Secrets and Credential Management',
    module: SECURITY_AND_COMPLIANCE,
    workstream: 'Security Controls',
    deliveryPackage: PACKAGE_4_SECURITY_COMPLIANCE,
    scopeIntro: 'Implement secrets and credential management so API keys and service credentials are never stored in code or configuration files.',
    acceptanceHints: [
      'A secrets scan of the codebase and configuration finds no hard-coded credential.',
      'A leaked credential can be rotated without a code change or redeploy.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'security:network',
    capabilityName: 'Network Protection',
    module: SECURITY_AND_COMPLIANCE,
    workstream: 'Security Controls',
    deliveryPackage: PACKAGE_4_SECURITY_COMPLIANCE,
    scopeIntro: "Implement network protection controls so the platform's attack surface is limited to what the solution actually needs to expose.",
    acceptanceHints: [
      'Only the ports and services the solution needs are reachable from outside the network boundary.',
      'A network-layer scan of the deployed environment finds no unintended public exposure.',
    ],
    challengeType: 'Development challenge series',
  },
  {
    signal: 'security:data-residency',
    capabilityName: 'Data Residency Controls',
    module: SECURITY_AND_COMPLIANCE,
    workstream: 'Security Controls',
    deliveryPackage: PACKAGE_4_SECURITY_COMPLIANCE,
    scopeIntro: "Implement data residency controls so regulated data stays in the regions the customer's compliance obligations require.",
    acceptanceHints: [
      'Regulated data is stored and processed only in the approved regions.',
      'A cross-region data transfer, if any occurs, is logged and justified against the compliance requirement.',
    ],
    challengeType: 'Development challenge series',
  },
];

/** The complete signal -> capability table (one row per capability/integration/data/ai/security signal). */
export const CAPABILITY_CATALOG: readonly CapabilityCatalogEntry[] = [
  ...CAPABILITY_SIGNAL_ROWS,
  ...INTEGRATION_SIGNAL_ROWS,
  ...DATA_SIGNAL_ROWS,
  ...AI_SIGNAL_ROWS,
  ...SECURITY_SIGNAL_ROWS,
];

/** Fallback capability for a requirement whose signals match no row above, so nothing is silently dropped. */
export const CORE_PLATFORM_CAPABILITY: CapabilityCatalogEntry = {
  signal: 'core-platform',
  capabilityName: 'Core Platform Services',
  module: PLATFORM_FOUNDATION,
  workstream: 'Core Platform Services',
  deliveryPackage: PACKAGE_1_FOUNDATION,
  scopeIntro:
    'Provide the cross-cutting platform services - configuration, environment setup, logging and shared infrastructure - that every capability in this scope depends on.',
  acceptanceHints: [
    'The shared platform services are available before any dependent capability is demonstrated.',
    'A requirement placed here is revisited once its signals are refined so it can move to a named capability.',
  ],
  challengeType: 'Development challenge series',
};

const CATALOG_BY_SIGNAL: ReadonlyMap<string, CapabilityCatalogEntry> = new Map(CAPABILITY_CATALOG.map((entry) => [entry.signal, entry]));

const CATALOG_BY_NAME: ReadonlyMap<string, CapabilityCatalogEntry> = new Map(
  [...CAPABILITY_CATALOG, CORE_PLATFORM_CAPABILITY].map((entry) => [entry.capabilityName, entry]),
);

/** Looks up the catalog row for a signal id (e.g. 'integration:crm'), if any. */
export function findCatalogEntry(signal: string): CapabilityCatalogEntry | undefined {
  return CATALOG_BY_SIGNAL.get(signal);
}

/** Looks up the catalog row by the capability name it produces (used to resolve a challenge type for an already-built capability). */
export function findCatalogEntryByName(capabilityName: string): CapabilityCatalogEntry | undefined {
  return CATALOG_BY_NAME.get(capabilityName);
}
