/**
 * Estimation module: AI-suggested estimate inputs + a pure, deterministic calculation engine.
 *
 *  - planEstimateInputs  mock planner: workstreams, drivers, complexity, skills, notes (no numbers)
 *  - estimateInputsTask  prompt + schema for the live provider (numbers explicitly forbidden)
 *  - generateEstimate    stage entry: context -> runTask -> semantic validation -> calculateEstimate
 *  - calculateEstimate   every effort, timeline and ROM value, reproducible from CALCULATION_RULES
 *  - recalculate         engine-only re-run after configuration or complexity-override changes
 */
export type { CalculationInput, EstimateInput } from './types';
export { calculateEstimate, snapshotConfig } from './engine/calculateEstimate';
export { CALCULATION_RULES } from './engine/rules';
export { describeTimelineCalculation, describeTotalsCalculation } from './engine/narrative';
export { LOW_CONFIDENCE_EFFORT_SHARE, MISSING_INPUTS_FOR_LOW_CONFIDENCE } from './engine/confidence';
export { TESTING_OVERLAP_OF_BUILD } from './engine/timeline';
export { formatMoney } from './format';
export { getHistoricalReferences } from './historical';
export { planEstimateInputs } from './inputPlanner';
export { detectMissingInputs, TIMELINE_COMPONENT } from './missingInputs';
export { findDoubleCountedDrivers } from './planner/doubleCounting';
export type { DoubleCountedDriverPair } from './planner/doubleCounting';
export type { MissingInputQuery, WorkstreamFacts } from './missingInputs';
export { estimateInputsTask } from './prompt';
export { buildEstimateContext, generateEstimate, recalculate } from './stage';
export { findStatedDeadline } from './statedDeadline';
export type { StatedDeadline } from './statedDeadline';
export { containsEffortOrCostFigure, validateSuggestion } from './validation';
export type { SuggestionValidation } from './validation';
