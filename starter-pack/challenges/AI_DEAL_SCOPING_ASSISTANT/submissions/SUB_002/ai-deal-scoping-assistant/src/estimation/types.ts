/** Public input contracts of the estimation module. */
import type {
  AiStrategyOutput,
  ArchitectureDesign,
  ComplexityOverride,
  CustomerContext,
  DataIntegrationOutput,
  EstimateSuggestion,
  EstimationConfig,
  PrdBundle,
  ScopeModel,
  SolutionConfig,
} from '../domain';

/** Everything the estimate stage reads: the reviewed scope plus the upstream deliverables. */
export interface EstimateInput {
  scope: ScopeModel;
  customer: CustomerContext;
  config: SolutionConfig;
  estimationConfig: EstimationConfig;
  prd: PrdBundle;
  design: ArchitectureDesign;
  dataIntegration: DataIntegrationOutput;
  aiStrategy: AiStrategyOutput;
  overrides: ComplexityOverride[];
}

/** Input of the pure calculation engine - no provider, no clock, no randomness. */
export interface CalculationInput {
  suggestion: EstimateSuggestion;
  scope: ScopeModel;
  config: SolutionConfig;
  estimationConfig: EstimationConfig;
  overrides: ComplexityOverride[];
  /** ISO timestamp injected by the caller so the calculation itself stays pure. */
  computedAt: string;
}
