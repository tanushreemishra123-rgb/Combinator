import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  Difficulty,
  ExplanationLevel,
  LevelTrack,
  MissionProgressStatus,
} from '@ai-learning-adventure/types';
import {
  DIFFICULTY_SEQUENCE,
  LEVEL_TRACK_SEQUENCE,
  MISSION_STATUS_SEQUENCE,
  type MissionBrowserFilters,
  type MissionSort,
} from '@ai-learning-adventure/learner';
import type { RootState } from './index.ts';

export type MissionDisplay = 'map' | 'list';

export type MissionFilters = MissionBrowserFilters;

export interface PreferencesState {
  missionDisplay: MissionDisplay;
  filters: MissionFilters;
  sort: MissionSort;
  explanationLevelOverride?: ExplanationLevel;
  explainLikeNew: boolean;
  aiBannerDismissedForSession: boolean;
}

const initialState: PreferencesState = {
  missionDisplay: 'map',
  filters: { difficulties: [], tracks: [], statuses: [] },
  sort: 'track_order',
  explainLikeNew: false,
  aiBannerDismissedForSession: false,
};

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setMissionDisplay(state, action: PayloadAction<MissionDisplay>) {
      state.missionDisplay = action.payload;
    },
    toggleDifficulty(state, action: PayloadAction<Difficulty>) {
      state.filters.difficulties = toggleValue(state.filters.difficulties, action.payload);
    },
    toggleTrack(state, action: PayloadAction<LevelTrack>) {
      state.filters.tracks = toggleValue(state.filters.tracks, action.payload);
    },
    toggleStatus(state, action: PayloadAction<MissionProgressStatus>) {
      state.filters.statuses = toggleValue(state.filters.statuses, action.payload);
    },
    clearFilters(state) {
      state.filters = { difficulties: [], tracks: [], statuses: [] };
    },
    focusTrackFilter(state, action: PayloadAction<LevelTrack>) {
      state.missionDisplay = 'list';
      state.filters = { difficulties: [], tracks: [action.payload], statuses: [] };
    },
    setSort(state, action: PayloadAction<MissionSort>) {
      state.sort = action.payload;
    },
    setExplanationLevel(state, action: PayloadAction<ExplanationLevel | undefined>) {
      state.explanationLevelOverride = action.payload;
    },
    setExplainLikeNew(state, action: PayloadAction<boolean>) {
      state.explainLikeNew = action.payload;
    },
    dismissAiBanner(state) {
      state.aiBannerDismissedForSession = true;
    },
  },
});

export const {
  setMissionDisplay,
  toggleDifficulty,
  toggleTrack,
  toggleStatus,
  clearFilters,
  focusTrackFilter,
  setSort,
  setExplanationLevel,
  setExplainLikeNew,
  dismissAiBanner,
} = preferencesSlice.actions;

export function selectMissionFilters(state: RootState): MissionFilters {
  return state.preferences.filters;
}

export function selectMissionDisplay(state: RootState): MissionDisplay {
  return state.preferences.missionDisplay;
}

export function selectMissionSort(state: RootState): MissionSort {
  return state.preferences.sort;
}

export function selectExplanationPreference(state: RootState): ExplanationLevel {
  const { explanationLevelOverride, explainLikeNew } = state.preferences;
  if (explanationLevelOverride !== undefined) return explanationLevelOverride;
  return explainLikeNew ? 'simple' : 'standard';
}

export function selectExplainLikeNew(state: RootState): boolean {
  return state.preferences.explainLikeNew;
}

export function selectExplanationLevelOverride(state: RootState): ExplanationLevel | undefined {
  return state.preferences.explanationLevelOverride;
}

export function selectAiBannerDismissedForSession(state: RootState): boolean {
  return state.preferences.aiBannerDismissedForSession;
}

const PREFERENCES_STORAGE_KEY = 'learner-ui.preferences.v1';
const PREFERENCES_STORAGE_VERSION = 1;
const AI_BANNER_SESSION_STORAGE_KEY = 'learner-ui.ai-banner-dismissed.v1';

const MISSION_SORTS: readonly MissionSort[] = ['track_order', 'title', 'difficulty', 'progress'];

interface PersistedPreferences {
  version: number;
  missionDisplay?: unknown;
  filters?: unknown;
  sort?: unknown;
  explanationLevelOverride?: unknown;
  explainLikeNew?: unknown;
}

function filterValues<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => typeof item === 'string' && (allowed as readonly string[]).includes(item));
}

function parsePersistedPreferences(parsed: Partial<PersistedPreferences>): PreferencesState | undefined {
  const state = { ...initialState };
  let found = false;

  if (parsed.missionDisplay === 'map' || parsed.missionDisplay === 'list') {
    state.missionDisplay = parsed.missionDisplay;
    found = true;
  }
  if (parsed.sort !== undefined && (MISSION_SORTS as readonly string[]).includes(parsed.sort as string)) {
    state.sort = parsed.sort as MissionSort;
    found = true;
  }
  if (typeof parsed.filters === 'object' && parsed.filters !== null) {
    const filters = parsed.filters as Record<string, unknown>;
    state.filters = {
      difficulties: filterValues(filters.difficulties, DIFFICULTY_SEQUENCE),
      tracks: filterValues(filters.tracks, LEVEL_TRACK_SEQUENCE),
      statuses: filterValues(filters.statuses, MISSION_STATUS_SEQUENCE),
    };
    found = true;
  }
  if (parsed.explanationLevelOverride === 'simple' || parsed.explanationLevelOverride === 'standard' || parsed.explanationLevelOverride === 'deeper') {
    state.explanationLevelOverride = parsed.explanationLevelOverride;
    found = true;
  }
  if (typeof parsed.explainLikeNew === 'boolean') {
    state.explainLikeNew = parsed.explainLikeNew;
    found = true;
  }

  return found ? state : undefined;
}

export function loadPersistedPreferences(): PreferencesState | undefined {
  try {
    const aiBannerDismissedForSession = sessionStorage.getItem(AI_BANNER_SESSION_STORAGE_KEY) === 'true';
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return aiBannerDismissedForSession ? { ...initialState, aiBannerDismissedForSession } : undefined;
    const parsed = JSON.parse(raw) as Partial<PersistedPreferences> | null;
    if (!parsed || parsed.version !== PREFERENCES_STORAGE_VERSION) return undefined;
    const preferences = parsePersistedPreferences(parsed);
    return preferences === undefined
      ? aiBannerDismissedForSession ? { ...initialState, aiBannerDismissedForSession } : undefined
      : { ...preferences, aiBannerDismissedForSession };
  } catch {
    return undefined;
  }
}

export function persistPreferences(state: PreferencesState): void {
  try {
    const persisted: PersistedPreferences = {
      version: PREFERENCES_STORAGE_VERSION,
      missionDisplay: state.missionDisplay,
      filters: state.filters,
      sort: state.sort,
      explanationLevelOverride: state.explanationLevelOverride,
      explainLikeNew: state.explainLikeNew,
    };
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(persisted));
    if (state.aiBannerDismissedForSession) {
      sessionStorage.setItem(AI_BANNER_SESSION_STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(AI_BANNER_SESSION_STORAGE_KEY);
    }
  } catch {
    return;
  }
}
