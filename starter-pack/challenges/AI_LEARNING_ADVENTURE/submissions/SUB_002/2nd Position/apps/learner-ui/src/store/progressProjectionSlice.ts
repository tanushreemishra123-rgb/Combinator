import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AwardId,
  LevelTrack,
  MissionId,
  MissionProgressStatus,
  ProgressProjection,
} from '@ai-learning-adventure/types';
import { compareLevelTracks } from '@ai-learning-adventure/learner';
import type { RootState } from './index.ts';

export type WeakTopicSignal = ProgressProjection['weakTopics'][number];
const EMPTY_WEAK_TOPICS: WeakTopicSignal[] = [];

export interface ProgressProjectionState {
  projection?: ProgressProjection;
  missionStatuses: Record<string, MissionProgressStatus>;
  earnedAwardIds: AwardId[];
  pendingMutationIds: string[];
  lastAwardQueue: AwardId[];
  levelUpTo?: LevelTrack;
  hydrated: boolean;
}

export interface HydrateProjectionPayload {
  projection: ProgressProjection;
  missionStatuses?: Record<string, MissionProgressStatus>;
  earnedAwardIds?: AwardId[];
}

export interface ApplyOptimisticProgressPayload {
  mutationId: string;
  projection: ProgressProjection;
  missionStatus?: { missionId: MissionId; status: MissionProgressStatus };
}

export interface ConfirmMutationPayload {
  mutationId: string;
}

export interface RollbackMutationPayload {
  mutationId: string;
  projection?: ProgressProjection;
}

const initialState: ProgressProjectionState = {
  missionStatuses: {},
  earnedAwardIds: [],
  pendingMutationIds: [],
  lastAwardQueue: [],
  hydrated: false,
};

export const progressProjectionSlice = createSlice({
  name: 'progressProjection',
  initialState,
  reducers: {
    hydrateProjection(state, action: PayloadAction<HydrateProjectionPayload>) {
      const { projection, missionStatuses, earnedAwardIds } = action.payload;
      if (state.hydrated && state.projection !== undefined) {
        const previousLevel = state.projection.currentLevel;
        if (compareLevelTracks(projection.currentLevel, previousLevel) > 0) {
          state.levelUpTo = projection.currentLevel;
        }
        if (earnedAwardIds !== undefined) {
          const known = new Set<string>(state.earnedAwardIds as string[]);
          for (const awardId of earnedAwardIds) {
            if (known.has(awardId)) continue;
            if (!state.lastAwardQueue.includes(awardId)) state.lastAwardQueue.push(awardId);
          }
        }
      }
      state.hydrated = true;
      state.projection = projection;
      if (missionStatuses !== undefined) state.missionStatuses = missionStatuses;
      if (earnedAwardIds !== undefined) state.earnedAwardIds = earnedAwardIds;
    },
    applyOptimisticProgress(state, action: PayloadAction<ApplyOptimisticProgressPayload>) {
      const { mutationId, projection, missionStatus } = action.payload;
      if (!state.pendingMutationIds.includes(mutationId)) {
        state.pendingMutationIds.push(mutationId);
      }
      state.projection = projection;
      if (missionStatus !== undefined) {
        state.missionStatuses[missionStatus.missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */ = missionStatus.status;
      }
    },
    confirmMutation(state, action: PayloadAction<ConfirmMutationPayload>) {
      state.pendingMutationIds = state.pendingMutationIds.filter(
        (id) => id !== action.payload.mutationId,
      );
    },
    rollbackMutation(state, action: PayloadAction<RollbackMutationPayload>) {
      state.pendingMutationIds = state.pendingMutationIds.filter(
        (id) => id !== action.payload.mutationId,
      );
      if (action.payload.projection !== undefined) {
        state.projection = action.payload.projection;
      }
    },
    enqueueAwards(state, action: PayloadAction<AwardId[]>) {
      for (const awardId of action.payload) {
        if (!state.lastAwardQueue.includes(awardId)) state.lastAwardQueue.push(awardId);
        if (!state.earnedAwardIds.includes(awardId)) state.earnedAwardIds.push(awardId);
      }
    },
    dequeueAward(state) {
      state.lastAwardQueue.shift();
    },
    dismissLevelUp(state) {
      state.levelUpTo = undefined;
    },
    clearProjection() {
      return initialState;
    },
  },
});

export const {
  hydrateProjection,
  applyOptimisticProgress,
  confirmMutation,
  rollbackMutation,
  enqueueAwards,
  dequeueAward,
  dismissLevelUp,
  clearProjection,
} = progressProjectionSlice.actions;

export function selectProjection(state: RootState): ProgressProjection | undefined {
  return state.progressProjection.projection;
}

export function selectCompletionPercent(state: RootState): number {
  return state.progressProjection.projection?.completionPercent ?? 0;
}

export function selectCurrentLevel(state: RootState): LevelTrack {
  return state.progressProjection.projection?.currentLevel ?? 'beginner';
}

export function selectEarnedAwardCount(state: RootState): number {
  return state.progressProjection.earnedAwardIds.length;
}

export function selectMissionProjectionStatus(missionId: MissionId) {
  return (state: RootState): MissionProgressStatus | undefined =>
    state.progressProjection.missionStatuses[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
}

export function selectBestScore(missionId: MissionId) {
  return (state: RootState): number | undefined =>
    state.progressProjection.projection?.bestScoreByMission[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
}

export function selectLatestScore(missionId: MissionId) {
  return (state: RootState): number | undefined =>
    state.progressProjection.projection?.latestScoreByMission[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
}

export function selectWeakTopics(state: RootState): WeakTopicSignal[] {
  return state.progressProjection.projection?.weakTopics ?? EMPTY_WEAK_TOPICS;
}

export function selectNextAwardDialog(state: RootState): AwardId | undefined {
  return state.progressProjection.lastAwardQueue[0];
}

export function selectLevelUpTo(state: RootState): LevelTrack | undefined {
  return state.progressProjection.levelUpTo;
}

export function selectHasPendingMutations(state: RootState): boolean {
  return state.progressProjection.pendingMutationIds.length > 0;
}
