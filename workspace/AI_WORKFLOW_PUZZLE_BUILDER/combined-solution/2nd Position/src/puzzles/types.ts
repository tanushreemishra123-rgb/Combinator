import type { ZodType } from 'zod';
import type {
  FailureInfo,
  RetrievedDoc,
  RunContext,
  RunReport,
  WorkflowStep,
} from '../engine/types';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

// ---------------------------------------------------------------------------
// Presets — every configurable value a block can reference lives in the
// puzzle definition, so workflows stay plain serializable data.
// ---------------------------------------------------------------------------

export interface ProviderPreset {
  id: string;
  name: string;
  blurb: string;
  tier: 'primary' | 'fallback';
}

/** Everything a model call can deterministically produce in mock mode. */
export type ModelOutcome =
  | { type: 'ok'; value: unknown; note?: string }
  | { type: 'error'; failure: FailureInfo }
  | { type: 'interrupt'; message: string };

export interface ModelRequest {
  taskId: string;
  providerId: string;
  /** 1-based attempt number for this step within the current run. */
  attempt: number;
  scenarios: ReadonlySet<string>;
  ctx: RunContext;
  /** True when this run resumed from a checkpoint. */
  resumed: boolean;
}

export interface TaskPreset {
  id: string;
  name: string;
  description: string;
  expectsJson: boolean;
  /** Deterministic mock behaviour, scripted per scenario and attempt. */
  mock: (req: ModelRequest) => ModelOutcome;
  /** Prompt builder for the optional live AI provider. */
  livePrompt?: (ctx: RunContext) => string;
}

export interface ToolRequest {
  toolId: string;
  attempt: number;
  scenarios: ReadonlySet<string>;
  ctx: RunContext;
  resumed: boolean;
}

export interface ToolPreset {
  id: string;
  name: string;
  description: string;
  /** Simulated tools only — deterministic, no network. */
  mock: (req: ToolRequest) => ModelOutcome;
}

export interface SourcePreset {
  id: string;
  name: string;
  description: string;
  search: (query: unknown, topK: number, scenarios: ReadonlySet<string>) => RetrievedDoc[];
}

export interface SchemaPreset {
  id: string;
  name: string;
  /** Human-readable rules shown in the block inspector. */
  rules: string[];
  schema: ZodType;
  /**
   * Deterministic repair: fix what can be fixed mechanically (strip code
   * fences, coerce types, fill safe placeholders). Returns null when the
   * value is beyond repair.
   */
  repair?: (value: unknown) => { value: unknown; notes: string[] } | null;
}

export interface ConditionPreset {
  id: string;
  name: string;
  description: string;
  test: (ctx: RunContext) => { pass: boolean; reason: string };
}

export interface TransformPreset {
  id: string;
  name: string;
  description: string;
  apply: (ctx: RunContext) => unknown;
}

export interface DefaultPreset {
  id: string;
  name: string;
  description: string;
  value: unknown;
}

export interface SampleInput {
  id: string;
  label: string;
  value: unknown;
  /** Pretty rendering for the run panel. */
  preview: string;
}

// ---------------------------------------------------------------------------
// Failure scenarios and completion criteria
// ---------------------------------------------------------------------------

export type Countermeasure = 'retry' | 'fallback' | 'validator' | 'human' | 'condition' | 'safestop';

export interface FailureScenario {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** What in the workflow this scenario attacks, for the reliability lint. */
  attacks: string;
  /** Countermeasures that can absorb this scenario (any one is enough). */
  counteredBy: Countermeasure[];
}

export interface Criterion {
  id: string;
  label: string;
  /** Extra explanation shown under the label. */
  detail: string;
  test: (report: RunReport, workflow: WorkflowStep[]) => boolean;
}

// ---------------------------------------------------------------------------
// Palette — which blocks the player may add in a given puzzle.
// ---------------------------------------------------------------------------

export interface PaletteEntry {
  id: string;
  /** 'upgrade-retry' / 'upgrade-fallback' attach to a step instead of inserting. */
  type: 'step' | 'upgrade-retry' | 'upgrade-fallback';
  name: string;
  emoji: string;
  blurb: string;
  /** Factory for a fresh step instance (steps only). */
  make?: () => WorkflowStep;
  /** Fallback spec attached on drop (upgrade-fallback only). */
  fallback?: { type: 'provider'; providerId: string } | { type: 'tool'; toolId: string } | { type: 'default'; defaultId: string };
  /** Maximum instances allowed in the workflow (steps only). */
  maxInstances?: number;
}

// ---------------------------------------------------------------------------
// The puzzle itself
// ---------------------------------------------------------------------------

export interface Puzzle {
  id: string;
  order: number;
  title: string;
  emoji: string;
  difficulty: Difficulty;
  tagline: string;
  objective: string;
  learning: string[];
  expected: { description: string; schemaId?: string };
  samples: SampleInput[];
  providers: ProviderPreset[];
  tasks: TaskPreset[];
  tools: ToolPreset[];
  sources: SourcePreset[];
  schemas: SchemaPreset[];
  conditions: ConditionPreset[];
  transforms: TransformPreset[];
  defaults: DefaultPreset[];
  palette: PaletteEntry[];
  initialWorkflow: WorkflowStep[];
  failureScenarios: FailureScenario[];
  criteria: Criterion[];
  hints: string[];
  /** A known-good workflow used by "reveal a working setup" and by tests. */
  solution: WorkflowStep[];
  /** Scenario ids the solution is verified against (all enabled at once unless split). */
  solutionScenarioSets: string[][];
}

/** Convenience lookups used by the engine and the UI. */
export interface PuzzleKit {
  puzzle: Puzzle;
  provider: (id: string) => ProviderPreset;
  task: (id: string) => TaskPreset;
  tool: (id: string) => ToolPreset;
  source: (id: string) => SourcePreset;
  schema: (id: string) => SchemaPreset;
  condition: (id: string) => ConditionPreset;
  transform: (id: string) => TransformPreset;
  defaultValue: (id: string) => DefaultPreset;
  sample: (id: string) => SampleInput;
}

export function makeKit(puzzle: Puzzle): PuzzleKit {
  const find = <T extends { id: string }>(list: T[], id: string, what: string): T => {
    const hit = list.find((x) => x.id === id);
    if (!hit) throw new Error(`Unknown ${what} preset "${id}" in puzzle "${puzzle.id}"`);
    return hit;
  };
  return {
    puzzle,
    provider: (id) => find(puzzle.providers, id, 'provider'),
    task: (id) => find(puzzle.tasks, id, 'task'),
    tool: (id) => find(puzzle.tools, id, 'tool'),
    source: (id) => find(puzzle.sources, id, 'source'),
    schema: (id) => find(puzzle.schemas, id, 'schema'),
    condition: (id) => find(puzzle.conditions, id, 'condition'),
    transform: (id) => find(puzzle.transforms, id, 'transform'),
    defaultValue: (id) => find(puzzle.defaults, id, 'default'),
    sample: (id) => find(puzzle.samples, id, 'sample input'),
  };
}
