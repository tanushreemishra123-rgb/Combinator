/** Factories for empty session structures (shared by the state layer, tests and importers). */
import type { CustomerContext, EstimationConfig, SolutionConfig } from './config';
import type { ScopingSession, SectionState, SessionOutputs } from './session';

export function emptySection<T>(): SectionState<T> {
  return { data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [] };
}

export function emptyOutputs(): SessionOutputs {
  return {
    prd: emptySection(),
    architecture: emptySection(),
    dataIntegration: emptySection(),
    aiStrategy: emptySection(),
    estimate: emptySection(),
  };
}

export function emptyCustomerContext(): CustomerContext {
  return { customerName: '', industry: '', opportunityName: '', region: '', engagementType: '', notes: '' };
}

export interface NewSessionInput {
  id: string;
  name: string;
  now: string;
  config: SolutionConfig;
  estimationConfig: EstimationConfig;
}

export function createSession(input: NewSessionInput): ScopingSession {
  return {
    id: input.id,
    name: input.name,
    createdAt: input.now,
    updatedAt: input.now,
    customer: emptyCustomerContext(),
    input: { rawText: '', documents: [], normalized: null, scenarioId: null },
    scope: null,
    config: input.config,
    estimationConfig: input.estimationConfig,
    outputs: emptyOutputs(),
    changeLog: [],
    quality: null,
    executiveSummary: '',
  };
}
