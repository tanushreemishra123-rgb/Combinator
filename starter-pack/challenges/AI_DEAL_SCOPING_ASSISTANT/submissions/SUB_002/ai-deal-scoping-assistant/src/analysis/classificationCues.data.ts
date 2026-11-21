/**
 * Cue tables for statement classification. The order of KIND_CUES is the precedence: the first
 * kind whose cues match wins, so uncertainty ("TBD") outranks everything and the broad 'data' and
 * 'business' cues only apply when nothing more specific matched. Terms follow the conventions of
 * the signal keyword table (lower-case, hyphen-free, matched at word starts).
 */
import type { ScopeItemKind } from '../domain';

export interface KindCueEntry {
  kind: ScopeItemKind;
  terms: readonly string[];
}

/** Document metadata lines ("Attendees: ...") name people and dates, not scope. */
export const METADATA_PREFIXES: readonly string[] = [
  'attendees', 'participants', 'present:', 'date:', 'meeting date', 'prepared by', 'prepared for', 'author:', 'version:', 'document owner',
  'location:', 'distribution:', 'status:',
];

/** Wording that marks information as open - produces a gap plus a clarification question. */
export const UNCERTAINTY_CUES: readonly string[] = [
  'tbd', 'tbc', 'to be confirmed', 'to be determined', 'to be decided', 'to be defined', 'to be agreed', 'not yet decided',
  'not yet known', 'not yet defined', 'not yet agreed', 'not decided', 'unknown', 'unclear', 'not sure', 'undecided', 'yet to be',
  'still deciding', 'have not decided', "haven't decided", 'open question', 'not finalised', 'not finalized', 'under discussion',
  'no decision', 'not been decided', 'not confirmed', 'unconfirmed', 'could not confirm', 'could not yet confirm', 'could not say',
  'nobody could', 'nobody on', 'nobody mentioned', 'neither attendee', 'not discussed', 'not mentioned', 'not specified', 'not provided',
  'do not know', "don't know", 'confirm whether', 'pending decision', 'remains open', 'open item', 'open issue',
];

/**
 * Requirement label prefixes customers commonly use ("BR1.", "NFR-04:"). A labelled statement is
 * classified as the kind its label names, because that is the customer's own reading of it.
 */
export const REQUIREMENT_LABEL_KINDS: ReadonlyMap<string, ScopeItemKind> = new Map<string, ScopeItemKind>([
  ['BR', 'business'], ['BO', 'business'], ['OBJ', 'business'], ['GOAL', 'business'],
  ['FR', 'functional'], ['US', 'functional'], ['UC', 'functional'], ['FEAT', 'functional'],
  ['NFR', 'nonFunctional'], ['NF', 'nonFunctional'], ['QR', 'nonFunctional'],
  ['INT', 'integration'], ['IR', 'integration'], ['IF', 'integration'],
  ['DATA', 'data'], ['DR', 'data'],
  ['SEC', 'security'], ['SR', 'security'], ['COMP', 'security'],
  ['TECH', 'technology'], ['TR', 'technology'],
  ['CON', 'constraint'], ['CNS', 'constraint'],
  ['DEP', 'dependency'],
  ['RSK', 'risk'], ['RISK', 'risk'],
  ['ASM', 'assumption'], ['ASSUM', 'assumption'],
]);

/** Actor-capability phrasing: the statement describes something a user does, so it is functional. */
export const USER_CAPABILITY_CUES: readonly string[] = [
  'be able to', 'ability to', 'allow', 'enable users', 'enables users', 'users can', 'user can', 'can view', 'can create',
  'can submit', 'can manage', 'lets users', 'should let', 'must let', 'capability to',
];

/** Obligation wording: a statement without any other cue is still a requirement when it obliges. */
export const OBLIGATION_CUES: readonly string[] = [
  'must', 'shall', 'should', 'need', 'want', 'require', 'would like', 'will be', 'will provide', 'will support', 'has to', 'have to',
  'looking for', 'wish', 'expect', 'able to', 'could', 'nice to have', 'ideally',
];

export const INTEGRATION_CUES: readonly string[] = [
  'integrat', 'sync', 'connect to', 'connect with', 'connects to', 'interface with', 'interfaces with', 'interfacing', 'exchange data',
  'pull data from', 'push data to', 'feed from', 'feeds into', 'data feed', 'import from', 'export to', 'webhook', 'two way', 'bi directional',
  'bidirectional', 'hand off to', 'handoff to',
];

/** Preference wording only makes a 'technology' item when a technology is actually named. */
export const TECHNOLOGY_PREFERENCE_CUES: readonly string[] = [
  'prefer', 'standardised on', 'standardized on', 'our stack', 'tech stack', 'technology stack', 'we use', 'built on', 'must be built',
  'must use', 'should use', 'hosted on', 'hosted in', 'deploy on', 'deployed on', 'deployed to', 'cloud provider', 'strategic platform',
  'aligned with our', 'committed to', 'invested in',
];

export const TECHNOLOGY_NAMES: readonly string[] = [
  'azure', 'aws', 'amazon web services', 'gcp', 'google cloud', 'microsoft', 'react', 'angular', 'vue', '.net', 'dotnet', 'java',
  'python', 'node', 'typescript', 'kubernetes', 'docker', 'container', 'serverless', 'microservice', 'sql server', 'postgres', 'mysql',
  'oracle', 'mongodb', 'open source', 'terraform', 'power platform', 'sharepoint', 'spring', 'php', 'cloud native', 'on premise',
  'on prem', 'saas', 'low code', 'flutter', 'react native', 'swift', 'kotlin', 'snowflake', 'databricks', 'openai', 'salesforce platform',
];

export const KIND_CUES: readonly KindCueEntry[] = [
  { kind: 'assumption', terms: ['assume', 'assuming', 'assumption', 'presumably', 'it is expected that', 'we expect that', 'we anticipate'] },
  { kind: 'risk', terms: ['risk', 'concern', 'worried', 'worry', 'threat to', 'may fail', 'uncertain', 'afraid', 'fear', 'previous attempt failed'] },
  {
    kind: 'dependency',
    terms: ['depends on', 'dependent on', 'dependency', 'dependencies', 'requires access', 'subject to', 'contingent on', 'prerequisite',
      'will be provided by', 'pending approval', 'relies on', 'reliant on', 'once approved', 'third party will'],
  },
  {
    kind: 'constraint',
    terms: ['deadline', 'budget', 'go live', 'golive', 'timeline', 'no later than', 'launch in', 'launch by', 'launch date', 'launch before', 'must be delivered', 'fixed price',
      'by end of', 'by the end of', 'cannot exceed', 'not exceed', 'not to exceed', 'constraint', 'limited to', 'timeframe', 'time frame',
      'code freeze', 'live by', 'live before', 'out of scope', 'not in scope', 'excluded from', 'funding', 'within budget'],
  },
  { kind: 'integration', terms: INTEGRATION_CUES },
  {
    kind: 'existingSystem',
    terms: ['currently use', 'currently run', 'currently rely', 'current system', 'current platform', 'existing system', 'existing platform',
      'existing application', 'our existing', 'our current', 'legacy', 'we currently', 'today we', 'at present', 'is currently',
      'are currently', 'mainframe', 'replace our', 'replacing our', 'will replace', 'in place today', 'as is'],
  },
  {
    kind: 'security',
    terms: ['encrypt', 'sso', 'single sign on', 'mfa', 'multi factor', 'two factor', 'rbac', 'role based', 'audit', 'gdpr', 'hipaa', 'pci',
      'soc 2', 'soc2', 'iso 27001', 'complian', 'comply', 'security', 'secure', 'penetration', 'privacy', 'authentication', 'authoris',
      'authoriz', 'permission', 'data protection', 'regulat', 'residency', 'fedramp', 'sox'],
  },
  {
    kind: 'nonFunctional',
    terms: ['availab', 'uptime', 'performance', 'latency', 'response time', 'scalab', 'concurrent', 'accessib', 'wcag', 'usab',
      'user friendly', 'intuitive', 'reliab', 'maintainab', 'disaster recovery', 'backup', 'offline', 'multilingual', 'languages',
      'browser', 'load time', 'page load', '99.9', '99.5', '99.95', '99.99', 'sla', 'monitoring', 'peak', 'fast', 'throughput', 'resilien', 'recovery point',
      'recovery time', 'rpo', 'rto'],
  },
  {
    kind: 'business',
    terms: ['objective', 'goal', 'reduce', 'increase', 'improve', 'kpi', 'revenue', 'cost saving', 'efficien', 'customer satisfaction',
      'nps', 'grow', 'vision', 'strategic', 'business case', 'roi', 'outcome', 'our aim', 'mission', 'modernis', 'moderniz', 'transform',
      'streamline', 'competitive', 'market share', 'pain point'],
  },
  {
    kind: 'data',
    terms: ['migrat', 'retention', 'retain', 'archiv', 'data volume', 'records', 'data model', 'database', 'dataset', 'data quality',
      'master data', 'historical data', 'data warehouse', 'data lake', 'data source', 'terabyte', 'gigabyte', 'data', 'reporting',
      'reports', 'analytics'],
  },
];

/** Section headings bias statements that carry no cue of their own ("Risks", "Assumptions", ...). */
export const SECTION_HINTS: readonly KindCueEntry[] = [
  { kind: 'assumption', terms: ['assumption'] },
  { kind: 'risk', terms: ['risk', 'concern'] },
  { kind: 'dependency', terms: ['dependenc', 'prerequisite'] },
  { kind: 'constraint', terms: ['constraint', 'timeline', 'delivery', 'budget', 'commercial', 'schedule', 'out of scope'] },
  { kind: 'integration', terms: ['integration', 'interface'] },
  { kind: 'existingSystem', terms: ['existing system', 'current state', 'current landscape', 'as is', 'current system', 'background system'] },
  { kind: 'security', terms: ['security', 'compliance', 'privacy', 'regulatory'] },
  { kind: 'nonFunctional', terms: ['non functional', 'nonfunctional', 'nfr', 'quality attribute', 'service level'] },
  { kind: 'technology', terms: ['technology', 'technical preference', 'tech stack', 'platform preference'] },
  { kind: 'business', terms: ['goal', 'objective', 'business driver', 'vision', 'outcome', 'success criteria'] },
  { kind: 'data', terms: ['data', 'migration', 'reporting'] },
  { kind: 'functional', terms: ['functional', 'feature', 'capabilit', 'requirement', 'user stor', 'scope of work', 'use case'] },
];
