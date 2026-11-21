import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import {
  aiSlice,
  loadPersistedAiSession,
  persistAiSession,
  type AiSliceState,
} from './aiSlice.ts';
import {
  loadPersistedFlashcardSession,
  flashcardSessionSlice,
  persistFlashcardSession,
} from './flashcardSessionSlice.ts';
import {
  loadPersistedNavigationState,
  navigationSlice,
  persistNavigationState,
  type NavigationState,
} from './navigationSlice.ts';
import { missionSessionSlice } from './missionSessionSlice.ts';
import {
  loadPersistedPreferences,
  persistPreferences,
  preferencesSlice,
  type PreferencesState,
} from './preferencesSlice.ts';
import { progressProjectionSlice } from './progressProjectionSlice.ts';
import { loadPersistedQuizSession, persistQuizSession, quizSessionSlice } from './quizSessionSlice.ts';

const rootReducer = combineReducers({
  navigation: navigationSlice.reducer,
  preferences: preferencesSlice.reducer,
  missionSession: missionSessionSlice.reducer,
  quizSession: quizSessionSlice.reducer,
  flashcardSession: flashcardSessionSlice.reducer,
  progressProjection: progressProjectionSlice.reducer,
  ai: aiSlice.reducer,
});

export type AppStore = ReturnType<typeof createAppStore>;

export interface CreateAppStoreOptions {
  navigation?: NavigationState;
  preferences?: PreferencesState;
  ai?: AiSliceState;
}

export function createAppStore(options: CreateAppStoreOptions = {}) {
  const navigation = options.navigation ?? loadPersistedNavigationState();
  const preferences = options.preferences ?? loadPersistedPreferences();
  const quizSession = loadPersistedQuizSession();
  const flashcardSession = loadPersistedFlashcardSession();
  const ai = options.ai ?? loadPersistedAiSession();
  const preloadedState = {
    ...rootReducer(undefined, { type: '@@learner-ui/init' }),
    ...(navigation !== undefined ? { navigation } : {}),
    ...(preferences !== undefined ? { preferences } : {}),
    ...(quizSession !== undefined ? { quizSession } : {}),
    ...(flashcardSession !== undefined ? { flashcardSession } : {}),
    ...(ai !== undefined ? { ai } : {}),
  };

  const appStore = configureStore({
    reducer: rootReducer,
    preloadedState,
  });

  let lastNavigation = appStore.getState().navigation;
  let lastPreferences = appStore.getState().preferences;
  let lastQuizSession = appStore.getState().quizSession;
  let lastFlashcardSession = appStore.getState().flashcardSession;
  let lastAi = appStore.getState().ai;
  appStore.subscribe(() => {
    const state = appStore.getState();
    if (state.navigation !== lastNavigation) {
      lastNavigation = state.navigation;
      persistNavigationState(state.navigation);
    }
    if (state.preferences !== lastPreferences) {
      lastPreferences = state.preferences;
      persistPreferences(state.preferences);
    }
    if (state.quizSession !== lastQuizSession) {
      lastQuizSession = state.quizSession;
      persistQuizSession(state.quizSession);
    }
    if (state.flashcardSession !== lastFlashcardSession) {
      lastFlashcardSession = state.flashcardSession;
      persistFlashcardSession(state.flashcardSession);
    }
    if (state.ai !== lastAi) {
      lastAi = state.ai;
      persistAiSession(state.ai);
    }
  });

  return appStore;
}

export const store = createAppStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
