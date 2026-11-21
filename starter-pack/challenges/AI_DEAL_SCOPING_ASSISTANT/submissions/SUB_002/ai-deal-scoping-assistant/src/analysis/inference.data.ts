/**
 * Reference tables for AI-inferred items: persona nouns, well-known system names and the
 * signal-triggered delivery risks. Terms follow the signal keyword conventions.
 */
import type { Priority, SignalGroup } from '../domain';

export interface PersonaRule {
  label: string;
  terms: readonly string[];
}

/** Ordered by specificity; the generic end user is only used when nothing else is found. */
export const PERSONA_RULES: readonly PersonaRule[] = [
  { label: 'Member', terms: ['member'] },
  { label: 'Customer', terms: ['customer', 'client', 'shopper', 'buyer'] },
  { label: 'Patient', terms: ['patient'] },
  { label: 'Clinician', terms: ['clinician', 'doctor', 'nurse', 'physician', 'practitioner'] },
  { label: 'Administrator', terms: ['admin', 'administrator', 'back office staff'] },
  { label: 'Agent', terms: ['agent', 'broker'] },
  { label: 'Contact-centre staff', terms: ['call centre staff', 'call center staff', 'support staff', 'service desk analyst', 'front desk'] },
  { label: 'Manager', terms: ['manager', 'supervisor', 'team lead'] },
  { label: 'Employee', terms: ['employee', 'staff', 'colleague', 'workforce'] },
  { label: 'Field technician', terms: ['technician', 'field engineer', 'field worker', 'inspector', 'driver'] },
  { label: 'Supplier', terms: ['supplier', 'distributor', 'dealer', 'carrier'] },
  { label: 'Analyst', terms: ['analyst', 'data scientist', 'underwriter', 'claims handler', 'case worker', 'caseworker'] },
  { label: 'Student', terms: ['student', 'learner'] },
  { label: 'Teacher', terms: ['teacher', 'instructor', 'faculty'] },
  { label: 'Citizen', terms: ['citizen', 'resident', 'applicant', 'taxpayer'] },
  { label: 'Finance user', terms: ['accountant', 'finance team', 'accounts payable', 'controller'] },
  { label: 'Sales representative', terms: ['sales rep', 'sales team', 'account manager'] },
];

export const GENERIC_PERSONA: PersonaRule = { label: 'End user', terms: ['user', 'end user'] };

export interface KnownSystem {
  name: string;
  terms: readonly string[];
}

export const KNOWN_SYSTEMS: readonly KnownSystem[] = [
  { name: 'Salesforce', terms: ['salesforce'] },
  { name: 'SAP', terms: ['sap'] },
  { name: 'Microsoft Dynamics 365', terms: ['dynamics 365', 'dynamics crm', 'dynamics ax', 'dynamics nav'] },
  { name: 'HubSpot', terms: ['hubspot'] },
  { name: 'Oracle', terms: ['oracle'] },
  { name: 'NetSuite', terms: ['netsuite'] },
  { name: 'Workday', terms: ['workday'] },
  { name: 'ServiceNow', terms: ['servicenow'] },
  { name: 'Jira', terms: ['jira'] },
  { name: 'Zendesk', terms: ['zendesk'] },
  { name: 'Stripe', terms: ['stripe'] },
  { name: 'PayPal', terms: ['paypal'] },
  { name: 'Adyen', terms: ['adyen'] },
  { name: 'DocuSign', terms: ['docusign'] },
  { name: 'Twilio', terms: ['twilio'] },
  { name: 'SendGrid', terms: ['sendgrid'] },
  { name: 'Okta', terms: ['okta'] },
  { name: 'Microsoft Entra ID', terms: ['azure ad', 'entra', 'active directory'] },
  { name: 'Snowflake', terms: ['snowflake'] },
  { name: 'Power BI', terms: ['power bi'] },
  { name: 'Tableau', terms: ['tableau'] },
  { name: 'Epic', terms: ['epic ehr', 'epic emr', 'epic systems', 'with epic', 'epic fhir'] },
  { name: 'Guidewire', terms: ['guidewire'] },
  { name: 'Dentrix', terms: ['dentrix'] },
  { name: 'Hyland OnBase', terms: ['onbase'] },
  { name: 'Five9', terms: ['five9'] },
  { name: 'Looker', terms: ['looker'] },
  { name: 'BigQuery', terms: ['bigquery'] },
  { name: 'Manhattan WMS', terms: ['manhattan'] },
  { name: 'Auth0', terms: ['auth0'] },
  { name: 'Mailchimp', terms: ['mailchimp'] },
  { name: 'Xero', terms: ['xero'] },
  { name: 'Cerner', terms: ['cerner'] },
  { name: 'SharePoint', terms: ['sharepoint'] },
  { name: 'Google Maps', terms: ['google maps'] },
  { name: 'Shopify', terms: ['shopify'] },
  { name: 'QuickBooks', terms: ['quickbooks'] },
  { name: 'Kafka', terms: ['kafka'] },
  { name: 'Microsoft Teams', terms: ['microsoft teams', 'ms teams'] },
  { name: 'Slack', terms: ['slack'] },
  { name: 'the mainframe', terms: ['mainframe', 'as/400', 'as400'] },
];

/** Integration signals that describe the exchange style, not the system on the other side. */
export const EXCHANGE_STYLE_SIGNALS: readonly string[] = ['integration:realtime', 'integration:batch', 'integration:file', 'integration:api'];

export interface RiskRule {
  key: string;
  /** Exact signal ids and/or whole signal groups that trigger the risk. */
  signalIds: readonly string[];
  groups: readonly SignalGroup[];
  priority: Priority;
  title: string;
  /** Sentence completed with the triggering requirement IDs. */
  exposure: string;
  mitigation: string;
}

export const RISK_RULES: readonly RiskRule[] = [
  {
    key: 'legacy-integration',
    signalIds: ['integration:legacy'],
    groups: [],
    priority: 'High',
    title: 'Legacy integration complexity',
    exposure: 'Legacy interfaces are frequently undocumented, batch-oriented and owned by scarce specialists, which can extend the integration workstream for',
    mitigation: 'Run a technical spike on the legacy interfaces during discovery and agree a named customer interface owner.',
  },
  {
    key: 'data-migration',
    signalIds: ['data:migration'],
    groups: [],
    priority: 'High',
    title: 'Data migration quality and cutover',
    exposure: 'Source data quality, mapping effort and the cutover window are unknown until profiling is done, which puts the migration scope at risk for',
    mitigation: 'Profile a representative extract early, agree reconciliation criteria and rehearse the cutover at least once.',
  },
  {
    key: 'ai-data-quality',
    signalIds: [],
    groups: ['ai'],
    priority: 'Medium',
    title: 'AI output quality depends on source data',
    exposure: 'Answer accuracy and model behaviour depend on the completeness, structure and currency of the customer content behind',
    mitigation: 'Assess a content sample during discovery, define acceptance metrics with the customer and keep a human review step until they are met.',
  },
  {
    key: 'fixed-deadline',
    signalIds: ['delivery:deadline'],
    groups: [],
    priority: 'High',
    title: 'Fixed deadline compresses delivery',
    exposure: 'A fixed go-live leaves little room to absorb late decisions or third-party delays, which constrains the plan for',
    mitigation: 'Agree a must-have release scope, a decision log with turnaround times and a phased rollout for lower-priority items.',
  },
  {
    key: 'compliance',
    signalIds: [],
    groups: ['compliance'],
    priority: 'Medium',
    title: 'Compliance obligations extend assurance effort',
    exposure: 'Regulatory controls add design reviews, evidence collection and security testing that are easy to underestimate for',
    mitigation: 'Confirm the applicable control set and the customer compliance owner before the architecture is baselined.',
  },
];
