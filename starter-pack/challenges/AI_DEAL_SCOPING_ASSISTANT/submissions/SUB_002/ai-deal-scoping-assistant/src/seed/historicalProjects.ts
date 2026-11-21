/**
 * Illustrative historical Topcoder-style delivery references shown alongside the estimate for
 * sanity-checking only. CONTEXT ONLY: `calculateEstimate` in src/estimation never reads this file
 * and these figures must never influence a computed number - they exist purely so a reviewer can
 * compare a proposed estimate against comparable past engagements.
 */
import type { HistoricalProjectReference } from '../domain';

/** Context-only reference set; see the module doc comment above for why these never feed the calculator. */
export const HISTORICAL_PROJECTS: readonly HistoricalProjectReference[] = [
  {
    id: 'HIST_01',
    name: 'Regional Credit Union Digital Banking Modernization',
    category: 'application-modernization',
    summary:
      'Replaced a legacy COBOL/DB2 online-banking front end with a React and Node.js platform integrated with an existing core banking system, delivered through a series of Topcoder architecture, UI and development challenges.',
    durationWeeks: 38,
    effortPersonWeeks: 210,
    deliveryModel: 'topcoder-challenge-series',
  },
  {
    id: 'HIST_02',
    name: 'Specialty Pharmacy Order and Inventory Integration',
    category: 'data-integration',
    summary:
      'Connected a specialty pharmacy chain\'s point-of-sale, wholesaler EDI feeds and a new analytics warehouse, with data-quality rules and lineage tracking built by a dedicated data-engineering pod.',
    durationWeeks: 26,
    effortPersonWeeks: 128,
    deliveryModel: 'dedicated-team',
  },
  {
    id: 'HIST_03',
    name: 'Field Services Contract Review Assistant',
    category: 'ai-enabled',
    summary:
      'Delivered a retrieval-augmented contract-review assistant over a field-services provider\'s master service agreements, with human sign-off on every clause recommendation, using a blended Topcoder-challenge and dedicated-team model.',
    durationWeeks: 20,
    effortPersonWeeks: 96,
    deliveryModel: 'blended',
  },
  {
    id: 'HIST_04',
    name: 'Multi-State Utility Customer Portal Rebuild',
    category: 'application-modernization',
    summary:
      'Rebuilt a multi-state utility\'s customer self-service portal on a cloud-native stack, integrating with an existing customer-information system and a usage-billing engine, delivered as a series of parallel Topcoder challenges.',
    durationWeeks: 44,
    effortPersonWeeks: 245,
    deliveryModel: 'topcoder-challenge-series',
  },
  {
    id: 'HIST_05',
    name: 'Freight Brokerage Load and Carrier Data Platform',
    category: 'data-integration',
    summary:
      'Consolidated load-board, carrier-compliance and settlement data from four source systems into a governed warehouse with automated data-quality scoring, delivered by a dedicated data-engineering team.',
    durationWeeks: 22,
    effortPersonWeeks: 104,
    deliveryModel: 'dedicated-team',
  },
  {
    id: 'HIST_06',
    name: 'Property Insurer Claims Document Extraction Pilot',
    category: 'ai-enabled',
    summary:
      'Built a document-extraction pipeline for first-notice-of-loss claim packets, with confidence scoring and mandatory adjuster review before any extracted field reached the claims system, delivered as a scoped Topcoder challenge series.',
    durationWeeks: 14,
    effortPersonWeeks: 58,
    deliveryModel: 'topcoder-challenge-series',
  },
  {
    id: 'HIST_07',
    name: 'National Retailer Loyalty Platform Consolidation',
    category: 'application-modernization',
    summary:
      'Merged two legacy loyalty-points systems from a retail merger into a single cloud-hosted platform, migrating member balances and integrating with in-store point-of-sale terminals, delivered by a blended team.',
    durationWeeks: 30,
    effortPersonWeeks: 165,
    deliveryModel: 'blended',
  },
  {
    id: 'HIST_08',
    name: 'Regional Health Plan Member Chatbot Rollout',
    category: 'ai-enabled',
    summary:
      'Delivered a benefits-and-eligibility question-answering assistant grounded in a health plan\'s approved policy documents, with escalation to licensed staff for anything touching individual coverage decisions.',
    durationWeeks: 18,
    effortPersonWeeks: 82,
    deliveryModel: 'dedicated-team',
  },
];
