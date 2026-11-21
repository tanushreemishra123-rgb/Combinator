/**
 * Requirement analysis: signal taxonomy matcher, deterministic heuristic analysis engine (mock
 * mode), grounding validator, ID normaliser and the analyzeRequirements() stage entry.
 */
export { analyzeRequirements } from './stage';
export type { AnalyzeInput } from './stage';
export { planAnalysis } from './heuristicAnalyzer';
export { detectSignals, rankSignalThemes } from './signals';
export { groundScopeItems, TOKEN_OVERLAP_THRESHOLD } from './grounding';
export { normalizeIds } from './idNormalizer';
export type { IdNormalizationResult } from './idNormalizer';
export { analyzeRequirementsTask, renderNumberedSource } from './prompt';
export { classifyStatement } from './classification';
export type { Classification } from './classification';
export { derivePriority } from './priority';
export { segmentDocument } from './segmentation';
export type { Statement } from './segmentation';
