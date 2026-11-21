/**
 * PRD and functional scope. Every capability must reference reviewed requirement IDs;
 * anything that does not is surfaced as an unsupported scope addition by the coverage engine.
 */
import { z } from 'zod';
import { ContentLabelSchema, PrioritySchema, TracedStatementSchema } from './common';

export const PRD_SECTION_IDS = [
  'overview',
  'businessProblem',
  'objectives',
  'personas',
  'journeys',
  'functionalRequirements',
  'nonFunctionalRequirements',
  'integrations',
  'dependencies',
  'assumptions',
  'risks',
  'outOfScope',
  'openQuestions',
  'traceability',
] as const;
export const PrdSectionIdSchema = z.enum(PRD_SECTION_IDS);
export type PrdSectionId = z.infer<typeof PrdSectionIdSchema>;

export const UserJourneySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  persona: z.string().default(''),
  steps: z.array(z.string()).min(1),
  requirementIds: z.array(z.string()).default([]),
});
export type UserJourney = z.infer<typeof UserJourneySchema>;

export const CapabilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.string().min(1),
  requirementIds: z.array(z.string()).default([]),
  priority: PrioritySchema.default('Medium'),
  dependencies: z.array(z.string()).default([]),
  label: ContentLabelSchema.default('customer-requested'),
  module: z.string().default('Core Platform'),
  workstream: z.string().default('Core Platform'),
  deliveryPackage: z.string().default('Package 1'),
  acceptance: z.array(z.string()).default([]),
});
export type Capability = z.infer<typeof CapabilitySchema>;

/** Narrative + decomposition an AI provider returns for the PRD stage. */
export const PrdOutputSchema = z.object({
  overview: z.array(TracedStatementSchema).min(1),
  businessProblem: z.array(TracedStatementSchema).min(1),
  journeys: z.array(UserJourneySchema).default([]),
  capabilities: z.array(CapabilitySchema).min(1),
  recommendedEnhancements: z.array(CapabilitySchema).default([]),
  outOfScope: z.array(TracedStatementSchema).default([]),
});
export type PrdOutput = z.infer<typeof PrdOutputSchema>;

export interface PrdSection {
  id: PrdSectionId;
  title: string;
  statements: z.infer<typeof TracedStatementSchema>[];
}

export interface PrdDocument {
  title: string;
  sections: PrdSection[];
  journeys: UserJourney[];
}

export interface ScopeGrouping {
  name: string;
  capabilityIds: string[];
  requirementIds: string[];
}

/** How a delivery package could be executed (Topcoder challenges, dedicated team, or blended). */
export interface DeliveryPackagePlan extends ScopeGrouping {
  engagementModel: 'topcoder-challenge-series' | 'dedicated-team' | 'blended';
  suggestedChallengeTypes: string[];
}

export interface FunctionalScope {
  capabilities: Capability[];
  recommendedEnhancements: Capability[];
  modules: ScopeGrouping[];
  workstreams: ScopeGrouping[];
  deliveryPackages: DeliveryPackagePlan[];
  outOfScope: z.infer<typeof TracedStatementSchema>[];
}
