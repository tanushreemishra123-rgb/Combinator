import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MissionId, MissionStep } from '@ai-learning-adventure/types';
import type { RootState } from './index.ts';

export type LearnerView =
  | { kind: 'home' }
  | { kind: 'missions'; display: 'map' | 'list' }
  | { kind: 'mission'; missionId: MissionId; step: MissionStep }
  | { kind: 'quiz'; missionId: MissionId; attemptId: string }
  | { kind: 'flashcards'; mode: 'mission' | 'review'; missionId?: MissionId; topic?: string }
  | { kind: 'review' }
  | { kind: 'progress' }
  | { kind: 'ai-only'; missionId?: MissionId }
  | { kind: 'settings' };

export interface NavigationState {
  currentView: LearnerView;
  viewStack: LearnerView[];
  returnFocusId?: string;
}

const MAX_VIEW_STACK = 20;
const NAVIGATION_STORAGE_KEY = 'learner-ui.navigation.v1';
const NAVIGATION_STORAGE_VERSION = 1;

const HOME_VIEW: LearnerView = { kind: 'home' };

const MISSION_STEPS: readonly MissionStep[] = ['lesson', 'example', 'checkpoint', 'quiz', 'result'];

function isMissionStep(value: unknown): value is MissionStep {
  return typeof value === 'string' && (MISSION_STEPS as readonly string[]).includes(value);
}

export function sameView(a: LearnerView, b: LearnerView): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'missions':
      return b.kind === 'missions' && a.display === b.display;
    case 'mission':
      return b.kind === 'mission' && a.missionId === b.missionId && a.step === b.step;
    case 'quiz':
      return b.kind === 'quiz' && a.missionId === b.missionId && a.attemptId === b.attemptId;
    case 'flashcards':
      return (
        b.kind === 'flashcards' &&
        a.mode === b.mode &&
        (a.missionId ?? '') === (b.missionId ?? '') &&
        (a.topic ?? '') === (b.topic ?? '')
      );
    case 'ai-only':
      return b.kind === 'ai-only' && (a.missionId ?? '') === (b.missionId ?? '');
    default:
      return true;
  }
}

function parseView(value: unknown): LearnerView | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  switch (candidate.kind) {
    case 'home':
      return { kind: 'home' };
    case 'review':
      return { kind: 'review' };
    case 'progress':
      return { kind: 'progress' };
    case 'settings':
      return { kind: 'settings' };
    case 'missions':
      if (candidate.display === 'map' || candidate.display === 'list') {
        return { kind: 'missions', display: candidate.display };
      }
      return undefined;
    case 'mission':
      if (typeof candidate.missionId === 'string' && isMissionStep(candidate.step)) {
        return { kind: 'mission', missionId: candidate.missionId as MissionId, step: candidate.step };
      }
      return undefined;
    case 'quiz':
      if (typeof candidate.missionId === 'string' && typeof candidate.attemptId === 'string') {
        return { kind: 'quiz', missionId: candidate.missionId as MissionId, attemptId: candidate.attemptId };
      }
      return undefined;
    case 'flashcards': {
      if (candidate.mode !== 'mission' && candidate.mode !== 'review') return undefined;
      const missionId =
        typeof candidate.missionId === 'string' ? (candidate.missionId as MissionId) : undefined;
      const topic = typeof candidate.topic === 'string' ? candidate.topic : undefined;
      if (candidate.mode === 'mission' && missionId === undefined) return undefined;
      return { kind: 'flashcards', mode: candidate.mode, missionId, topic };
    }
    case 'ai-only': {
      const missionId =
        typeof candidate.missionId === 'string' ? (candidate.missionId as MissionId) : undefined;
      return { kind: 'ai-only', missionId };
    }
    default:
      return undefined;
  }
}

interface PersistedNavigation {
  version: number;
  currentView: unknown;
  viewStack: unknown[];
}

export function loadPersistedNavigationState(): NavigationState | undefined {
  try {
    const raw = sessionStorage.getItem(NAVIGATION_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<PersistedNavigation> | null;
    if (!parsed || parsed.version !== NAVIGATION_STORAGE_VERSION) return undefined;
    const currentView = parseView(parsed.currentView) ?? HOME_VIEW;
    const viewStack = Array.isArray(parsed.viewStack)
      ? parsed.viewStack
          .map(parseView)
          .filter((view): view is LearnerView => view !== undefined)
          .slice(-MAX_VIEW_STACK)
      : [];
    return { currentView, viewStack };
  } catch {
    return undefined;
  }
}

export function persistNavigationState(state: NavigationState): void {
  try {
    const persisted: PersistedNavigation = {
      version: NAVIGATION_STORAGE_VERSION,
      currentView: state.currentView,
      viewStack: state.viewStack.slice(-MAX_VIEW_STACK),
    };
    sessionStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    return;
  }
}

const initialState: NavigationState = {
  currentView: HOME_VIEW,
  viewStack: [],
};

export const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    navigate(state, action: PayloadAction<LearnerView>) {
      const next = action.payload;
      if (sameView(state.currentView, next)) return;
      state.viewStack.push(state.currentView);
      if (state.viewStack.length > MAX_VIEW_STACK) {
        state.viewStack.splice(0, state.viewStack.length - MAX_VIEW_STACK);
      }
      state.currentView = next;
      state.returnFocusId = undefined;
    },
    replaceView(state, action: PayloadAction<LearnerView>) {
      state.currentView = action.payload;
      state.returnFocusId = undefined;
    },
    goBack(state) {
      const previous = state.viewStack.pop();
      state.currentView = previous ?? HOME_VIEW;
    },
    goHome(state) {
      state.currentView = HOME_VIEW;
      state.viewStack = [];
      state.returnFocusId = undefined;
    },
    setReturnFocus(state, action: PayloadAction<string | undefined>) {
      state.returnFocusId = action.payload;
    },
  },
});

export const { navigate, replaceView, goBack, goHome, setReturnFocus } =
  navigationSlice.actions;

export function selectCurrentView(state: RootState): LearnerView {
  return state.navigation.currentView;
}

export function selectCanGoBack(state: RootState): boolean {
  return state.navigation.viewStack.length > 0;
}

export function selectActiveMissionId(state: RootState): MissionId | undefined {
  const view = state.navigation.currentView;
  if (view.kind === 'mission' || view.kind === 'quiz') return view.missionId;
  if ((view.kind === 'flashcards' || view.kind === 'ai-only') && view.missionId !== undefined) {
    return view.missionId;
  }
  return undefined;
}

export function selectIsAiOnlyMode(state: RootState): boolean {
  return state.navigation.currentView.kind === 'ai-only';
}

export function selectReturnFocusId(state: RootState): string | undefined {
  return state.navigation.returnFocusId;
}
