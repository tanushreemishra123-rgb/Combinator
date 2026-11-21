/**
 * Delivery estimate. The AI only proposes the *inputs* (workstreams, drivers, complexity, risks);
 * every number in EstimateResult is computed by the deterministic engine in src/estimation from
 * these inputs plus EstimationConfig, and each workstream carries its own calculation trace.
 */
import { z } from 'zod';
import { ComplexitySchema } from './common';
import type { Complexity, Confidence, MoneyRange, NumericRange } from './common';
import type { DriverType, EstimationConfig, RoleId } from './config';
import type { EstimationInputKey } from './scope';

export const DELIVERY_PHASES = [
  { id: 'PH_1', name: 'Discovery and Architecture' },
  { id: 'PH_2', name: 'Experience and Core Platform' },
  { id: 'PH_3', name: 'Data and Integration' },
  { id: 'PH_4', name: 'AI Capabilities' },
  { id: 'PH_5', name: 'Testing and Hardening' },
  { id: 'PH_6', name: 'Deployment and Handover' },
] as const;

export const DriverTypeSchema = z.enum([
  'capability',
  'integration',
  'data',
  'ai',
  'security',
  'infrastructure',
  'nonFunctional',
]);

export const DriverSuggestionSchema = z.object({
  id: z.string().min(1),
  type: DriverTypeSchema,
  label: z.string().min(1),
  complexity: ComplexitySchema,
  rationale: z.string().min(1),
  /** Scope items / capabilities / components / integrations / AI use cases behind this driver. */
  refIds: z.array(z.string()).default([]),
});
export type DriverSuggestion = z.infer<typeof DriverSuggestionSchema>;

export const WorkstreamSuggestionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phaseId: z.string().min(1),
  requirementIds: z.array(z.string()).default([]),
  drivers: z.array(DriverSuggestionSchema).min(1),
  skills: z.array(z.string()).default([]),
});
export type WorkstreamSuggestion = z.infer<typeof WorkstreamSuggestionSchema>;

export const EstimateNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  refs: z.array(z.string()).default([]),
});
export type EstimateNote = z.infer<typeof EstimateNoteSchema>;

/** AI-suggested estimation inputs - contains no effort, timeline or cost numbers by design. */
export const EstimateSuggestionSchema = z.object({
  workstreams: z.array(WorkstreamSuggestionSchema).min(1),
  risks: z.array(EstimateNoteSchema).default([]),
  dependencies: z.array(EstimateNoteSchema).default([]),
  assumptions: z.array(EstimateNoteSchema).default([]),
  exclusions: z.array(EstimateNoteSchema).default([]),
  explanation: z.string().default(''),
});
export type EstimateSuggestion = z.infer<typeof EstimateSuggestionSchema>;

export interface EstimateDriver extends DriverSuggestion {
  complexitySource: 'ai-suggested' | 'user-set';
  /** Person-days for one unit at this complexity, read from EstimationConfig.baseEffort. */
  unitDays: number;
}

export interface EffortAdjustment {
  label: string;
  factor: number;
  reason: string;
}

export interface RoleAllocation {
  roleId: RoleId;
  label: string;
  days: number;
  dayRate: number | null;
  /** null when the role has no configured rate - the cost is blocked, never guessed. */
  cost: number | null;
}

export interface WorkstreamEstimate {
  id: string;
  name: string;
  phaseId: string;
  requirementIds: string[];
  skills: string[];
  drivers: EstimateDriver[];
  complexity: Complexity;
  baseDays: number;
  adjustments: EffortAdjustment[];
  effortDays: NumericRange;
  roles: RoleAllocation[];
  cost: MoneyRange | null;
  commercialBasis: string;
  confidence: Confidence;
  confidenceLimitations: string[];
  /** Human-readable, reproducible calculation steps. */
  calculation: string[];
}

export interface PhaseEstimate {
  id: string;
  name: string;
  workstreamIds: string[];
  effortDays: NumericRange;
  durationWeeks: NumericRange;
  startWeek: number;
  milestone: string;
  calculation: string[];
}

export interface MissingEstimationInput {
  key: EstimationInputKey | 'roleRate' | 'scopeDrivers';
  label: string;
  effect: 'confidence-reduced' | 'calculation-blocked';
  /** Workstream IDs / estimate components affected by the missing input. */
  affected: string[];
  relatedScopeIds: string[];
  howToResolve: string;
}

export interface CalculationRule {
  id: string;
  name: string;
  formula: string;
  description: string;
}

export interface EstimateTotals {
  effortDays: NumericRange;
  effortPersonWeeks: NumericRange;
  timelineWeeks: NumericRange;
  /** Cost before contingency; null when any contributing role rate is missing. */
  subtotal: MoneyRange | null;
  contingency: MoneyRange | null;
  rom: MoneyRange | null;
}

export interface EstimateResult {
  workstreams: WorkstreamEstimate[];
  phases: PhaseEstimate[];
  totals: EstimateTotals;
  roleSummary: RoleAllocation[];
  confidence: Confidence;
  missingInputs: MissingEstimationInput[];
  risks: EstimateNote[];
  dependencies: EstimateNote[];
  assumptions: EstimateNote[];
  exclusions: EstimateNote[];
  explanation: string;
  rules: CalculationRule[];
  /** Deadline feasibility note when a delivery deadline is configured. */
  deadlineAssessment: string;
  /** Exact configuration the numbers were computed from (for reproducibility). */
  configSnapshot: EstimationConfig;
  computedAt: string;
}

/** Context-only reference data; never used as an input to the calculation. */
export interface HistoricalProjectReference {
  id: string;
  name: string;
  category: string;
  summary: string;
  durationWeeks: number;
  effortPersonWeeks: number;
  deliveryModel: string;
}

export type { DriverType };
