/**
 * Lookup tables the integration builder (integrations.ts) reads instead of branching per pattern or
 * per system: pattern -> protocol/authentication defaults, plus the word lists that let the builder
 * read the customer's own text (protocol names, retirement/manual-process/parallel-run/later-phase
 * language, known identity-provider product names) rather than asserting a fixed, per-signal
 * technical detail the customer never stated.
 */
import type { ArchitectureArea, ArchitectureComponent, IntegrationSpec } from '../domain';
import { findComponents, serviceNames } from './componentLookup';

export type IntegrationPattern = IntegrationSpec['pattern'];

/** integration:* signal id -> the pattern it implies, matched before falling back to 'api'. */
const SIGNAL_TO_PATTERN: ReadonlyMap<string, IntegrationPattern> = new Map([
  ['integration:realtime', 'event'],
  ['integration:batch', 'batch'],
  ['integration:file', 'file'],
  ['integration:api', 'api'],
]);

export function explicitPatternFromSignals(signals: readonly string[]): IntegrationPattern | undefined {
  for (const signal of signals) {
    const pattern = SIGNAL_TO_PATTERN.get(signal);
    if (pattern !== undefined) {
      return pattern;
    }
  }
  return undefined;
}

/** Catalog default protocol/authentication used only once the customer's own text names none. */
const PATTERN_PROTOCOL: ReadonlyMap<IntegrationPattern, string> = new Map([
  ['api', 'REST/JSON over HTTPS'],
  ['event', 'Event stream (publish/subscribe) carrying JSON payloads'],
  ['batch', 'Scheduled batch extract (CSV/JSON) delivered to cloud storage or SFTP'],
  ['file', 'File exchange (SFTP or managed file transfer) with fixed-format or CSV payloads'],
]);

const PATTERN_AUTHENTICATION: ReadonlyMap<IntegrationPattern, string> = new Map([
  ['api', 'OAuth 2.0 client credentials grant'],
  ['event', 'OAuth 2.0 client credentials grant on the event broker connection'],
  ['batch', "SFTP key-based authentication (SSH key pair, rotated per the customer's key-management policy)"],
  ['file', "SFTP key-based authentication (SSH key pair, rotated per the customer's key-management policy)"],
]);

/** Signal id -> authentication default for a system class a plain pattern lookup would get wrong. */
const SIGNAL_AUTH_OVERRIDE: ReadonlyMap<string, string> = new Map([
  ['integration:ehr', 'Mutual TLS (mTLS) certificate authentication'],
  ['integration:legacy', 'Mutual TLS (mTLS) certificate authentication'],
]);

function overrideFor(table: ReadonlyMap<string, string>, signals: readonly string[]): string | undefined {
  for (const signal of signals) {
    const value = table.get(signal);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/** Catalog-default protocol for the resolved pattern; the customer's own text is always checked first (see `protocolTokensIn`). */
export function catalogProtocolFor(pattern: IntegrationPattern): string {
  return PATTERN_PROTOCOL.get(pattern) ?? PATTERN_PROTOCOL.get('api') ?? 'REST/JSON over HTTPS';
}

export function authenticationFor(pattern: IntegrationPattern, signals: readonly string[]): string {
  return overrideFor(SIGNAL_AUTH_OVERRIDE, signals) ?? PATTERN_AUTHENTICATION.get(pattern) ?? 'OAuth 2.0 client credentials grant';
}

/** Architecture area expected to hold the component that implements each pattern. */
export const PATTERN_COMPONENT_AREA: ReadonlyMap<IntegrationPattern, ArchitectureArea> = new Map([
  ['api', 'api'],
  ['event', 'messaging'],
  ['batch', 'integration'],
  ['file', 'integration'],
]);

export const NOTIFICATION_SIGNALS: ReadonlySet<string> = new Set(['integration:email-sms']);
const HIGH_RISK_SIGNALS: ReadonlySet<string> = new Set(['integration:legacy', 'integration:ehr', 'integration:erp']);

/**
 * Integration complexity: legacy/ERP/clinical systems and integrations with no confirmed mechanism
 * default to High; batch/file exchanges and simple notification gateways sit at Low/Medium; a
 * confirmed standard API integration is Medium.
 */
export function complexityFor(signals: readonly string[], explicit: boolean): IntegrationSpec['complexity'] {
  if (signals.some((signal) => HIGH_RISK_SIGNALS.has(signal))) {
    return 'High';
  }
  if (!explicit) {
    // No integration:realtime/batch/file/api signal at all: the exchange mechanism is unconfirmed.
    return 'High';
  }
  if (signals.some((signal) => NOTIFICATION_SIGNALS.has(signal))) {
    return 'Low';
  }
  // Confirmed batch/file exchange or standard SaaS API/event integration: routine build effort.
  return 'Medium';
}

/** Systems that are the customer's own even when the requirement doesn't say so explicitly. */
export const CUSTOMER_OWNED_SIGNALS: ReadonlySet<string> = new Set([
  'integration:crm',
  'integration:erp',
  'integration:hr',
  'integration:itsm',
  'integration:legacy',
  'integration:ehr',
  'integration:data-warehouse',
]);

function includesAny(text: string, words: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

/** True when any of `texts` contains one of `words` (case-insensitive substring match, no dynamic regex). */
export function textMentions(texts: readonly string[], words: readonly string[]): boolean {
  return texts.some((text) => includesAny(text, words));
}

const RETIREMENT_WORDS = ['replaced by', 'being replaced', 'retiring', 'to be retired', 'retire', 'decommission', 'eliminat', 'sunset', 'phased out', 'phase out'];
const MANUAL_PROCESS_WORDS = ['manual', 'spreadsheet', 'paper-based', 'paper based', 'shared network drive'];
const CUTOVER_WORDS = ['parallel run', 'parallel-run', 'stabilisation period', 'stabilization period', 'cutover', 'transition period'];
const LATER_PHASE_WORDS = ['later phase', 'not required for go-live', 'not required for go live', 'phase 2', 'deferred to a later', 'future phase', 'out of scope for the current phase', 'out of scope for this phase'];
const IDENTITY_WORDS = ['authenticat', 'single sign-on', ' sso', 'federat', 'identity provider'];

export function isRetirementText(texts: readonly string[]): boolean {
  return textMentions(texts, RETIREMENT_WORDS);
}

export function isManualProcessText(texts: readonly string[]): boolean {
  return textMentions(texts, MANUAL_PROCESS_WORDS);
}

export function isCutoverText(texts: readonly string[]): boolean {
  return textMentions(texts, CUTOVER_WORDS);
}

export function isLaterPhaseText(texts: readonly string[]): boolean {
  return textMentions(texts, LATER_PHASE_WORDS);
}

export function isIdentityText(texts: readonly string[]): boolean {
  return textMentions(texts, IDENTITY_WORDS);
}

/** Cues in a system's own name that mark it as a third-party vendor, carrier network or partner exchange - so a reviewed "existing system" is not assumed internal only because the customer already named it in their systems inventory. */
const SAAS_PARTNER_WORDS = ['carrier', 'exchange', 'five9', 'twilio', 'salesforce', 'partner', 'vendor', 'hie'];

export function isSaasOrPartnerText(texts: readonly string[]): boolean {
  return textMentions(texts, SAAS_PARTNER_WORDS);
}

/** Common identity-provider product names: matched against the customer's own text so the real vendor is named, never the requirement title. */
const KNOWN_IDENTITY_PROVIDERS: readonly string[] = [
  'Okta',
  'Azure Active Directory',
  'Microsoft Entra ID',
  'Entra ID',
  'Auth0',
  'Ping Identity',
  'OneLogin',
  'Google Workspace',
  'AWS Cognito',
  'ADFS',
];

/** Finds a named third-party identity-provider product in the customer's own text, so 'Okta' is never lost behind a generic requirement title. */
export function knownIdentityProviderIn(texts: readonly string[]): string | undefined {
  const combined = texts.join(' ').toLowerCase();
  return KNOWN_IDENTITY_PROVIDERS.find((name) => combined.includes(name.toLowerCase()));
}

/** Widely used third-party platforms: when the customer's text names one, that product is the integrated system - not the requirement title. */
const KNOWN_PLATFORMS: readonly string[] = [
  'Twilio', 'SendGrid', 'Mailchimp', 'Stripe', 'PayPal', 'Adyen', 'DocuSign', 'Salesforce', 'HubSpot', 'Microsoft Dynamics', 'ServiceNow', 'Zendesk',
  'Workday', 'NetSuite', 'QuickBooks', 'Five9', 'Genesys', 'Snowflake', 'Looker', 'Power BI', 'Tableau', 'SharePoint', 'Slack', 'Microsoft Teams',
];

/** Finds a named third-party platform in the customer's own text (first match in the order the text is scanned against the list). */
export function knownPlatformIn(texts: readonly string[]): string | undefined {
  const combined = texts.join(' ').toLowerCase();
  return KNOWN_PLATFORMS.find((name) => combined.includes(name.toLowerCase()));
}

/** Suffix phrases stripped from a requirement title when no named system is available (longest first, so a specific suffix wins over a shorter one it contains). */
const TITLE_SUFFIXES: readonly string[] = [
  ' authentication reuse',
  ' channel integration',
  ' authentication',
  ' connectivity',
  ' federation',
  ' integration',
];

/** Best-effort system label from a requirement title alone (no named existing system and no known vendor in the text): strips generic integration wording rather than repeating the whole requirement title as the "system". */
export function systemNameFromTitle(title: string): string {
  const lower = title.toLowerCase();
  const suffix = TITLE_SUFFIXES.find((candidate) => lower.endsWith(candidate));
  const base = suffix === undefined ? title : title.slice(0, title.length - suffix.length);
  const words = base
    .split('-')
    .join(' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return title;
  }
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/** Named protocol tokens the customer's own text may state, most specific first so e.g. 'FHIR R4' wins over the generic 'FHIR'. */
const PROTOCOL_TOKENS: ReadonlyArray<readonly [string, string]> = [
  ['fhir r4', 'FHIR R4'],
  ['fhir', 'FHIR'],
  ['hl7 v2', 'HL7 v2'],
  ['hl7', 'HL7'],
  ['idoc', 'IDoc'],
  ['bapi', 'BAPI'],
  ['soap', 'SOAP/XML'],
  ['edi', 'EDI'],
  ['sftp', 'SFTP'],
  ['webhook', 'webhook'],
  ['pub/sub', 'Pub/Sub'],
  ['change data capture', 'CDC'],
  ['cdc', 'CDC'],
  ['jdbc', 'JDBC'],
  ['rest', 'REST'],
];

/** Drops a generic token once its more specific sibling is already present (e.g. 'FHIR' once 'FHIR R4' matched). */
function dedupeGenericTokens(tokens: readonly string[]): string[] {
  const drop = new Set<string>();
  if (tokens.includes('FHIR R4')) {
    drop.add('FHIR');
  }
  if (tokens.includes('HL7 v2')) {
    drop.add('HL7');
  }
  return tokens.filter((token) => !drop.has(token));
}

/** Named protocols mentioned across the given texts, in catalog order, de-duplicated and generic-filtered. */
export function protocolTokensIn(texts: readonly string[]): string[] {
  const combined = texts.join(' ').toLowerCase();
  const found: string[] = [];
  for (const [keyword, label] of PROTOCOL_TOKENS) {
    if (combined.includes(keyword) && !found.includes(label)) {
      found.push(label);
    }
  }
  return dedupeGenericTokens(found);
}

/** Natural-language phrase for a matched protocol token, used to render the `protocol` field. */
const PROTOCOL_PHRASE: ReadonlyMap<string, string> = new Map([
  ['FHIR R4', 'FHIR R4 REST APIs'],
  ['FHIR', 'FHIR REST APIs'],
  ['HL7 v2', 'HL7 v2 messaging'],
  ['HL7', 'HL7 messaging'],
  ['IDoc', 'SAP IDoc batch extracts'],
  ['BAPI', 'SAP BAPI calls'],
  ['SOAP/XML', 'SOAP/XML web services'],
  ['EDI', 'EDI file exchange'],
  ['SFTP', 'SFTP file transfer'],
  ['webhook', 'webhook callbacks'],
  ['Pub/Sub', 'Pub/Sub messaging'],
  ['CDC', 'change-data-capture (CDC) streaming'],
  ['JDBC', 'JDBC connectivity'],
  ['REST', 'REST/JSON over HTTPS'],
]);

export function protocolPhraseFor(token: string): string {
  return PROTOCOL_PHRASE.get(token) ?? token;
}

/**
 * `IntegrationSpec` (src/domain/strategy.ts) is fixed and carries no explicit "category" field, so
 * the flow/diagram builders read the same fixed wording integrations.ts itself generates for an
 * authentication or notification interface, instead of re-deriving it from the scope model a second
 * time (which `buildDataFlowDiagram` cannot do - its signature is fixed to `(plan, design)`).
 */
export function isIdentityInterface(protocol: string): boolean {
  return protocol.startsWith('OIDC/SAML federation');
}

export function isNotificationInterface(dataSync: string): boolean {
  return dataSync.includes('is a one-way delivery channel');
}

/** The kind of exchange a row describes, so error-handling/retry/monitoring/dataSync text is never one template reused for every row. */
export type FlowCategory = 'authentication' | 'notification' | 'event' | 'batch-file' | 'sync-inbound' | 'sync-outbound' | 'sync-bidirectional';

export function categoryFor(pattern: IntegrationPattern, direction: IntegrationSpec['direction'], identity: boolean, notification: boolean): FlowCategory {
  if (identity) {
    return 'authentication';
  }
  if (notification) {
    return 'notification';
  }
  if (pattern === 'event') {
    return 'event';
  }
  if (pattern === 'batch' || pattern === 'file') {
    return 'batch-file';
  }
  if (direction === 'inbound') {
    return 'sync-inbound';
  }
  if (direction === 'outbound') {
    return 'sync-outbound';
  }
  return 'sync-bidirectional';
}

export function errorHandlingFor(category: FlowCategory, system: string): string {
  switch (category) {
    case 'authentication':
      return `A federation failure or expired token sends the user back to sign in again rather than granting access; an outage at ${system} is surfaced as a sign-in error, never a silent retry.`;
    case 'notification':
      return `A notification to ${system} that fails is logged and dropped after its retry budget rather than blocking the workflow that triggered it, since a missed message must never hold up processing.`;
    case 'batch-file':
      return `A run against ${system} that fails partway is not partially applied: the whole extract is re-processed from the last confirmed checkpoint on the next attempt, and a run that keeps failing is quarantined for manual review.`;
    case 'event':
      return `Every event published to ${system} carries an idempotency key so a redelivered or duplicated event is never applied twice, and an event that cannot be processed is moved to a dead-letter queue rather than blocking the stream.`;
    case 'sync-inbound':
      return `An inbound call from ${system} that fails validation is rejected synchronously with a clear error instead of partially accepted, so ${system} always knows whether its data landed.`;
    case 'sync-outbound':
      return `A call to ${system} that fails is retried before the record it carries is considered sent, and a call that keeps failing is queued for manual reconciliation rather than reported as delivered.`;
    default:
      return `Every call to ${system} carries an idempotency key so a retried or duplicated request is never applied twice, and a failure that exhausts its retry budget is written to a dead-letter queue rather than left half-committed.`;
  }
}

export function retryFor(category: FlowCategory, system: string): string {
  switch (category) {
    case 'authentication':
      return `A failed sign-in is retried by the user through a fresh redirect to ${system}; the platform itself never automatically retries a failed authentication.`;
    case 'notification':
      return `A notification to ${system} is retried up to 3 times on a short backoff, then dropped and logged rather than retried indefinitely.`;
    case 'batch-file':
      return `A failed run against ${system} is retried on the next scheduled window, capped at 3 attempts before it is flagged for manual review rather than retried indefinitely.`;
    default:
      return `Exponential backoff starting at 1 second and doubling to a 5-attempt ceiling for calls to ${system}, after which the call is routed to the dead-letter queue instead of retried forever.`;
  }
}

export function monitoringFrom(category: FlowCategory, system: string, components: readonly ArchitectureComponent[]): string {
  const observability = findComponents(components, { areas: ['observability'] });
  const services = serviceNames(observability);
  const destination = services.length === 0 ? 'the platform-native monitoring and alerting service selected during detailed design' : services.join(', ');
  switch (category) {
    case 'authentication':
      return `Sign-in success/failure counts and time-to-authenticate for ${system} are tracked in ${destination}, with an alert when the failure rate spikes so a broken federation is caught before it locks users out.`;
    case 'notification':
      return `Delivery success/failure counts for ${system} are tracked in ${destination}, with an alert when the failure rate crosses its threshold even though a missed notification never blocks the workflow.`;
    case 'batch-file':
      return `Run duration, record counts and failure counts for the ${system} exchange are tracked in ${destination}, with an alert when a scheduled run does not complete or its record count deviates from the expected range.`;
    case 'event':
      return `Publish/consume lag and dead-letter queue depth for the ${system} event stream are tracked in ${destination}, with an alert routed to the delivery team when lag or queue depth crosses its threshold.`;
    default:
      return `Success/failure counts and latency for calls to ${system} are tracked in ${destination}, with an alert routed to the delivery team when the failure rate or latency crosses its threshold.`;
  }
}

export function dataSyncFor(category: FlowCategory, system: string, systemType: IntegrationSpec['systemType']): string {
  if (category === 'authentication') {
    return `${system} is the identity source of truth for the signed-in user during federation; the platform stores no password or long-lived credential of its own and persists nothing beyond the session created once ${system} confirms the user's identity.`;
  }
  if (category === 'notification') {
    return `The platform stays the system of record for the underlying data; ${system} is a one-way delivery channel, so nothing is written back or reconciled from it.`;
  }
  const recordOwner = systemType === 'internal' ? system : 'the platform';
  return `${recordOwner} is treated as the system of record for the fields it owns; conflicting updates are resolved by last-writer-wins on the record's own timestamp, and a daily reconciliation job compares record counts between ${system} and the platform to surface drift instead of assuming the sync is complete.`;
}
