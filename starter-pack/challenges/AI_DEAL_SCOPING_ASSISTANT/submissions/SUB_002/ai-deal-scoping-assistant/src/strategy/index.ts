/**
 * Data, integration and AI-solution strategy (spec 4). `planDataIntegration` / `planAiSolution` are
 * the deterministic planners the mock provider delegates to; `generateDataIntegration` /
 * `generateAiStrategy` are the stage entries the app calls, which run the task (mock or live) and
 * then semantic validation. See dataIntegrationPlanner.ts / aiSolutionPlanner.ts for the planners,
 * validate.ts for validation, prompts.ts for the live-provider prompts, and dataFlowDiagram.ts for
 * the diagram model.
 */
export type { StrategyInput } from './stage';
export { generateAiStrategy, generateDataIntegration } from './stage';

export { planDataIntegration } from './dataIntegrationPlanner';
export { planAiSolution } from './aiSolutionPlanner';

export { buildDataFlowDiagram } from './dataFlowDiagram';

export { validateAiSolution, validateDataIntegration } from './validate';
export { PLAN_AI_SOLUTION_TASK, PLAN_DATA_INTEGRATION_TASK } from './prompts';

export { buildDataDomains } from './dataDomains';
export { buildDataTopics } from './dataTopics';
export { buildDataFlows } from './flows';
export { buildIntegrations } from './integrations';
export { buildAiUseCases } from './aiUseCases';
export { buildProcessingBoundaries } from './aiBoundaries';
export { buildFrameworkRecommendations } from './aiFrameworks';
export { modelOptionsFor, retrievalServiceFor } from './aiModels.data';
export { findComponents, serviceNames } from './componentLookup';
