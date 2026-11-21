/**
 * Critical-information checklist and ambiguity rules.
 *
 * Each checklist rule names one piece of information a ROM estimate or solution design depends
 * on. When the customer text does not state it, the engine raises a 'gap' and a linked
 * clarification 'question' (never an invented value). Ambiguity rules turn unquantified wording
 * ("fast", "scalable") into explicit working assumptions the reviewer must validate.
 */
import { hasSignalInGroup } from '../domain';
import type { CustomerContext, EstimationInputKey } from '../domain';
import type { Statement } from './segmentation';
import { containsAnyTerm, hasNumberNear, tokenize } from './textMatch';

export interface DocumentFacts {
  /** Whole document, normalised for term matching. */
  normalizedText: string;
  statements: readonly Statement[];
  /** Signals detected over the whole document. */
  signals: readonly string[];
  customer: CustomerContext;
}

export interface ChecklistRule {
  key: string;
  inputs: readonly EstimationInputKey[];
  applies(facts: DocumentFacts): boolean;
  isStated(facts: DocumentFacts): boolean;
  /** Critical gaps block a defensible estimate; the rest lower confidence only. */
  isCritical(facts: DocumentFacts): boolean;
  /** Exact signal ids or 'group:' prefixes of the items this gap relates to (first one is cited). */
  relatedSignals: readonly string[];
  gapTitle: string;
  gapDescription: string;
  questionTitle: string;
  questionDescription: string;
}

const USER_NOUNS: readonly string[] = [
  'user', 'member', 'customer', 'employee', 'staff', 'patient', 'student', 'agent', 'subscriber', 'citizen', 'visitor', 'seat', 'people',
  'account', 'client', 'driver', 'technician', 'clinician', 'supplier', 'partner',
];
const DEADLINE_TERMS: readonly string[] = [
  'go live', 'golive', 'deadline', 'launch', 'deliver', 'timeline', 'complete', 'live by', 'live before', 'in production', 'target date',
  'rollout', 'roll out', 'release', 'no later than',
];
const CALENDAR_TERMS: readonly string[] = [
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar',
  'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'q1', 'q2', 'q3', 'q4',
];
const DURATION_UNITS: readonly string[] = ['week', 'month', 'quarter', 'sprint'];
const YEAR_TOKEN = /^20\d\d\b/;
const ENVIRONMENT_TERMS: readonly string[] = ['environment', 'staging', 'uat', 'pre prod', 'preprod', 'non production', 'dev and test', 'sit'];
const DATA_CONTEXT_TERMS: readonly string[] = ['data', 'record', 'migrat', 'document', 'histor', 'archiv', 'transaction', 'file', 'storage'];
const VOLUME_UNITS: readonly string[] = [
  'record', 'gb', 'tb', 'mb', 'terabyte', 'gigabyte', 'petabyte', 'row', 'document', 'transaction', 'file', 'year', 'polic', 'claim',
  'invoice', 'order', 'image', 'page', 'million', 'thousand', 'event', 'message',
];
const AI_DATA_TERMS: readonly string[] = [
  'training data', 'labelled', 'labeled', 'dataset', 'digitised', 'digitized', 'already available', 'machine readable', 'text searchable',
  'annotated', 'historical tickets', 'years of historical', 'ground truth', 'sample data',
];
const REGION_TERMS: readonly string[] = [
  'region', 'countries', 'country', 'europe', 'eu', 'uk', 'united kingdom', 'usa', 'united states', 'north america', 'apac', 'emea',
  'asia', 'australia', 'canada', 'global', 'worldwide', 'nationwide', 'international', 'latin america', 'middle east', 'africa', 'india',
];
const IDENTITY_PROVIDER_NAMES: readonly string[] = [
  'azure ad', 'entra', 'active directory', 'okta', 'auth0', 'ping identity', 'pingfederate', 'adfs', 'cognito', 'google workspace',
  'onelogin', 'keycloak', 'ldap', 'forgerock',
];
const CURRENCY_TERMS: readonly string[] = ['usd', 'eur', 'gbp', 'dollar', 'euro', 'pound', 'aud', 'cad'];
const CURRENCY_AMOUNT = /^[$€£]\d/;
const REGULATED_INDUSTRY_TERMS: readonly string[] = ['health', 'insur', 'bank', 'financ', 'government', 'public sector', 'pharma', 'medic'];

/** Interface wording that shows the customer knows how the target system can be reached. */
export const INTERFACE_READINESS_TERMS: readonly string[] = [
  'api', 'rest api', 'restful', 'soap', 'graphql', 'webhook', 'sftp', 'odata', 'sandbox', 'documented', 'connector', 'sdk', 'hl7', 'fhir',
  'edi', 'flat file', 'csv', 'web service',
];

function anyStatement(facts: DocumentFacts, predicate: (normalized: string) => boolean): boolean {
  return facts.statements.some((statement) => predicate(statement.normalized));
}

function hasDateExpression(normalized: string): boolean {
  return (
    containsAnyTerm(normalized, CALENDAR_TERMS) ||
    hasNumberNear(normalized, DURATION_UNITS, 1) ||
    tokenize(normalized).some((token) => YEAR_TOKEN.test(token))
  );
}

function statesBudget(facts: DocumentFacts): boolean {
  return (
    facts.signals.includes('delivery:budget') ||
    anyStatement(facts, (text) => tokenize(text).some((token) => CURRENCY_AMOUNT.test(token)) || hasNumberNear(text, CURRENCY_TERMS, 1))
  );
}

function isRegulated(facts: DocumentFacts): boolean {
  return facts.signals.includes('data:pii') || containsAnyTerm(facts.customer.industry.toLowerCase(), REGULATED_INDUSTRY_TERMS);
}

const always = (): boolean => true;
const never = (): boolean => false;

export const CHECKLIST_RULES: readonly ChecklistRule[] = [
  {
    key: 'expected-users',
    inputs: ['expectedUsers'],
    applies: always,
    isStated: (facts) => anyStatement(facts, (text) => hasNumberNear(text, USER_NOUNS, 3)),
    isCritical: always,
    relatedSignals: ['nfr:scalability', 'nfr:performance'],
    gapTitle: 'Expected user volume not stated',
    gapDescription: 'The requirements do not quantify registered or concurrent users. Capacity sizing, licence counts and performance targets cannot be fixed without this figure.',
    questionTitle: 'How many users must the solution support?',
    questionDescription: 'How many registered users and peak concurrent users should the solution support at launch, and what growth is expected over three years?',
  },
  {
    key: 'delivery-deadline',
    inputs: ['deliveryDeadline'],
    applies: always,
    isStated: (facts) => anyStatement(facts, (text) => containsAnyTerm(text, DEADLINE_TERMS) && hasDateExpression(text)),
    isCritical: always,
    relatedSignals: ['delivery:deadline', 'delivery:phased'],
    gapTitle: 'Go-live date not stated',
    gapDescription: 'The requirements give no calendar date or duration for go-live. The delivery plan, team size and phasing cannot be validated against the customer timeline without it.',
    questionTitle: 'What is the target go-live date?',
    questionDescription: 'What is the required go-live date, is it fixed by an external event, and which scope items must be live on that date?',
  },
  {
    key: 'environments',
    inputs: ['environments'],
    applies: always,
    isStated: (facts) => containsAnyTerm(facts.normalizedText, ENVIRONMENT_TERMS),
    isCritical: never,
    relatedSignals: ['nfr:maintainability'],
    gapTitle: 'Required environments not stated',
    gapDescription: 'The number and type of environments (development, test, UAT, production, disaster recovery) are not described, which affects infrastructure and release effort.',
    questionTitle: 'Which environments are required?',
    questionDescription: 'Which environments must be provisioned and supported, and will the customer or the delivery team own each of them?',
  },
  {
    key: 'data-volume',
    inputs: ['dataVolume'],
    applies: (facts) => hasSignalInGroup(facts.signals, 'data'),
    isStated: (facts) => anyStatement(facts, (text) => containsAnyTerm(text, DATA_CONTEXT_TERMS) && hasNumberNear(text, VOLUME_UNITS, 3)),
    isCritical: (facts) => facts.signals.includes('data:migration'),
    relatedSignals: ['data:migration', 'data:'],
    gapTitle: 'Data volume and migration size not stated',
    gapDescription: 'No record counts, storage sizes or history depth are given for the data in scope, so storage design and any migration effort cannot be sized.',
    questionTitle: 'What data volumes are in scope?',
    questionDescription: 'How many records and how much storage are in scope per data domain, how many years of history must be migrated, and what is the expected annual growth?',
  },
  {
    key: 'compliance-scope',
    inputs: ['complianceScope'],
    applies: always,
    isStated: (facts) => hasSignalInGroup(facts.signals, 'compliance'),
    isCritical: isRegulated,
    relatedSignals: ['data:pii', 'security:'],
    gapTitle: 'Regulatory and compliance scope not stated',
    gapDescription: 'No regulation, certification or audit standard is named. Security controls, hosting choices and assurance effort depend on the applicable compliance scope.',
    questionTitle: 'Which regulations and standards apply?',
    questionDescription: 'Which regulations, certifications or internal policies must the solution comply with, and who is the customer compliance owner for sign-off?',
  },
  {
    key: 'ai-data-availability',
    inputs: ['aiDataAvailability'],
    applies: (facts) => hasSignalInGroup(facts.signals, 'ai'),
    isStated: (facts) => containsAnyTerm(facts.normalizedText, AI_DATA_TERMS),
    isCritical: always,
    relatedSignals: ['ai:'],
    gapTitle: 'Availability and quality of AI source data not stated',
    gapDescription: 'The requirements ask for AI capability but do not describe the volume, format, quality or access rights of the content and data it would rely on.',
    questionTitle: 'What data is available for the AI use cases?',
    questionDescription: 'What content or historical data is available for the AI use cases, in which formats and volumes, how current is it, and may it be processed by a hosted model?',
  },
  {
    key: 'target-regions',
    inputs: ['targetRegions'],
    applies: always,
    isStated: (facts) => facts.customer.region.trim() !== '' || containsAnyTerm(facts.normalizedText, REGION_TERMS),
    isCritical: never,
    relatedSignals: ['security:data-residency', 'nfr:localization'],
    gapTitle: 'Target regions not stated',
    gapDescription: 'The countries or regions the solution serves are not stated, which affects hosting location, data residency, latency and localisation.',
    questionTitle: 'Which regions will the solution serve?',
    questionDescription: 'In which countries or regions will users be located, and are there data residency requirements for any of them?',
  },
  {
    key: 'sso-identity-provider',
    inputs: ['integrationReadiness'],
    applies: (facts) => facts.signals.includes('security:sso'),
    isStated: (facts) => containsAnyTerm(facts.normalizedText, IDENTITY_PROVIDER_NAMES),
    isCritical: never,
    relatedSignals: ['security:sso'],
    gapTitle: 'Identity provider for single sign-on not named',
    gapDescription: 'Single sign-on is requested but the identity provider and federation protocol are not named, so the authentication design cannot be confirmed.',
    questionTitle: 'Which identity provider is used for single sign-on?',
    questionDescription: 'Which identity provider should the solution federate with, which protocol does it support (SAML or OpenID Connect), and who administers it?',
  },
  {
    key: 'budget',
    inputs: [],
    applies: always,
    isStated: statesBudget,
    isCritical: never,
    relatedSignals: ['delivery:budget'],
    gapTitle: 'Budget expectation not stated',
    gapDescription: 'No budget range or funding ceiling is given, so the ROM cannot be checked against the customer investment expectation.',
    questionTitle: 'Is there a budget range for this initiative?',
    questionDescription: 'Is there an approved budget range or funding ceiling, and does it cover implementation only or also run costs?',
  },
];

export interface AmbiguityRule {
  key: string;
  terms: readonly string[];
  /** Wording that makes the statement specific enough; the rule is skipped when present. */
  specificTerms: readonly string[];
  /** True when any number in the statement counts as a quantified target. */
  quantifiable: boolean;
  inputs: readonly EstimationInputKey[];
  title: string;
  assumption: string;
}

export const AMBIGUITY_RULES: readonly AmbiguityRule[] = [
  {
    key: 'performance',
    terms: ['fast', 'quick', 'quickly', 'high performance', 'performant', 'snappy'],
    specificTerms: ['second', 'millisecond', 'ms'],
    quantifiable: true,
    inputs: [],
    title: 'Performance target interpreted as two-second response',
    assumption: 'Performance is described without a measurable target. Working assumption: interactive pages respond within 2 seconds at the 95th percentile under the expected peak load.',
  },
  {
    key: 'usability',
    terms: ['user friendly', 'intuitive', 'easy to use', 'simple to use', 'modern look', 'modern ui', 'ease of use'],
    specificTerms: ['wcag', 'usability test', 'design system'],
    quantifiable: false,
    inputs: [],
    title: 'Usability expectation interpreted as WCAG 2.1 AA and tested journeys',
    assumption: 'Usability is described qualitatively. Working assumption: the experience follows a standard design system, meets WCAG 2.1 AA and is validated through usability testing of the priority journeys.',
  },
  {
    key: 'scalability',
    terms: ['scalab', 'scale', 'future growth', 'grow with'],
    specificTerms: [],
    quantifiable: true,
    inputs: ['expectedUsers'],
    title: 'Scalability interpreted as three-fold growth headroom',
    assumption: 'Scalability is requested without growth figures. Working assumption: the platform scales horizontally to three times the launch user volume without re-architecture.',
  },
  {
    key: 'security',
    terms: ['secure', 'highly secure', 'best practice security', 'industry standard security'],
    specificTerms: ['encrypt', 'sso', 'mfa', 'rbac', 'iso 27001', 'soc 2', 'gdpr', 'hipaa', 'pci', 'owasp'],
    quantifiable: false,
    inputs: ['complianceScope'],
    title: 'Security expectation interpreted as baseline control set',
    assumption: 'Security is requested without named controls. Working assumption: TLS 1.2 or later in transit, encryption at rest, role-based access, audit logging and OWASP Top 10 verification form the baseline.',
  },
  {
    key: 'availability',
    terms: ['highly available', 'high availability', 'always available', 'always on', '24/7', '24x7', 'reliable'],
    specificTerms: ['99.5', '99.9', '99.95', '99.99', 'rto', 'rpo'],
    quantifiable: false,
    inputs: [],
    title: 'Availability interpreted as 99.9% monthly uptime',
    assumption: 'Availability is requested without a service level. Working assumption: 99.9% monthly availability outside planned maintenance, delivered with zone redundancy in a single region.',
  },
  {
    key: 'real-time',
    terms: ['real time', 'realtime', 'instant', 'immediately'],
    specificTerms: ['second', 'millisecond', 'minute'],
    quantifiable: true,
    inputs: ['integrationReadiness'],
    title: 'Real-time interpreted as propagation within 60 seconds',
    assumption: 'Timeliness is described without a latency figure. Working assumption: changes propagate between systems within 60 seconds using event or API-based exchange, not sub-second streaming.',
  },
  {
    key: 'mobile',
    terms: ['mobile'],
    specificTerms: ['ios', 'android', 'native', 'responsive', 'pwa', 'progressive web'],
    quantifiable: false,
    inputs: [],
    title: 'Mobile access interpreted as responsive web',
    assumption: 'Mobile access is requested without naming platforms. Working assumption: a responsive web experience for current iOS and Android browsers, with no native app-store applications.',
  },
  {
    key: 'open-ended-list',
    terms: ['etc', 'and so on', 'and more', 'among others', 'including but not limited to'],
    specificTerms: [],
    quantifiable: false,
    inputs: [],
    title: 'Open-ended lists limited to the named items',
    assumption: 'The wording leaves a list open-ended. Working assumption: only the explicitly named items are in scope; anything further is handled through change control.',
  },
];
