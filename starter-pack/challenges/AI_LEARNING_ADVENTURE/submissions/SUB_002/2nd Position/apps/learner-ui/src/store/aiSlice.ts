import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AiContextPacket,
  AiContextTarget,
  AiOnlyWalkthroughStep,
  AiProviderConfigMeta,
  AiProviderConnectionStatus,
  AiProviderSafeError,
  AiStructuredOutput,
  MissionId,
} from '@ai-learning-adventure/types';
import type { RootState } from './index.ts';

export type AiConversationKey = string;

export function inlineTutorKey(missionId: MissionId): AiConversationKey {
  return `inline:${missionId}`;
}

export type AiOnlyScope =
  | { kind: 'general' }
  | { kind: 'mission'; missionId: MissionId };

export function aiOnlyConversationKey(scope: AiOnlyScope): AiConversationKey {
  switch (scope.kind) {
    case 'mission':
      return `ai-only:mission:${scope.missionId}`;
    default:
      return 'ai-only:general';
  }
}

export type AiProviderAvailabilityStatus = AiProviderConnectionStatus;

export interface AiProviderStatus {
  status: AiProviderAvailabilityStatus;
  message?: string;
  checkedAt?: string;
}

export type AiMessageRole = 'user' | 'assistant';
export type AiMessageStatus = 'pending' | 'streaming' | 'complete' | 'stopped' | 'error';

export interface AiMessage {
  id: string;
  role: AiMessageRole;
  text: string;
  status: AiMessageStatus;
  isMock: boolean;
  label?: string;
  error?: string;
  createdAt: string;
  sourceMissionIds: MissionId[];
  context?: AiContextTarget;
  safety?: { redirected: boolean; uncertain: boolean; hintLeakChecked: boolean };
  structured?: AiStructuredOutput;
  providerError?: AiProviderSafeError;
}

export interface AiConversationState {
  key: AiConversationKey;
  messages: AiMessage[];
}

export type AiRequestStatus = 'idle' | 'running' | 'error';

export interface AiRequestState {
  status: AiRequestStatus;
  requestId?: string;
  error?: string;
}

export interface InlineTutorState {
  open: boolean;
  missionId?: MissionId;
  context?: AiContextPacket;
  triggerId?: string;
}

export interface WalkthroughPosition {
  missionId: MissionId;
  currentStep: AiOnlyWalkthroughStep;
  furthestStep: AiOnlyWalkthroughStep;
  status: 'active' | 'complete';
}

export interface AiSliceState {
  providerConfigMeta?: AiProviderConfigMeta;
  providerStatus: AiProviderStatus;
  inlinePanel: InlineTutorState;
  conversations: Record<string, AiConversationState>;
  requests: Record<string, AiRequestState>;
  aiOnlyScope: AiOnlyScope;
  aiOnlyDrafts: Record<string, string>;
  aiOnlyRailCollapsed: boolean;
  walkthroughPositions: Record<string, WalkthroughPosition>;
  reviewTopics: string[];
}

export interface OpenTutorPayload {
  missionId?: MissionId;
  context?: AiContextPacket;
  triggerId?: string;
}

export interface AppendUserMessagePayload {
  key: AiConversationKey;
  message: AiMessage;
}

export interface BeginAssistantMessagePayload {
  key: AiConversationKey;
  requestId: string;
  message: AiMessage;
}

export interface AppendAssistantTokenPayload {
  key: AiConversationKey;
  messageId: string;
  token: string;
  requestId?: string;
}

export interface CompleteAssistantMessagePayload {
  key: AiConversationKey;
  messageId: string;
  requestId?: string;
  isMock?: boolean;
  label?: string;
  sourceMissionIds?: MissionId[];
  safety?: { redirected: boolean; uncertain: boolean; hintLeakChecked: boolean };
  structured?: AiStructuredOutput;
  providerError?: AiProviderSafeError;
  text?: string;
}

export interface FailAssistantMessagePayload {
  key: AiConversationKey;
  messageId: string;
  error: string;
  requestId?: string;
}

export interface StopAssistantMessagePayload {
  key: AiConversationKey;
  messageId: string;
}

const initialState: AiSliceState = {
  providerStatus: { status: 'not_configured', message: 'AI setup is required for personalized responses.' },
  inlinePanel: { open: false },
  conversations: {},
  requests: {},
  aiOnlyScope: { kind: 'general' },
  aiOnlyDrafts: {},
  aiOnlyRailCollapsed: false,
  walkthroughPositions: {},
  reviewTopics: [],
};

function findMessage(
  state: AiSliceState,
  key: AiConversationKey,
  messageId: string,
): AiMessage | undefined {
  const conversation = state.conversations[key] /* nosemgrep: gitlab.eslint.detect-object-injection */;
  if (!conversation) return undefined;
  return conversation.messages.find((message) => message.id === messageId);
}

export const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    setProviderConfigMeta(state, action: PayloadAction<AiProviderConfigMeta | undefined>) {
      state.providerConfigMeta = action.payload;
    },
    setProviderStatus(state, action: PayloadAction<AiProviderStatus>) {
      state.providerStatus = action.payload;
    },
    openTutor(state, action: PayloadAction<OpenTutorPayload | undefined>) {
      state.inlinePanel.open = true;
      if (action.payload !== undefined) {
        state.inlinePanel.missionId = action.payload.missionId;
        state.inlinePanel.context = action.payload.context;
        state.inlinePanel.triggerId = action.payload.triggerId;
      }
    },
    closeTutor(state) {
      state.inlinePanel.open = false;
    },
    setTutorContext(state, action: PayloadAction<AiContextPacket | undefined>) {
      state.inlinePanel.context = action.payload;
    },
    appendUserMessage(state, action: PayloadAction<AppendUserMessagePayload>) {
      const { key, message } = action.payload;
      if (!state.conversations[key] /* nosemgrep: gitlab.eslint.detect-object-injection */) {
        state.conversations[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = { key, messages: [] };
      }
      state.conversations[key] /* nosemgrep: gitlab.eslint.detect-object-injection */?.messages.push(message);
    },
    beginAssistantMessage(state, action: PayloadAction<BeginAssistantMessagePayload>) {
      const { key, requestId, message } = action.payload;
      if (!state.conversations[key] /* nosemgrep: gitlab.eslint.detect-object-injection */) {
        state.conversations[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = { key, messages: [] };
      }
      state.conversations[key] /* nosemgrep: gitlab.eslint.detect-object-injection */?.messages.push(message);
      state.requests[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = { status: 'running', requestId };
    },
    appendAssistantToken(state, action: PayloadAction<AppendAssistantTokenPayload>) {
      const { key, messageId, token, requestId } = action.payload;
      if (requestId !== undefined && state.requests[key] /* nosemgrep: gitlab.eslint.detect-object-injection */?.requestId !== requestId) return;
      const message = findMessage(state, key, messageId);
       if (!message || message.status === 'complete' || message.status === 'stopped' || message.status === 'error') return;
      message.text += token;
      message.status = 'streaming';
    },
    completeAssistantMessage(state, action: PayloadAction<CompleteAssistantMessagePayload>) {
      const { key, messageId, requestId, isMock, label, sourceMissionIds, safety, structured, providerError, text } = action.payload;
      if (requestId !== undefined && state.requests[key] /* nosemgrep: gitlab.eslint.detect-object-injection */?.requestId !== requestId) return;
      const message = findMessage(state, key, messageId);
      if (!message) return;
      message.status = 'complete';
      if (isMock !== undefined) message.isMock = isMock;
      if (label !== undefined) message.label = label;
      if (sourceMissionIds !== undefined) message.sourceMissionIds = sourceMissionIds;
      if (safety !== undefined) message.safety = safety;
      if (structured !== undefined) message.structured = structured;
      if (providerError !== undefined) message.providerError = providerError;
      if (text !== undefined) message.text = text;
      state.requests[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = { status: 'idle' };
    },
    stopAssistantMessage(state, action: PayloadAction<StopAssistantMessagePayload>) {
      const { key, messageId } = action.payload;
      const message = findMessage(state, key, messageId);
      if (message !== undefined && (message.status === 'streaming' || message.status === 'pending')) {
        message.status = 'stopped';
      }
      state.requests[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = { status: 'idle' };
    },
    failAssistantMessage(state, action: PayloadAction<FailAssistantMessagePayload>) {
      const { key, messageId, error, requestId } = action.payload;
      if (requestId !== undefined && state.requests[key] /* nosemgrep: gitlab.eslint.detect-object-injection */?.requestId !== requestId) return;
      const message = findMessage(state, key, messageId);
      if (message) {
        message.status = 'error';
        message.error = error;
      }
      state.requests[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = { status: 'error', error };
    },
    setAiOnlyScope(state, action: PayloadAction<AiOnlyScope>) {
      state.aiOnlyScope = action.payload;
    },
    setAiOnlyDraft(state, action: PayloadAction<{ key: AiConversationKey; draft: string }>) {
      if (action.payload.draft.length === 0) {
        delete state.aiOnlyDrafts[action.payload.key] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      } else {
        state.aiOnlyDrafts[action.payload.key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = action.payload.draft;
      }
    },
    setAiOnlyRailCollapsed(state, action: PayloadAction<boolean>) {
      state.aiOnlyRailCollapsed = action.payload;
    },
    setWalkthroughPosition(state, action: PayloadAction<WalkthroughPosition>) {
      state.walkthroughPositions[action.payload.missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */ = action.payload;
    },
    clearWalkthroughPosition(state, action: PayloadAction<MissionId>) {
      delete state.walkthroughPositions[action.payload] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    },
    addReviewTopics(state, action: PayloadAction<string[]>) {
      for (const topic of action.payload) {
        const normalized = topic.trim();
        if (normalized.length > 0 && !state.reviewTopics.includes(normalized)) {
          state.reviewTopics.push(normalized);
        }
      }
    },
    clearReviewTopics(state) {
      state.reviewTopics = [];
    },
    clearAiSession(state) {
      state.inlinePanel = { open: false };
      state.conversations = {};
      state.requests = {};
      state.reviewTopics = [];
      state.aiOnlyScope = { kind: 'general' };
      state.aiOnlyDrafts = {};
      state.aiOnlyRailCollapsed = false;
      state.walkthroughPositions = {};
    },
    clearConversation(state, action: PayloadAction<AiConversationKey>) {
      delete state.conversations[action.payload] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      delete state.requests[action.payload] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    },
  },
});

export const {
  setProviderConfigMeta,
  setProviderStatus,
  openTutor,
  closeTutor,
  setTutorContext,
  appendUserMessage,
  beginAssistantMessage,
  appendAssistantToken,
  completeAssistantMessage,
  stopAssistantMessage,
  failAssistantMessage,
  setAiOnlyScope,
  setAiOnlyDraft,
  setAiOnlyRailCollapsed,
  setWalkthroughPosition,
  clearWalkthroughPosition,
  addReviewTopics,
  clearReviewTopics,
  clearAiSession,
  clearConversation,
} = aiSlice.actions;

export interface AiAvailabilityModel {
  status: AiProviderAvailabilityStatus;
  configured: boolean;
  isLive: boolean;
  isMock: boolean;
  message?: string;
}

export const selectAiAvailability = createSelector(
  [
    (state: RootState) => state.ai.providerStatus,
    (state: RootState) => state.ai.providerConfigMeta,
  ],
  (providerStatus, providerConfigMeta): AiAvailabilityModel => ({
    status: providerStatus.status,
    configured: providerConfigMeta?.configured ?? false,
    isLive: providerStatus.status === 'connected',
    isMock: providerStatus.status !== 'connected',
    message: providerStatus.message,
  }),
);

export function selectProviderConfigMeta(state: RootState): AiProviderConfigMeta | undefined {
  return state.ai.providerConfigMeta;
}

export function selectTutorContext(state: RootState): AiContextPacket | undefined {
  return state.ai.inlinePanel.context;
}

export function selectInlineTutorOpen(state: RootState): boolean {
  return state.ai.inlinePanel.open;
}

export function selectInlineTutorMissionId(state: RootState): MissionId | undefined {
  return state.ai.inlinePanel.missionId;
}

export function selectInlineTutorTriggerId(state: RootState): string | undefined {
  return state.ai.inlinePanel.triggerId;
}

export function selectConversation(key: AiConversationKey) {
  return (state: RootState): AiConversationState | undefined => state.ai.conversations[key] /* nosemgrep: gitlab.eslint.detect-object-injection */;
}

const IDLE_REQUEST: AiRequestState = { status: 'idle' };

export function selectAiRequestState(key: AiConversationKey) {
  return (state: RootState): AiRequestState => state.ai.requests[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? IDLE_REQUEST;
}

export function selectAiOnlyScope(state: RootState): AiOnlyScope {
  return state.ai.aiOnlyScope;
}

export function selectAiOnlyDraft(key: AiConversationKey) {
  return (state: RootState): string => state.ai.aiOnlyDrafts[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? '';
}

export function selectAiOnlyRailCollapsed(state: RootState): boolean {
  return state.ai.aiOnlyRailCollapsed;
}

export function selectWalkthroughPosition(missionId: MissionId) {
  return (state: RootState): WalkthroughPosition | undefined =>
    state.ai.walkthroughPositions[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
}

export function selectAiReviewTopics(state: RootState): string[] {
  return state.ai.reviewTopics;
}

export function selectShouldShowAiBanner(state: RootState): boolean {
  if (state.preferences.aiBannerDismissedForSession) return false;
  return state.ai.providerStatus.status !== 'connected';
}

const AI_SESSION_STORAGE_KEY = 'learner-ui.ai-session.v1';
const AI_SESSION_STORAGE_VERSION = 1;
const MAX_PERSISTED_CONVERSATIONS = 12;
const MAX_PERSISTED_MESSAGES = 40;
const MAX_PERSISTED_MESSAGE_LENGTH = 6000;

interface PersistedAiSession {
  version: number;
  aiOnlyScope: AiOnlyScope;
  aiOnlyDrafts: Record<string, string>;
  aiOnlyRailCollapsed: boolean;
  walkthroughPositions: Record<string, WalkthroughPosition>;
  conversations: Record<string, AiConversationState>;
}

function parseScope(value: unknown): AiOnlyScope | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'general') return { kind: 'general' };
  if (candidate.kind === 'mission' && typeof candidate.missionId === 'string') {
    return { kind: 'mission', missionId: candidate.missionId as MissionId };
  }
  return undefined;
}

function parseMessage(value: unknown): AiMessage | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    (candidate.role !== 'user' && candidate.role !== 'assistant') ||
    typeof candidate.text !== 'string' ||
    typeof candidate.createdAt !== 'string'
  ) {
    return undefined;
  }
  const status = candidate.status;
  const parsedStatus: AiMessageStatus =
    status === 'complete' || status === 'stopped' || status === 'error'
      ? status
      : 'stopped';
  const sourceMissionIds = Array.isArray(candidate.sourceMissionIds)
    ? candidate.sourceMissionIds.filter((id): id is MissionId => typeof id === 'string')
    : [];
  const safety =
    typeof candidate.safety === 'object' && candidate.safety !== null
      ? candidate.safety as AiMessage['safety']
      : undefined;
    const structured =
    typeof candidate.structured === 'object' && candidate.structured !== null
      ? candidate.structured as AiStructuredOutput
      : undefined;
  const providerError =
    typeof candidate.providerError === 'object' && candidate.providerError !== null
      ? candidate.providerError as AiProviderSafeError
      : undefined;
  return {
    id: candidate.id,
    role: candidate.role,
    text: candidate.text.slice(0, MAX_PERSISTED_MESSAGE_LENGTH),
    status: parsedStatus,
    isMock: candidate.isMock === true,
    ...(typeof candidate.label === 'string' ? { label: candidate.label } : {}),
    ...(typeof candidate.error === 'string' ? { error: candidate.error } : {}),
    createdAt: candidate.createdAt,
    sourceMissionIds,
    ...(safety !== undefined ? { safety } : {}),
    ...(structured !== undefined ? { structured } : {}),
    ...(providerError !== undefined ? { providerError } : {}),
  };
}

function parseWalkthroughPosition(value: unknown): WalkthroughPosition | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  const steps: readonly string[] = ['objective', 'lesson', 'example', 'checkpoint'];
  if (
    typeof candidate.missionId !== 'string' ||
    typeof candidate.currentStep !== 'string' ||
    !steps.includes(candidate.currentStep) ||
    typeof candidate.furthestStep !== 'string' ||
    !steps.includes(candidate.furthestStep) ||
    (candidate.status !== 'active' && candidate.status !== 'complete')
  ) {
    return undefined;
  }
  return {
    missionId: candidate.missionId as MissionId,
    currentStep: candidate.currentStep as AiOnlyWalkthroughStep,
    furthestStep: candidate.furthestStep as AiOnlyWalkthroughStep,
    status: candidate.status,
  };
}

export function loadPersistedAiSession(): AiSliceState | undefined {
  try {
    const raw = sessionStorage.getItem(AI_SESSION_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<PersistedAiSession> | null;
    if (parsed === null || parsed.version !== AI_SESSION_STORAGE_VERSION) return undefined;
    const scope = parseScope(parsed.aiOnlyScope) ?? { kind: 'general' as const };
    const conversations: Record<string, AiConversationState> = {};
    if (typeof parsed.conversations === 'object' && parsed.conversations !== null) {
      for (const [key, value] of Object.entries(parsed.conversations).slice(-MAX_PERSISTED_CONVERSATIONS)) {
        if (!key.startsWith('ai-only:') || typeof value !== 'object' || value === null) continue;
        const messagesValue = (value as unknown as Record<string, unknown>).messages;
        const messages = Array.isArray(messagesValue)
          ? messagesValue.map(parseMessage).filter((message): message is AiMessage => message !== undefined).slice(-MAX_PERSISTED_MESSAGES)
          : [];
        conversations[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = { key, messages };
      }
    }
    const walkthroughPositions: Record<string, WalkthroughPosition> = {};
    if (typeof parsed.walkthroughPositions === 'object' && parsed.walkthroughPositions !== null) {
      for (const value of Object.values(parsed.walkthroughPositions)) {
        const position = parseWalkthroughPosition(value);
        if (position !== undefined) walkthroughPositions[position.missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */ = position;
      }
    }
    const aiOnlyDrafts: Record<string, string> = {};
    if (typeof parsed.aiOnlyDrafts === 'object' && parsed.aiOnlyDrafts !== null) {
      for (const [key, value] of Object.entries(parsed.aiOnlyDrafts)) {
        if (key.startsWith('ai-only:') && typeof value === 'string' && value.length > 0) {
          aiOnlyDrafts[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = value.slice(0, MAX_PERSISTED_MESSAGE_LENGTH);
        }
      }
    }
    return {
      ...initialState,
      aiOnlyScope: scope,
      aiOnlyDrafts,
      aiOnlyRailCollapsed: parsed.aiOnlyRailCollapsed === true,
      walkthroughPositions,
      conversations,
    };
  } catch {
    return undefined;
  }
}

export function persistAiSession(state: AiSliceState): void {
  try {
    const conversations = Object.fromEntries(
      Object.entries(state.conversations)
        .filter(([key]) => key.startsWith('ai-only:'))
        .slice(-MAX_PERSISTED_CONVERSATIONS)
        .map(([key, conversation]) => [
          key,
          {
            key,
            messages: conversation.messages.slice(-MAX_PERSISTED_MESSAGES).map((message) => ({
              ...message,
              text: message.text.slice(0, MAX_PERSISTED_MESSAGE_LENGTH),
              status:
                message.status === 'pending' || message.status === 'streaming'
                  ? 'stopped'
                  : message.status,
              context: undefined,
            })),
          },
        ]),
    );
    const persisted: PersistedAiSession = {
      version: AI_SESSION_STORAGE_VERSION,
      aiOnlyScope: state.aiOnlyScope,
      aiOnlyDrafts: state.aiOnlyDrafts,
      aiOnlyRailCollapsed: state.aiOnlyRailCollapsed,
      walkthroughPositions: state.walkthroughPositions,
      conversations,
    };
    sessionStorage.setItem(AI_SESSION_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    return;
  }
}
