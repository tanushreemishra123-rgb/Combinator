import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MissionId, MissionStep } from '@ai-learning-adventure/types';
import {
  furthestStepOf,
  stepRank,
  type CheckpointDraft,
  type CheckpointOutcome,
} from '@ai-learning-adventure/learner';
import type { RootState } from './index.ts';

export type { CheckpointDraft, CheckpointOutcome };

export interface CheckpointSubmission {
  outcome: CheckpointOutcome;
  submittedAt: string;
}

export interface MissionSessionState {
  missionId: MissionId;
  currentStep: MissionStep;
  furthestStep: MissionStep;
  visitedSteps: MissionStep[];
  checkpointDraft?: CheckpointDraft;
  checkpointSubmission?: CheckpointSubmission;
  lastTouchedAt: string;
}

export interface MissionSessionsState {
  sessions: Record<string, MissionSessionState>;
}

export interface StartMissionPayload {
  missionId: MissionId;
  initialStep?: MissionStep;
  startedAt: string;
}

export interface SetMissionStepPayload {
  missionId: MissionId;
  step: MissionStep;
  touchedAt: string;
}

export interface SaveCheckpointDraftPayload {
  missionId: MissionId;
  draft: CheckpointDraft;
  touchedAt: string;
}

export interface SubmitCheckpointLocalPayload {
  missionId: MissionId;
  outcome: CheckpointOutcome;
  submittedAt: string;
}

const initialState: MissionSessionsState = {
  sessions: {},
};

export const missionSessionSlice = createSlice({
  name: 'missionSession',
  initialState,
  reducers: {
    startMission(state, action: PayloadAction<StartMissionPayload>) {
      const { missionId, initialStep, startedAt } = action.payload;
      const existing = state.sessions[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      const step = initialStep ?? 'lesson';
      const visitedSteps = existing ? [...existing.visitedSteps] : [];
      if (!visitedSteps.includes(step)) visitedSteps.push(step);
      state.sessions[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */ = {
        missionId,
        currentStep: step,
        furthestStep: existing ? furthestStepOf(existing.furthestStep, step) : step,
        visitedSteps,
        checkpointDraft: existing?.checkpointDraft,
        checkpointSubmission: existing?.checkpointSubmission,
        lastTouchedAt: startedAt,
      };
    },
    setMissionStep(state, action: PayloadAction<SetMissionStepPayload>) {
      const session = state.sessions[action.payload.missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (!session) return;
      const { step, touchedAt } = action.payload;
      session.currentStep = step;
      session.furthestStep = furthestStepOf(session.furthestStep, step);
      if (!session.visitedSteps.includes(step)) session.visitedSteps.push(step);
      session.lastTouchedAt = touchedAt;
    },
    saveCheckpointDraft(state, action: PayloadAction<SaveCheckpointDraftPayload>) {
      const session = state.sessions[action.payload.missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (!session) return;
      session.checkpointDraft = action.payload.draft;
      session.lastTouchedAt = action.payload.touchedAt;
    },
    submitCheckpointLocal(state, action: PayloadAction<SubmitCheckpointLocalPayload>) {
      const session = state.sessions[action.payload.missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (!session) return;
      session.checkpointSubmission = {
        outcome: action.payload.outcome,
        submittedAt: action.payload.submittedAt,
      };
      if (!session.visitedSteps.includes('checkpoint')) session.visitedSteps.push('checkpoint');
      session.lastTouchedAt = action.payload.submittedAt;
    },
    resetCheckpointSubmission(state, action: PayloadAction<MissionId>) {
      const session = state.sessions[action.payload] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (!session) return;
      session.checkpointSubmission = undefined;
    },
    clearMissionSession(state, action: PayloadAction<MissionId>) {
      delete state.sessions[action.payload] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    },
    clearAllMissionSessions(state) {
      state.sessions = {};
    },
  },
});

export const {
  startMission,
  setMissionStep,
  saveCheckpointDraft,
  submitCheckpointLocal,
  resetCheckpointSubmission,
  clearMissionSession,
  clearAllMissionSessions,
} = missionSessionSlice.actions;

export function selectMissionSession(missionId: MissionId) {
  return (state: RootState): MissionSessionState | undefined =>
    state.missionSession.sessions[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
}

export function selectCanOpenStep(missionId: MissionId, step: MissionStep) {
  return (state: RootState): boolean => {
    const session = state.missionSession.sessions[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    if (!session) return step === 'lesson';
    return stepRank(step) <= stepRank(session.furthestStep);
  };
}

export function selectCheckpointComplete(missionId: MissionId) {
  return (state: RootState): boolean => {
    const session = state.missionSession.sessions[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    if (!session || !session.checkpointSubmission) return false;
    return session.checkpointSubmission.outcome !== 'incorrect';
  };
}
