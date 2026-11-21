/**
 * Pre-export Quality Gate (spec section 6, "Quality Gate"; evaluation criterion 6: requirement
 * coverage checks, cross-document consistency checks, detection of unresolved questions and
 * unsupported recommendations, quality-gate status before export).
 *
 * Twelve deterministic checks (one small function each, see checks/) are graded pass / warn / fail
 * and rolled up into the quality summary: Export Status is 'Blocked' when any check fails,
 * 'Review Required' when any check warns, otherwise 'Ready'. The gate never throws on a partially
 * generated package - missing content is reported as 'Not generated yet'.
 */
export { NOT_GENERATED } from './checkKit';
export { QUALITY_CHECKS } from './checks';
export { runQualityGate } from './runQualityGate';
export { rollUpExportStatus } from './summary';
export type { QualityCheckSpec, QualityContext } from './types';
