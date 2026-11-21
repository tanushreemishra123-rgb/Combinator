/**
 * Shared signal vocabulary. Signals are deterministic taxonomy tags ('group:name') attached to
 * scope items by the analysis stage; the PRD, architecture, strategy and estimation planners key
 * off them, which is what keeps every deliverable connected to the same reviewed scope model.
 */
export type SignalGroup =
  | 'capability'
  | 'integration'
  | 'data'
  | 'ai'
  | 'nfr'
  | 'security'
  | 'compliance'
  | 'cloud'
  | 'delivery';

export interface SignalDefinition {
  /** Fully qualified id, e.g. 'integration:crm'. */
  id: string;
  group: SignalGroup;
  label: string;
}

export const SIGNAL_DEFINITIONS: readonly SignalDefinition[] = [
  { id: 'capability:identity', group: 'capability', label: 'Registration, sign-in and profile' },
  { id: 'capability:search', group: 'capability', label: 'Search and discovery' },
  { id: 'capability:documents', group: 'capability', label: 'Document management' },
  { id: 'capability:payments', group: 'capability', label: 'Payments and billing' },
  { id: 'capability:notifications', group: 'capability', label: 'Notifications and alerts' },
  { id: 'capability:reporting', group: 'capability', label: 'Dashboards and reporting' },
  { id: 'capability:workflow', group: 'capability', label: 'Workflow and approvals' },
  { id: 'capability:admin', group: 'capability', label: 'Administration and configuration' },
  { id: 'capability:mobile', group: 'capability', label: 'Mobile experience' },
  { id: 'capability:portal', group: 'capability', label: 'Self-service portal' },
  { id: 'capability:catalog', group: 'capability', label: 'Catalog and inventory' },
  { id: 'capability:scheduling', group: 'capability', label: 'Scheduling and booking' },
  { id: 'capability:messaging', group: 'capability', label: 'Messaging and collaboration' },
  { id: 'capability:orders', group: 'capability', label: 'Orders and fulfilment' },
  { id: 'capability:content', group: 'capability', label: 'Content management' },
  { id: 'capability:forms', group: 'capability', label: 'Forms and data capture' },
  { id: 'integration:crm', group: 'integration', label: 'CRM platform' },
  { id: 'integration:erp', group: 'integration', label: 'ERP platform' },
  { id: 'integration:payment-gateway', group: 'integration', label: 'Payment gateway' },
  { id: 'integration:identity-provider', group: 'integration', label: 'Identity provider' },
  { id: 'integration:email-sms', group: 'integration', label: 'Email and SMS gateway' },
  { id: 'integration:legacy', group: 'integration', label: 'Legacy or mainframe system' },
  { id: 'integration:ehr', group: 'integration', label: 'Clinical system (HL7/FHIR)' },
  { id: 'integration:data-warehouse', group: 'integration', label: 'Data warehouse or BI platform' },
  { id: 'integration:hr', group: 'integration', label: 'HR platform' },
  { id: 'integration:itsm', group: 'integration', label: 'ITSM platform' },
  { id: 'integration:esign', group: 'integration', label: 'E-signature service' },
  { id: 'integration:maps', group: 'integration', label: 'Maps and geolocation' },
  { id: 'integration:realtime', group: 'integration', label: 'Real-time or event-driven exchange' },
  { id: 'integration:batch', group: 'integration', label: 'Batch exchange' },
  { id: 'integration:file', group: 'integration', label: 'File-based exchange' },
  { id: 'integration:api', group: 'integration', label: 'API-based exchange' },
  { id: 'data:migration', group: 'data', label: 'Data migration' },
  { id: 'data:warehouse', group: 'data', label: 'Analytical warehouse' },
  { id: 'data:etl', group: 'data', label: 'ETL and data pipelines' },
  { id: 'data:streaming', group: 'data', label: 'Streaming data' },
  { id: 'data:pii', group: 'data', label: 'Personal or sensitive data' },
  { id: 'data:documents', group: 'data', label: 'Documents and unstructured content' },
  { id: 'data:retention', group: 'data', label: 'Retention and archival' },
  { id: 'data:master-data', group: 'data', label: 'Master and reference data' },
  { id: 'data:reporting', group: 'data', label: 'Reporting data marts' },
  { id: 'data:telemetry', group: 'data', label: 'IoT and telemetry data' },
  { id: 'data:quality', group: 'data', label: 'Data quality and reconciliation' },
  { id: 'ai:assistant', group: 'ai', label: 'Conversational assistant' },
  { id: 'ai:rag', group: 'ai', label: 'Retrieval-augmented question answering' },
  { id: 'ai:classification', group: 'ai', label: 'Classification and routing' },
  { id: 'ai:extraction', group: 'ai', label: 'Document extraction' },
  { id: 'ai:recommendation', group: 'ai', label: 'Recommendations' },
  { id: 'ai:forecasting', group: 'ai', label: 'Forecasting and prediction' },
  { id: 'ai:summarization', group: 'ai', label: 'Summarisation' },
  { id: 'ai:anomaly', group: 'ai', label: 'Anomaly and fraud detection' },
  { id: 'ai:generation', group: 'ai', label: 'Content generation' },
  { id: 'ai:vision', group: 'ai', label: 'Computer vision' },
  { id: 'ai:speech', group: 'ai', label: 'Speech and voice' },
  { id: 'nfr:availability', group: 'nfr', label: 'Availability' },
  { id: 'nfr:performance', group: 'nfr', label: 'Performance' },
  { id: 'nfr:scalability', group: 'nfr', label: 'Scalability' },
  { id: 'nfr:accessibility', group: 'nfr', label: 'Accessibility' },
  { id: 'nfr:localization', group: 'nfr', label: 'Localisation' },
  { id: 'nfr:observability', group: 'nfr', label: 'Observability' },
  { id: 'nfr:usability', group: 'nfr', label: 'Usability' },
  { id: 'nfr:maintainability', group: 'nfr', label: 'Maintainability' },
  { id: 'nfr:offline', group: 'nfr', label: 'Offline support' },
  { id: 'security:sso', group: 'security', label: 'Single sign-on' },
  { id: 'security:mfa', group: 'security', label: 'Multi-factor authentication' },
  { id: 'security:rbac', group: 'security', label: 'Role-based access control' },
  { id: 'security:encryption', group: 'security', label: 'Encryption' },
  { id: 'security:audit', group: 'security', label: 'Audit logging' },
  { id: 'security:secrets', group: 'security', label: 'Secrets management' },
  { id: 'security:network', group: 'security', label: 'Network protection' },
  { id: 'security:data-residency', group: 'security', label: 'Data residency' },
  { id: 'compliance:gdpr', group: 'compliance', label: 'GDPR' },
  { id: 'compliance:hipaa', group: 'compliance', label: 'HIPAA' },
  { id: 'compliance:pci', group: 'compliance', label: 'PCI DSS' },
  { id: 'compliance:soc2', group: 'compliance', label: 'SOC 2' },
  { id: 'compliance:iso27001', group: 'compliance', label: 'ISO 27001' },
  { id: 'compliance:sox', group: 'compliance', label: 'SOX' },
  { id: 'compliance:fedramp', group: 'compliance', label: 'FedRAMP' },
  { id: 'cloud:aws', group: 'cloud', label: 'Amazon Web Services' },
  { id: 'cloud:azure', group: 'cloud', label: 'Microsoft Azure' },
  { id: 'cloud:gcp', group: 'cloud', label: 'Google Cloud Platform' },
  { id: 'cloud:hybrid', group: 'cloud', label: 'Hybrid or on-premises' },
  { id: 'delivery:deadline', group: 'delivery', label: 'Fixed deadline' },
  { id: 'delivery:budget', group: 'delivery', label: 'Budget constraint' },
  { id: 'delivery:phased', group: 'delivery', label: 'Phased rollout' },
  { id: 'delivery:team', group: 'delivery', label: 'Customer team involvement' },
];

const SIGNAL_LABELS: ReadonlyMap<string, string> = new Map(SIGNAL_DEFINITIONS.map((signal) => [signal.id, signal.label]));

export function signalLabel(id: string): string {
  return SIGNAL_LABELS.get(id) ?? id;
}

export function isKnownSignal(id: string): boolean {
  return SIGNAL_LABELS.has(id);
}

/** True when any item signal belongs to the given group (e.g. any 'ai:*' signal). */
export function hasSignalInGroup(signals: readonly string[], group: SignalGroup): boolean {
  return signals.some((signal) => signal.startsWith(`${group}:`));
}
