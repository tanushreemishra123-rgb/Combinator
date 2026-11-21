/**
 * Deterministic rule-based PRD and functional-scope decomposition used by the mock provider (and
 * as the grounded baseline any live-generated output is validated against, see validate.ts). Every
 * reviewed requirement is placed into a capability - falling back to Core Platform Services - so
 * the functional scope never silently drops part of the reviewed scope.
 */
import type { PrdContext } from '../ai/types';
import type { PrdOutput } from '../domain';
import { PrdOutputSchema } from '../domain';
import { getRequirements } from '../scope';
import { buildCapabilities } from './capabilities';
import { buildRecommendedEnhancements } from './enhancements';
import { buildJourneys } from './journeys';
import { buildBusinessProblem, buildOutOfScope, buildOverview } from './narrative';

/** Builds the full PrdOutput for the reviewed scope; validated by the same schema a live provider's response must satisfy. */
export function planPrd(context: PrdContext): PrdOutput {
  const { scope, customer } = context;
  const capabilities = buildCapabilities(scope);
  const requirements = getRequirements(scope);

  const draft: PrdOutput = {
    overview: buildOverview(scope, customer, capabilities),
    businessProblem: buildBusinessProblem(scope, customer),
    journeys: buildJourneys(scope, capabilities),
    capabilities,
    recommendedEnhancements: buildRecommendedEnhancements(requirements),
    outOfScope: buildOutOfScope(scope),
  };

  return PrdOutputSchema.parse(draft);
}
