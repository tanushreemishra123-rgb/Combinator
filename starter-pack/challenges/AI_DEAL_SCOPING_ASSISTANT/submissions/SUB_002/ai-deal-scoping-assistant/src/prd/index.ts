/**
 * Public contract for the PRD and functional-scope module (challenge spec section "2. PRD and
 * Functional Scope Generation"). `generatePrd` is the stage entry the session/UI layer
 * calls; `planPrd` is the deterministic planner the mock AI provider delegates to.
 */
export { buildFunctionalScope, buildPrdBundle, buildPrdDocument } from './assemble';
export { buildCapabilities } from './capabilities';
export { CAPABILITY_CATALOG, CORE_PLATFORM_CAPABILITY, findCatalogEntry, findCatalogEntryByName } from './capabilityCatalog.data';
export type { CapabilityCatalogEntry, ChallengeType } from './capabilityCatalog.data';
export { buildRecommendedEnhancements } from './enhancements';
export { buildJourneys, MAX_JOURNEY_STEPS } from './journeys';
export { buildBusinessProblem, buildOutOfScope, buildOverview } from './narrative';
export { planPrd } from './plan';
export { prdTask } from './prompt';
export type { PrdInput } from './stage';
export { generatePrd } from './stage';
export type { PrdValidationResult } from './validate';
export { validatePrdOutput } from './validate';
