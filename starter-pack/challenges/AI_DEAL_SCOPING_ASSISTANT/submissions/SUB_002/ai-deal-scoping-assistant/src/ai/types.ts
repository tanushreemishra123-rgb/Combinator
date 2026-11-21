/**
 * Contract between the AI orchestration layer, the providers (mock or live) and the feature
 * stages. A provider only ever returns raw text; the orchestrator parses and validates it against
 * the task's Zod schema, so mock and live output travel through exactly the same checks.
 */
import type { z } from 'zod';
import type {
  ArchitectureComponent,
  AiUseCase,
  Capability,
  ChangeDescriptor,
  CloudPlatform,
  CloudServiceCatalogEntry,
  CustomerContext,
  GenerationMeta,
  ImpactEntry,
  IntegrationSpec,
  NormalizedDocument,
  ScopeModel,
  SolutionConfig,
  UnaffectedEntry,
} from '../domain';

export type AiTaskId =
  | 'analyze-requirements'
  | 'generate-prd'
  | 'design-architecture'
  | 'plan-data-integration'
  | 'plan-ai-solution'
  | 'suggest-estimate-inputs'
  | 'explain-change-impact'
  | 'summarize-package';

export interface AnalyzeContext {
  task: 'analyze-requirements';
  document: NormalizedDocument;
  customer: CustomerContext;
  scenarioId: string | null;
}

/** Shared by every downstream task: generation is grounded in the *reviewed* scope model. */
interface ReviewedScopeContext {
  scope: ScopeModel;
  customer: CustomerContext;
  config: SolutionConfig;
}

export interface PrdContext extends ReviewedScopeContext {
  task: 'generate-prd';
}

export interface ArchitectureContext extends ReviewedScopeContext {
  task: 'design-architecture';
  platform: CloudPlatform;
  catalog: CloudServiceCatalogEntry[];
  capabilities: Capability[];
}

export interface DataIntegrationContext extends ReviewedScopeContext {
  task: 'plan-data-integration';
  platform: CloudPlatform;
  components: ArchitectureComponent[];
}

export interface AiSolutionContext extends ReviewedScopeContext {
  task: 'plan-ai-solution';
  platform: CloudPlatform;
  components: ArchitectureComponent[];
}

export interface EstimateContext extends ReviewedScopeContext {
  task: 'suggest-estimate-inputs';
  capabilities: Capability[];
  components: ArchitectureComponent[];
  integrations: IntegrationSpec[];
  aiUseCases: AiUseCase[];
}

export interface ImpactContext {
  task: 'explain-change-impact';
  change: ChangeDescriptor;
  affected: ImpactEntry[];
  unaffected: UnaffectedEntry[];
}

export interface SummaryContext extends ReviewedScopeContext {
  task: 'summarize-package';
  /** Pre-computed facts (platform, coverage, effort, ROM, confidence) the summary may cite. */
  facts: { label: string; value: string }[];
}

export type AiTaskContext =
  | AnalyzeContext
  | PrdContext
  | ArchitectureContext
  | DataIntegrationContext
  | AiSolutionContext
  | EstimateContext
  | ImpactContext
  | SummaryContext;

export interface PromptParts {
  system: string;
  prompt: string;
}

export interface AiRequest extends PromptParts {
  context: AiTaskContext;
}

export interface AiProvider {
  id: string;
  label: string;
  mode: 'mock' | 'live';
  /** Returns the raw model text (JSON for structured tasks). Rejects with AiProviderError. */
  complete(request: AiRequest): Promise<string>;
}

export type AiErrorKind = 'auth' | 'rate-limit' | 'network' | 'timeout' | 'invalid-response' | 'provider';

export class AiProviderError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = 'AiProviderError';
    this.kind = kind;
  }
}

/** A structured AI task: how to prompt for it and the schema its output must satisfy. */
export interface TaskDefinition<C extends AiTaskContext, T> {
  id: C['task'];
  label: string;
  schema: z.ZodType<T>;
  buildPrompt(context: C): PromptParts;
}

export interface TaskRunOptions {
  provider: AiProvider;
  /** Clearly-labelled mock fallback used only when a live call fails; null disables fallback. */
  fallback: AiProvider | null;
  scopeVersion: number;
}

export interface TaskResult<T> {
  value: T;
  meta: GenerationMeta;
}
