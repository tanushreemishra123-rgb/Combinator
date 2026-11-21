/** Internal working structures of the calculation engine (not part of the public contract). */
import type {
  Complexity,
  Confidence,
  EffortAdjustment,
  EstimateDriver,
  EstimationConfig,
  RoleAllocation,
  SolutionConfig,
} from '../../domain';
import type { ConfigLookups, MixKey } from './lookups';

export interface EngineContext {
  estimationConfig: EstimationConfig;
  solution: SolutionConfig;
  lookups: ConfigLookups;
  /** Reviewer complexity overrides keyed by driver id. */
  overrides: ReadonlyMap<string, Complexity>;
}

/**
 * A workstream after the effort rules ran but before confidence is known. Ranges and costs are
 * added in a second pass because confidence depends on the missing inputs of *all* workstreams.
 */
export interface WorkstreamDraft {
  id: string;
  name: string;
  phaseId: string;
  kind: 'build' | 'overhead';
  requirementIds: string[];
  skills: string[];
  drivers: EstimateDriver[];
  /** Drivers whose driver type / complexity has no base-effort value (they contribute 0 days). */
  blockedDrivers: EstimateDriver[];
  complexity: Complexity;
  baseDays: number;
  adjustments: EffortAdjustment[];
  likelyDays: number;
  roles: RoleAllocation[];
  /** Driver types that have effort but no role mix, which blocks the cost of the workstream. */
  unmixedTypes: MixKey[];
  /** Calculation lines up to and including the likely effort. */
  trace: string[];
}

export interface ConfidenceAssessment {
  confidence: Confidence;
  limitations: string[];
}
