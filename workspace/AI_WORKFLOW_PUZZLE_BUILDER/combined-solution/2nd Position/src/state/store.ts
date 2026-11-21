import { create } from 'zustand';
import { runWorkflow } from '../engine/engine';
import type {
  Checkpoint,
  FallbackUpgrade,
  HumanDecision,
  HumanPrompt,
  RunReport,
  StepStatus,
  TraceEvent,
  WorkflowStep,
} from '../engine/types';
import { clone, findStep, flattenSteps, hashWorkflow } from '../engine/util';
import { getKit, getPuzzle, PUZZLES } from '../puzzles';
import { callAnthropic } from '../providers/live';
import type { ReliabilityAssessment } from '../reliability/report';
import { assessRun } from '../reliability/report';
import type { InsertTarget } from './workflowOps';
import {
  applyFallbackUpgrade,
  applyRetryUpgrade,
  insertStep,
  moveStep,
  nudgeStep,
  removeStep,
  updateStep,
} from './workflowOps';

export interface PuzzleProgress {
  workflow: WorkflowStep[];
  criteriaMet: string[];
  solvedAt?: number;
  hintsRevealed: number;
  /** Learning-path milestones, used by the phase strip. */
  ranBaseline?: boolean;
  /** A chaos run that ended badly — the player has seen the workflow break. */
  sawFailure?: boolean;
  /** A chaos run that ended well — the repair actually held. */
  survivedChaos?: boolean;
}

/**
 * The reliability assessment of a finished run, kept with the score of the run
 * before it so the report can show a before → after delta. It is computed once,
 * against the workflow that actually ran, so later edits cannot drift the score.
 */
export interface ScoredRun {
  assessment: ReliabilityAssessment;
  previousScore?: number;
}

export interface Settings {
  pace: 'demo' | 'instant';
  liveEnabled: boolean;
  apiKey: string;
  model: string;
}

export type MobilePane = 'mission' | 'build' | 'trace' | 'score';

interface AppState {
  screen: { name: 'home' } | { name: 'puzzle'; puzzleId: string };
  progress: Record<string, PuzzleProgress>;
  scenariosOn: Record<string, string[]>;
  checkpoints: Record<string, Checkpoint | undefined>;
  reports: Record<string, RunReport | undefined>;
  scored: Record<string, ScoredRun | undefined>;
  selectedStepId: string | null;
  running: boolean;
  liveEvents: TraceEvent[];
  liveStatuses: Record<string, StepStatus>;
  humanGate: { prompt: HumanPrompt; resolve: (d: HumanDecision) => void } | null;
  toast: string | null;
  settings: Settings;
  settingsOpen: boolean;
  guideOpen: boolean;
  activeTab: 'trace' | 'report' | 'goals';
  /** Which single pane the narrow-screen layout is showing. */
  mobilePane: MobilePane;
  celebrate: boolean;

  openPuzzle: (id: string) => void;
  goHome: () => void;
  selectStep: (id: string | null) => void;
  setTab: (tab: 'trace' | 'report' | 'goals') => void;
  setMobilePane: (pane: MobilePane) => void;
  mutateWorkflow: (fn: (wf: WorkflowStep[]) => { next: WorkflowStep[]; error?: string }) => void;
  insertAt: (target: InsertTarget, step: WorkflowStep) => void;
  moveTo: (stepId: string, target: InsertTarget) => void;
  nudge: (stepId: string, direction: -1 | 1) => void;
  remove: (stepId: string) => void;
  patchStep: (stepId: string, patch: Partial<WorkflowStep>) => void;
  addRetry: (stepId: string, attempts: number) => void;
  addFallback: (stepId: string, fallback: FallbackUpgrade) => void;
  toggleScenario: (scenarioId: string) => void;
  resetPuzzle: () => void;
  revealSolution: () => void;
  revealHint: () => void;
  run: (resume?: boolean) => Promise<void>;
  abortRun: () => void;
  submitHuman: (decision: HumanDecision) => void;
  showToast: (message: string) => void;
  dismissToast: () => void;
  setSettingsOpen: (open: boolean) => void;
  setGuideOpen: (open: boolean) => void;
  /** Reviewer-guide jump: open a puzzle with scenarios armed and, optionally, a working workflow. */
  jumpTo: (puzzleId: string, scenarios: string[], useSolution: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  clearCelebration: () => void;
}

const STORAGE_KEY = 'workflow-puzzle-lab-v1';

/** Stable empty references for selectors (fresh literals would loop React). */
export const EMPTY_STEPS: WorkflowStep[] = [];
export const EMPTY_STRINGS: string[] = [];

interface PersistedState {
  progress: Record<string, PuzzleProgress>;
  scenariosOn: Record<string, string[]>;
  checkpoints: Record<string, Checkpoint | undefined>;
  settings: Settings;
}

function defaultProgress(): Record<string, PuzzleProgress> {
  const out: Record<string, PuzzleProgress> = {};
  for (const p of PUZZLES) {
    out[p.id] = { workflow: clone(p.initialWorkflow), criteriaMet: [], hintsRevealed: 0 };
  }
  return out;
}

/**
 * A saved workflow is only usable if every preset id it references still resolves
 * against the current puzzle definition. Stale state from an older build (or state
 * edited by hand) would otherwise throw mid-render, so it is discarded instead.
 */
function workflowIsLoadable(puzzleId: string, steps: unknown): boolean {
  if (!Array.isArray(steps)) return false;
  try {
    const kit = getKit(puzzleId);
    for (const step of flattenSteps(steps as WorkflowStep[])) {
      switch (step.kind) {
        case 'ai':
          kit.task(step.taskId);
          kit.provider(step.providerId);
          if (step.upgrades?.fallback?.type === 'provider') kit.provider(step.upgrades.fallback.providerId);
          if (step.upgrades?.fallback?.type === 'tool') kit.tool(step.upgrades.fallback.toolId);
          if (step.upgrades?.fallback?.type === 'default') kit.defaultValue(step.upgrades.fallback.defaultId);
          break;
        case 'tool':
          kit.tool(step.toolId);
          if (step.upgrades?.fallback?.type === 'tool') kit.tool(step.upgrades.fallback.toolId);
          if (step.upgrades?.fallback?.type === 'default') kit.defaultValue(step.upgrades.fallback.defaultId);
          break;
        case 'retrieval':
          kit.source(step.sourceId);
          break;
        case 'condition':
          kit.condition(step.conditionId);
          break;
        case 'transform':
          kit.transform(step.transformId);
          break;
        case 'validator':
          kit.schema(step.schemaId);
          if (step.defaultId) kit.defaultValue(step.defaultId);
          break;
        case 'human':
          if (step.schemaId) kit.schema(step.schemaId);
          break;
        default:
          break;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedState;
    if (!data.progress || !data.settings) return null;
    // Drop progress for puzzles that no longer exist, and any workflow whose preset
    // references have gone stale — a fresh starting workflow beats a crash.
    for (const [id, prog] of Object.entries(data.progress)) {
      if (!PUZZLES.some((p) => p.id === id) || !workflowIsLoadable(id, prog?.workflow)) {
        delete data.progress[id];
      }
    }
    return data;
  } catch {
    return null;
  }
}

function persist(state: AppState) {
  try {
    const snapshot: PersistedState = {
      progress: state.progress,
      scenariosOn: state.scenariosOn,
      checkpoints: state.checkpoints,
      settings: state.settings,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage unavailable (private mode etc.) — the app still works per-session.
  }
}

function reduceStatus(statuses: Record<string, StepStatus>, e: TraceEvent): Record<string, StepStatus> {
  const next = { ...statuses };
  switch (e.t) {
    case 'step-started':
      next[e.stepId] = 'running';
      break;
    case 'step-restored':
      next[e.stepId] = 'restored';
      break;
    case 'retry-scheduled':
      next[e.stepId] = 'retrying';
      break;
    case 'step-completed':
      next[e.stepId] = e.recovered ? 'recovered' : 'completed';
      break;
    case 'paused-for-human':
      next[e.stepId] = 'paused';
      break;
    case 'safe-stopped':
      next[e.stepId] = 'safe-stopped';
      break;
    case 'run-interrupted':
    case 'run-failed':
      next[e.stepId] = 'failed';
      break;
    default:
      break;
  }
  return next;
}

let abortController: AbortController | null = null;

export const useStore = create<AppState>((set, get) => {
  const persisted = loadPersisted();

  const withPersist = (partial: Partial<AppState>) => {
    set(partial);
    persist(get());
  };

  const applyMutation = (result: { next: WorkflowStep[]; error?: string }) => {
    const state = get();
    if (state.screen.name !== 'puzzle' || state.running) return;
    if (result.error) {
      set({ toast: result.error });
      return;
    }
    const pid = state.screen.puzzleId;
    const progress = { ...state.progress, [pid]: { ...state.progress[pid], workflow: result.next } };
    withPersist({ progress });
  };

  const currentWorkflow = (): WorkflowStep[] => {
    const state = get();
    if (state.screen.name !== 'puzzle') return [];
    return state.progress[state.screen.puzzleId].workflow;
  };

  return {
    screen: { name: 'home' },
    progress: persisted?.progress ? { ...defaultProgress(), ...persisted.progress } : defaultProgress(),
    scenariosOn: persisted?.scenariosOn ?? {},
    checkpoints: persisted?.checkpoints ?? {},
    reports: {},
    scored: {},
    selectedStepId: null,
    running: false,
    liveEvents: [],
    liveStatuses: {},
    humanGate: null,
    toast: null,
    settings: persisted?.settings ?? { pace: 'demo', liveEnabled: false, apiKey: '', model: 'claude-sonnet-5' },
    settingsOpen: false,
    guideOpen: false,
    activeTab: 'goals',
    mobilePane: 'mission',
    celebrate: false,

    openPuzzle: (id) =>
      set({
        screen: { name: 'puzzle', puzzleId: id },
        selectedStepId: null,
        liveEvents: [],
        liveStatuses: {},
        activeTab: 'goals',
        mobilePane: 'mission',
      }),
    goHome: () => {
      if (get().running) return;
      set({ screen: { name: 'home' }, selectedStepId: null });
    },
    selectStep: (id) => set({ selectedStepId: id }),
    setTab: (tab) => set({ activeTab: tab }),
    setMobilePane: (pane) => set({ mobilePane: pane }),

    mutateWorkflow: (fn) => applyMutation(fn(currentWorkflow())),
    insertAt: (target, step) => applyMutation(insertStep(currentWorkflow(), target, step)),
    moveTo: (stepId, target) => applyMutation(moveStep(currentWorkflow(), stepId, target)),
    nudge: (stepId, direction) => applyMutation(nudgeStep(currentWorkflow(), stepId, direction)),
    remove: (stepId) => {
      const before = currentWorkflow();
      const removed = findStep(before, stepId);
      applyMutation(removeStep(before, stepId));
      if (get().selectedStepId === stepId) set({ selectedStepId: null });
      // Puzzle-given steps (the AI call, tools, retrieval) are not on the block shelf,
      // so removing one is a dead end unless the player knows about Reset.
      const state = get();
      if (removed && !removed.locked && state.screen.name === 'puzzle' && !state.toast) {
        const shelf = getPuzzle(state.screen.puzzleId).palette;
        const readdable = shelf.some((e) => e.type === 'step' && e.make?.().kind === removed.kind);
        if (!readdable) {
          set({
            toast: `Removed “${removed.label}”. That block isn’t on the shelf — press ↺ Reset to restore the puzzle’s starting workflow.`,
          });
        }
      }
    },
    patchStep: (stepId, patch) => applyMutation({ next: updateStep(currentWorkflow(), stepId, patch) }),
    addRetry: (stepId, attempts) => applyMutation(applyRetryUpgrade(currentWorkflow(), stepId, attempts)),
    addFallback: (stepId, fallback) => applyMutation(applyFallbackUpgrade(currentWorkflow(), stepId, fallback)),

    toggleScenario: (scenarioId) => {
      const state = get();
      if (state.screen.name !== 'puzzle' || state.running) return;
      const pid = state.screen.puzzleId;
      const current = state.scenariosOn[pid] ?? [];
      const next = current.includes(scenarioId) ? current.filter((s) => s !== scenarioId) : [...current, scenarioId];
      withPersist({ scenariosOn: { ...state.scenariosOn, [pid]: next } });
    },

    resetPuzzle: () => {
      const state = get();
      if (state.screen.name !== 'puzzle' || state.running) return;
      const pid = state.screen.puzzleId;
      const puzzle = getPuzzle(pid);
      withPersist({
        progress: { ...state.progress, [pid]: { ...state.progress[pid], workflow: clone(puzzle.initialWorkflow) } },
        checkpoints: { ...state.checkpoints, [pid]: undefined },
        toast: 'Workflow reset to the puzzle’s starting layout.',
        selectedStepId: null,
        liveEvents: [],
        liveStatuses: {},
      });
    },

    revealSolution: () => {
      const state = get();
      if (state.screen.name !== 'puzzle' || state.running) return;
      const pid = state.screen.puzzleId;
      const puzzle = getPuzzle(pid);
      withPersist({
        progress: { ...state.progress, [pid]: { ...state.progress[pid], workflow: clone(puzzle.solution) } },
        checkpoints: { ...state.checkpoints, [pid]: undefined },
        toast: 'A known-good setup was applied. Enable the failure scenarios and run it!',
        selectedStepId: null,
      });
    },

    revealHint: () => {
      const state = get();
      if (state.screen.name !== 'puzzle') return;
      const pid = state.screen.puzzleId;
      const prog = state.progress[pid];
      const max = getPuzzle(pid).hints.length;
      if (prog.hintsRevealed >= max) return;
      withPersist({ progress: { ...state.progress, [pid]: { ...prog, hintsRevealed: prog.hintsRevealed + 1 } } });
    },

    run: async (resume = false) => {
      const state = get();
      if (state.screen.name !== 'puzzle' || state.running) return;
      const pid = state.screen.puzzleId;
      const kit = getKit(pid);
      const puzzle = kit.puzzle;
      const workflow = clone(state.progress[pid].workflow);
      const scenarios = resume
        ? (state.checkpoints[pid]?.scenarios ?? state.scenariosOn[pid] ?? [])
        : (state.scenariosOn[pid] ?? []);
      const checkpoint = resume ? state.checkpoints[pid] : undefined;
      if (resume && (!checkpoint || checkpoint.workflowHash !== hashWorkflow(workflow))) {
        set({ toast: 'The workflow changed since the checkpoint was saved — run it fresh instead.' });
        return;
      }

      const pending: Record<string, StepStatus> = {};
      for (const s of flattenSteps(workflow)) pending[s.id] = 'pending';

      abortController = new AbortController();
      set({ running: true, liveEvents: [], liveStatuses: pending, activeTab: 'trace', mobilePane: 'trace', humanGate: null });

      const live = state.settings.liveEnabled && state.settings.apiKey.trim().length > 0;
      try {
        const report = await runWorkflow({
          kit,
          workflow,
          sampleId: puzzle.samples[0].id,
          scenarios,
          mode: live ? 'live' : 'mock',
          pace: state.settings.pace,
          human: (prompt) => new Promise<HumanDecision>((resolve) => set({ humanGate: { prompt, resolve } })),
          onEvent: (e) => set((s) => ({ liveEvents: [...s.liveEvents, e], liveStatuses: reduceStatus(s.liveStatuses, e) })),
          checkpoint,
          liveCall: live ? (prompt, expectsJson) => callAnthropic({ apiKey: state.settings.apiKey, model: state.settings.model }, prompt, expectsJson) : undefined,
          signal: abortController.signal,
        });

        const after = get();
        const prog = after.progress[pid];
        const newlyMet = new Set(prog.criteriaMet);
        for (const c of puzzle.criteria) {
          if (c.test(report, workflow)) newlyMet.add(c.id);
        }
        const allMet = puzzle.criteria.every((c) => newlyMet.has(c.id));
        const justSolved = allMet && !prog.solvedAt;

        // Score against the workflow that actually ran, so later edits cannot
        // drift a finished run's score, and keep the prior score for the delta.
        const assessment = assessRun(puzzle, workflow, report);
        const previousScore = after.scored[pid]?.assessment.score;

        const endedWell =
          (report.status === 'completed' && report.finalOutputValid === true) || report.status === 'safe-stopped';
        const underChaos = scenarios.length > 0;

        withPersist({
          running: false,
          humanGate: null,
          reports: { ...after.reports, [pid]: report },
          scored: { ...after.scored, [pid]: { assessment, previousScore } },
          liveStatuses: report.stepStatuses,
          checkpoints: { ...after.checkpoints, [pid]: report.status === 'interrupted' ? report.checkpoint : undefined },
          progress: {
            ...after.progress,
            [pid]: {
              ...prog,
              criteriaMet: [...newlyMet],
              solvedAt: justSolved ? Date.now() : prog.solvedAt,
              ranBaseline: true,
              sawFailure: prog.sawFailure || (underChaos && !endedWell),
              survivedChaos: prog.survivedChaos || (underChaos && endedWell),
            },
          },
          activeTab: 'report',
          mobilePane: 'score',
          celebrate: justSolved,
        });
      } catch (err) {
        set({
          running: false,
          humanGate: null,
          toast: `Run crashed unexpectedly: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        abortController = null;
      }
    },

    abortRun: () => {
      abortController?.abort();
    },

    submitHuman: (decision) => {
      const gate = get().humanGate;
      if (!gate) return;
      set({ humanGate: null });
      gate.resolve(decision);
    },

    showToast: (message) => set({ toast: message }),
    dismissToast: () => set({ toast: null }),
    setSettingsOpen: (open) => set({ settingsOpen: open }),
    setGuideOpen: (open) => set({ guideOpen: open }),

    jumpTo: (puzzleId, scenarios, useSolution) => {
      const state = get();
      if (state.running) return;
      const puzzle = getPuzzle(puzzleId);
      const prog = state.progress[puzzleId];
      withPersist({
        screen: { name: 'puzzle', puzzleId },
        selectedStepId: null,
        liveEvents: [],
        liveStatuses: {},
        activeTab: 'goals',
        mobilePane: 'build',
        guideOpen: false,
        scenariosOn: { ...state.scenariosOn, [puzzleId]: scenarios },
        checkpoints: { ...state.checkpoints, [puzzleId]: undefined },
        progress: useSolution
          ? { ...state.progress, [puzzleId]: { ...prog, workflow: clone(puzzle.solution) } }
          : state.progress,
        toast: useSolution
          ? 'Loaded a known-good workflow with the scenario armed — press ▶ Run workflow.'
          : 'Scenario armed on the puzzle’s starting workflow — press ▶ Run workflow.',
      });
    },
    updateSettings: (patch) => withPersist({ settings: { ...get().settings, ...patch } }),
    clearCelebration: () => set({ celebrate: false }),
  };
});

/** Convenience selectors */
export function usePuzzleId(): string | null {
  return useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
}
