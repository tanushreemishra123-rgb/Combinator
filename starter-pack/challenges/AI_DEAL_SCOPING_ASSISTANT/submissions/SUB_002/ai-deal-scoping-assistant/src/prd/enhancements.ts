/**
 * Signal-triggered recommendations that go beyond what the customer explicitly asked for
 * (observability, accessibility, security hardening, AI feedback loops, data governance). Each
 * rule cites the concrete requirement IDs that motivate it so a reviewer can see why it was
 * suggested rather than treating it as generic filler.
 */
import { formatId } from '../domain/ids';
import type { Capability, ScopeItem } from '../domain';

interface EnhancementRule {
  name: string;
  module: string;
  workstream: string;
  deliveryPackage: string;
  matches(signals: readonly string[]): boolean;
  buildScope(citedIds: string): string;
  acceptance: readonly string[];
}

/** At most this many enhancements are surfaced, in rule-priority order, so the list stays reviewable. */
const MAX_RECOMMENDED_ENHANCEMENTS = 4;

/**
 * AI signals whose use case actually produces an answer or response a person reads (a conversational
 * assistant, a RAG-grounded Q&A flow, generated content) - as opposed to a classifier, extractor,
 * forecast or recommendation, which has no "answer" for a person to rate thumbs-up/down.
 */
const ANSWER_GENERATING_AI_SIGNALS: ReadonlySet<string> = new Set(['ai:assistant', 'ai:rag', 'ai:generation']);

const ENHANCEMENT_RULES: readonly EnhancementRule[] = [
  {
    name: 'AI Answer Quality Feedback Loop',
    module: 'AI Capabilities',
    workstream: 'AI and Machine Learning',
    deliveryPackage: 'Package 3 - AI Capabilities',
    matches: (signals) => signals.some((signal) => ANSWER_GENERATING_AI_SIGNALS.has(signal)),
    buildScope: (citedIds) =>
      `Capture a thumbs-up/down and free-text rating on every AI-generated answer and route low-confidence responses to human review, closing the loop for the AI use cases in ${citedIds}.`,
    acceptance: [
      'Every AI response records a feedback signal that is visible on an operational dashboard.',
      'Responses flagged low-confidence or negatively rated are routed to a reviewer queue.',
    ],
  },
  {
    name: 'Observability and Operations Dashboard',
    module: 'Platform Operations',
    workstream: 'Non-Functional Hardening',
    deliveryPackage: 'Package 1 - Foundation',
    matches: (signals) => signals.some((signal) => signal === 'nfr:availability' || signal === 'nfr:performance' || signal === 'nfr:scalability'),
    buildScope: (citedIds) =>
      `Stand up centralised logging, metrics and alerting so the availability, performance and scale targets in ${citedIds} are continuously measurable rather than assumed at go-live.`,
    acceptance: [
      'Uptime, latency and error-rate dashboards are available to the delivery and operations teams.',
      'A breach of an agreed threshold raises an alert within five minutes.',
    ],
  },
  {
    name: 'Accessibility Compliance Audit',
    module: 'Platform Operations',
    workstream: 'Non-Functional Hardening',
    deliveryPackage: 'Package 1 - Foundation',
    // A portal/mobile capability signal alone is not enough: plenty of portal or mobile work is an
    // internal staff tool, or a phase-2 idea the customer already marked out of scope, and recommending
    // WCAG remediation for those is generic filler. Only an explicit accessibility requirement counts.
    matches: (signals) => signals.includes('nfr:accessibility'),
    buildScope: (citedIds) => `Run a WCAG 2.1 AA audit against the customer-facing flows introduced by ${citedIds} and remediate findings before launch.`,
    acceptance: [
      'An independent accessibility audit report is produced for every customer-facing screen in scope.',
      'Every critical and serious finding is remediated before go-live.',
    ],
  },
  {
    name: 'Security and Compliance Hardening Review',
    module: 'Security and Compliance',
    workstream: 'Security Controls',
    deliveryPackage: 'Package 4 - Security and Compliance',
    matches: (signals) => signals.some((signal) => signal.startsWith('security:') || signal.startsWith('compliance:') || signal === 'data:pii'),
    buildScope: (citedIds) =>
      `Commission an independent penetration test and compliance review of the controls implemented for ${citedIds} before production release.`,
    acceptance: [
      'A third-party penetration test report is delivered with no unresolved critical findings.',
      'Compliance evidence is filed against every cited control before go-live.',
    ],
  },
  {
    name: 'Data Quality and Governance Program',
    module: 'Data Platform',
    workstream: 'Data Management',
    deliveryPackage: 'Package 2 - Data and Integration',
    matches: (signals) => signals.some((signal) => signal.startsWith('data:')),
    buildScope: (citedIds) =>
      `Define data-quality rules, named ownership and a reconciliation cadence for the data domains in ${citedIds} so downstream reporting stays trustworthy.`,
    acceptance: [
      'Data-quality rules run on a schedule and publish a pass/fail report.',
      'A named data owner is recorded for every data domain in scope.',
    ],
  },
];

function formatCitedIds(ids: readonly string[]): string {
  return ids.join(', ');
}

/** Evaluates every rule against the reviewed requirements and returns up to MAX_RECOMMENDED_ENHANCEMENTS matches, each labelled and cited. */
export function buildRecommendedEnhancements(requirements: readonly ScopeItem[]): Capability[] {
  const triggered = ENHANCEMENT_RULES.map((rule) => ({
    rule,
    citedIds: requirements.filter((requirement) => rule.matches(requirement.signals)).map((requirement) => requirement.id),
  }))
    .filter((candidate) => candidate.citedIds.length > 0)
    .slice(0, MAX_RECOMMENDED_ENHANCEMENTS);

  return triggered.map(({ rule, citedIds }, index) => ({
    id: formatId('ENH', index + 1),
    name: rule.name,
    scope: rule.buildScope(formatCitedIds(citedIds)),
    requirementIds: citedIds,
    priority: 'Medium',
    dependencies: [],
    label: 'recommended-enhancement',
    module: rule.module,
    workstream: rule.workstream,
    deliveryPackage: rule.deliveryPackage,
    acceptance: [...rule.acceptance],
  }));
}
