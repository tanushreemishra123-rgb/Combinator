/**
 * Change-impact handling (spec section 6, "Change-Impact Handling"; evaluation criterion 6:
 * "identification of affected outputs after a change", "preservation of unaffected reviewed
 * content").
 *
 *  - describeChanges          diff of two session snapshots -> readable ChangeDescriptors
 *  - analyzeImpact            rule table (impactRules.data.ts) refined by real trace data
 *  - createImpactReport       analysis + AI (or mock) plain-language explanation
 *  - planImpactExplanation    deterministic explanation used by the mock provider
 *  - applyImpactReport        marks only the affected stages stale, logs the report, resets quality
 *  - markSectionsResolved     records regenerated / recalculated sections on the change log
 *  - summarizePendingActions  what is still stale and whether it needs the AI stage or the engine
 */
export { analyzeImpact, NOT_GENERATED_REASON } from './analyzeImpact';
export { applyImpactReport, markSectionsResolved, summarizePendingActions } from './applyImpact';
export { describeChanges } from './describeChanges';
export { buildImpactPrompt, IMPACT_EXPLANATION_TASK, planImpactExplanation } from './explanation';
export { stableFingerprint } from './format';
export { IMPACT_RULES } from './impactRules.data';
export { createImpactReport, RULE_BASED_EXPLANATION_NOTE } from './report';
export { stageState } from './sectionElements';
export { sectionLabel } from './vocabulary';
export type { AreaRule, ElementSelector, ImpactAnalysis, ImpactRule, PendingAction, PreservedArea } from './types';
