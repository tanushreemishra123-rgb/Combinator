/**
 * Runs one generation stage against a session snapshot and returns the updated snapshot - the same
 * call sequence for mock and live mode. Pure with respect to the store: callers thread the returned
 * session through the next stage and decide when to save, so a multi-stage run never depends on
 * state that React has not committed yet.
 */
import type { TaskRunOptions } from '../../ai';
import { generateArchitecture } from '../../architecture';
import { STAGES } from '../../domain';
import type { GenerationMeta, OutputSectionId, ScopeModel, ScopingSession, SectionState, SessionOutputs, SolutionConfig } from '../../domain';
import { generateEstimate } from '../../estimation';
import { markSectionsResolved } from '../../impact';
import { generatePrd } from '../../prd';
import { generateAiStrategy, generateDataIntegration } from '../../strategy';
import { stagePrerequisite } from '../stageRules';
import type { StageId } from '../types';
import { UseCaseError } from './support';

/** Dependency order of the pipeline: PRD -> architecture -> data/integration -> AI approach -> estimate. */
export const STAGE_ORDER: readonly StageId[] = STAGES.map((stage) => stage.id);

const BUSY_LABELS: ReadonlyMap<StageId, string> = new Map([
  ['prd', 'Generating the PRD...'],
  ['architecture', 'Designing the solution...'],
  ['dataIntegration', 'Planning the data flow...'],
  ['aiStrategy', 'Selecting the AI approach...'],
  ['estimate', 'Estimating the delivery...'],
]);

/** Busy label in the wording of the spec's journey steps. */
export function busyLabelFor(stageId: StageId): string {
  return BUSY_LABELS.get(stageId) ?? 'Generating...';
}

export function stageLabel(stageId: StageId): string {
  return STAGES.find((stage) => stage.id === stageId)?.label ?? stageId;
}

/** Output sections owned by a stage - what a regeneration resolves on the change log. */
export function sectionsOf(stageId: StageId): OutputSectionId[] {
  return [...(STAGES.find((stage) => stage.id === stageId)?.sections ?? [])];
}

export interface StageRun {
  session: ScopingSession;
  meta: GenerationMeta;
}

interface StageWrite {
  outputs: SessionOutputs;
  config: SolutionConfig;
  meta: GenerationMeta;
}

/** A freshly generated section is current and unreviewed: review is per generated version. */
function current<T>(data: T, meta: GenerationMeta): SectionState<T> {
  return { data, status: 'current', reviewed: false, meta, staleReasons: [] };
}

function required<T>(data: T | null, message: string): T {
  if (data === null) {
    throw new UseCaseError(message);
  }
  return data;
}

async function runPrd(session: ScopingSession, scope: ScopeModel, run: TaskRunOptions): Promise<StageWrite> {
  const { bundle, meta } = await generatePrd({ scope, customer: session.customer, config: session.config }, run);
  return { outputs: { ...session.outputs, prd: current(bundle, meta) }, config: session.config, meta };
}

/**
 * An AI-recommended platform is written back to the configuration so later stages and the quality
 * gate read one platform. It is the assistant's own recommendation, not a reviewer change, so it
 * is saved without an impact report.
 */
async function runArchitecture(session: ScopingSession, scope: ScopeModel, run: TaskRunOptions): Promise<StageWrite> {
  const prd = required(session.outputs.prd.data, 'Generate the PRD before designing the solution.');
  const input = { scope, customer: session.customer, config: session.config, capabilities: prd.functionalScope.capabilities };
  const { design, meta } = await generateArchitecture(input, run);
  const adoptsRecommendation = design.selection === 'ai-recommended' && session.config.cloudPlatform !== design.platform;
  const config = adoptsRecommendation ? { ...session.config, cloudPlatform: design.platform } : session.config;
  return { outputs: { ...session.outputs, architecture: current(design, meta) }, config, meta };
}

async function runDataIntegration(session: ScopingSession, scope: ScopeModel, run: TaskRunOptions): Promise<StageWrite> {
  const design = required(session.outputs.architecture.data, 'Design the solution before planning the data flow.');
  const { plan, meta } = await generateDataIntegration({ scope, customer: session.customer, config: session.config, design }, run);
  return { outputs: { ...session.outputs, dataIntegration: current(plan, meta) }, config: session.config, meta };
}

async function runAiStrategy(session: ScopingSession, scope: ScopeModel, run: TaskRunOptions): Promise<StageWrite> {
  const design = required(session.outputs.architecture.data, 'Design the solution before selecting the AI approach.');
  const { strategy, meta } = await generateAiStrategy({ scope, customer: session.customer, config: session.config, design }, run);
  return { outputs: { ...session.outputs, aiStrategy: current(strategy, meta) }, config: session.config, meta };
}

/** A reviewer's complexity overrides survive regeneration; the stage drops those whose driver is gone. */
async function runEstimate(session: ScopingSession, scope: ScopeModel, run: TaskRunOptions): Promise<StageWrite> {
  const { outputs } = session;
  const input = {
    scope,
    customer: session.customer,
    config: session.config,
    estimationConfig: session.estimationConfig,
    prd: required(outputs.prd.data, 'Generate the PRD before estimating the delivery.'),
    design: required(outputs.architecture.data, 'Design the solution before estimating the delivery.'),
    dataIntegration: required(outputs.dataIntegration.data, 'Plan the data flow before estimating the delivery.'),
    aiStrategy: required(outputs.aiStrategy.data, 'Select the AI approach before estimating the delivery.'),
    overrides: outputs.estimate.data?.overrides ?? [],
  };
  const { bundle, meta } = await generateEstimate(input, run);
  return { outputs: { ...outputs, estimate: current(bundle, meta) }, config: session.config, meta };
}

function runStageEntry(session: ScopingSession, scope: ScopeModel, stageId: StageId, run: TaskRunOptions): Promise<StageWrite> {
  switch (stageId) {
    case 'prd':
      return runPrd(session, scope, run);
    case 'architecture':
      return runArchitecture(session, scope, run);
    case 'dataIntegration':
      return runDataIntegration(session, scope, run);
    case 'aiStrategy':
      return runAiStrategy(session, scope, run);
    case 'estimate':
      return runEstimate(session, scope, run);
  }
}

/**
 * Generates one stage. Only that stage's `SectionState` is replaced - every other stage object is
 * carried over by reference. The refreshed sections are marked resolved on the change log, and the
 * quality report and executive summary (both describe the previous package) are cleared.
 */
export async function runStage(session: ScopingSession, stageId: StageId, run: TaskRunOptions): Promise<StageRun> {
  const prerequisite = stagePrerequisite(session, stageId);
  if (prerequisite !== null || session.scope === null) {
    throw new UseCaseError(prerequisite ?? 'Analyze the customer requirements first.');
  }
  const write = await runStageEntry(session, session.scope, stageId, run);
  const generated: ScopingSession = { ...session, config: write.config, outputs: write.outputs, quality: null, executiveSummary: '' };
  return { session: markSectionsResolved(generated, sectionsOf(stageId)), meta: write.meta };
}
