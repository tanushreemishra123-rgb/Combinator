import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  AiContextPacket,
  AiContextTarget,
  AiResult,
  AiStructuredOutput,
  AiTaskRequest,
  CatalogDto,
  MissionDetail,
  MissionId,
  ProgressProjection,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';
import {
  boundAiConversationHistory,
  buildAiOnlyContext,
  deriveMissionAvailability,
  deriveProgressProjection,
  explanationLevelForTrack,
} from '@ai-learning-adventure/learner';
import { useAiTask } from '../../../hooks/useAiTask.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';
import { useStartMission } from '../../../hooks/useStartMission.ts';
import {
  aiOnlyConversationKey,
  appendAssistantToken,
  appendUserMessage,
  beginAssistantMessage,
  clearConversation,
  completeAssistantMessage,
  failAssistantMessage,
  selectAiAvailability,
  selectAiOnlyDraft,
  selectAiOnlyScope,
  selectAiRequestState,
  selectConversation,
  setAiOnlyDraft,
  setAiOnlyScope,
  stopAssistantMessage,
  type AiMessage,
  type AiOnlyScope,
} from '../../../store/aiSlice.ts';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import {
  selectExplainLikeNew,
  selectExplanationLevelOverride,
} from '../../../store/preferencesSlice.ts';
import { usePublishedMissionDetails } from './usePublishedMissionDetails.ts';

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function targetForContext(context: AiContextPacket): AiContextTarget {
  if (context.question !== undefined) {
    return {
      kind: 'quiz_question',
      missionId: context.question.missionId,
      questionId: context.question.id,
    };
  }
  if (context.checkpoint !== undefined && context.mission !== undefined) {
    return {
      kind: 'checkpoint',
      missionId: context.mission.id,
      checkpointKind: context.checkpoint.kind,
    };
  }
  if (context.mission !== undefined) {
    return {
      kind: 'mission_step',
      missionId: context.mission.id,
      step: context.step ?? 'lesson',
    };
  }
  return {
    kind: 'content_scope',
    missionIds: (context.sourceMissions ?? []).map((mission) => mission.id),
  };
}

export interface AiOnlySendOptions {
  task?: AiTaskRequest['task'];
  context?: AiContextPacket;
  learnerAnswer?: string;
  selectedOptionIds?: string[];
  answerOutcome?: 'correct' | 'incorrect';
  authoredExplanation?: string;
  conceptTags?: string[];
  hintLevel?: 1 | 2 | 3;
  correctOptionTexts?: string[];
  structured?: AiStructuredOutput;
  explanationLevel?: AiTaskRequest['explanationLevel'];
}

export interface AiOnlyMissionChoice {
  id: MissionId;
  title: string;
  levelTrack: CatalogDto['missions'][number]['levelTrack'];
  locked: boolean;
  prerequisiteTitle?: string;
}

export interface UseAiOnlySessionResult {
  scope: AiOnlyScope;
  key: string;
  messages: AiMessage[];
  draft: string;
  missionChoices: AiOnlyMissionChoice[];
  missions: MissionDetail[];
  selectedMission?: MissionDetail;
  projection: ProgressProjection;
  busy: boolean;
  isLoadingContent: boolean;
  contentError?: string;
  availability: ReturnType<typeof selectAiAvailability>;
  setScope: (scope: AiOnlyScope, starterDraft?: string) => void;
  setDraft: (draft: string) => void;
  send: (message: string, options?: AiOnlySendOptions) => Promise<AiResult | undefined>;
  stop: () => void;
  clearMessages: () => void;
  openSource: (missionId: MissionId) => void;
  refreshContent: () => void;
}

export function useAiOnlySession(input: {
  initialMissionId?: MissionId;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}): UseAiOnlySessionResult {
  const { initialMissionId, catalog, progress } = input;
  const dispatch = useAppDispatch();
  const { replace } = useAppNavigation();
  const explanationLevelOverride = useAppSelector(selectExplanationLevelOverride);
  const explainLikeNew = useAppSelector(selectExplainLikeNew);
  const scope = useAppSelector(selectAiOnlyScope);
  const availability = useAppSelector(selectAiAvailability);
  const details = usePublishedMissionDetails(catalog);
  const projection = useMemo(
    () => deriveProgressProjection(catalog, progress),
    [catalog, progress],
  );
  const key = aiOnlyConversationKey(scope);
  const conversation = useAppSelector(selectConversation(key));
  const requestState = useAppSelector(selectAiRequestState(key));
  const draft = useAppSelector(selectAiOnlyDraft(key));
  const aiTask = useAiTask();
  const { openMission } = useStartMission(progress);
  const activeRef = useRef<
    { key: string; messageId: string; requestId: string } | undefined
  >(undefined);

  const missionChoices = useMemo(
    () =>
      deriveMissionAvailability(catalog, progress).map(({ mission, state, prerequisite }) => ({
        id: mission.id,
        title: mission.title,
        levelTrack: mission.levelTrack,
        locked: state === 'locked',
        ...(state === 'locked' && prerequisite !== undefined
          ? { prerequisiteTitle: prerequisite.title }
          : {}),
      })),
    [catalog, progress],
  );
  const selectedMission =
    scope.kind === 'mission'
      ? details.missions.find((mission) => mission.id === scope.missionId)
      : undefined;

  useEffect(() => {
    if (initialMissionId === undefined) return;
    if (!catalog.missions.some((mission) => mission.id === initialMissionId)) {
      dispatch(setAiOnlyScope({ kind: 'general' }));
      replace({ kind: 'ai-only' });
      return;
    }
    if (scope.kind !== 'mission' || scope.missionId !== initialMissionId) {
      dispatch(setAiOnlyScope({ kind: 'mission', missionId: initialMissionId }));
    }
  }, [catalog.missions, dispatch, initialMissionId, replace, scope]);

  useEffect(() => {
    if (
      scope.kind === 'mission' &&
      !catalog.missions.some((mission) => mission.id === scope.missionId)
    ) {
      dispatch(setAiOnlyScope({ kind: 'general' }));
      replace({ kind: 'ai-only' });
    }
  }, [catalog.missions, dispatch, replace, scope]);

  const stop = useCallback(() => {
    const active = activeRef.current;
    if (active === undefined) return;
    aiTask.cancel();
    dispatch(
      stopAssistantMessage({ key: active.key, messageId: active.messageId }),
    );
    activeRef.current = undefined;
    announceLive('Tutor response stopped.');
  }, [aiTask, dispatch]);

  const changeScope = useCallback(
    (nextScope: AiOnlyScope, starterDraft?: string) => {
      if (nextScope.kind === 'mission') {
        const choice = missionChoices.find((mission) => mission.id === nextScope.missionId);
        if (choice === undefined || choice.locked) return;
      }
      stop();
      dispatch(setAiOnlyScope(nextScope));
      if (starterDraft !== undefined) {
        dispatch(
          setAiOnlyDraft({
            key: aiOnlyConversationKey(nextScope),
            draft: starterDraft,
          }),
        );
      }
      replace({
        kind: 'ai-only',
        ...(nextScope.kind === 'mission' ? { missionId: nextScope.missionId } : {}),
      });
      const label =
        nextScope.kind === 'general'
          ? 'All missions'
          : catalog.missions.find((mission) => mission.id === nextScope.missionId)?.title ??
            'Mission';
      announceLive(`AI learning scope changed to ${label}.`);
    },
    [catalog.missions, dispatch, missionChoices, replace, stop],
  );

  const send = useCallback(
    async (
      message: string,
      options: AiOnlySendOptions = {},
    ): Promise<AiResult | undefined> => {
      const text = message.trim();
      if (
        text.length === 0 ||
        requestState.status === 'running' ||
        details.isLoading ||
        details.missions.length === 0
      ) {
        return undefined;
      }
      const requestId = makeId('request');
      const messageId = makeId('assistant');
      const context =
        options.context ??
        buildAiOnlyContext({
          missions: details.missions,
          progress: projection,
          ...(scope.kind === 'mission' ? { missionId: scope.missionId } : {}),
          query: text,
        });
      const target = targetForContext(context);
      const userMessage: AiMessage = {
        id: makeId('user'),
        role: 'user',
        text,
        status: 'complete',
        isMock: false,
        createdAt: new Date().toISOString(),
        sourceMissionIds: [],
        context: target,
      };
      const assistantMessage: AiMessage = {
        id: messageId,
        role: 'assistant',
        text: '',
        status: 'pending',
        isMock: false,
        createdAt: new Date().toISOString(),
        sourceMissionIds: [],
        context: target,
      };
      const history = boundAiConversationHistory(
        (conversation?.messages ?? [])
          .filter((item) => item.status === 'complete')
          .map(({ role, text: turnText }) => ({ role, text: turnText })),
      );
      dispatch(appendUserMessage({ key, message: userMessage }));
      dispatch(beginAssistantMessage({ key, requestId, message: assistantMessage }));
      dispatch(setAiOnlyDraft({ key, draft: '' }));
      activeRef.current = { key, messageId, requestId };

      const request: AiTaskRequest = {
        task: options.task ?? 'chat',
        message: text,
        explanationLevel:
          options.explanationLevel ??
          (explainLikeNew
            ? 'simple'
            : explanationLevelOverride ??
              explanationLevelForTrack(context.mission?.levelTrack ?? projection.currentLevel)),
        context,
        conversation: history,
        ...(options.learnerAnswer !== undefined
          ? { learnerAnswer: options.learnerAnswer }
          : {}),
        ...(options.selectedOptionIds !== undefined
          ? { selectedOptionIds: options.selectedOptionIds }
          : {}),
        ...(options.answerOutcome !== undefined
          ? { answerOutcome: options.answerOutcome }
          : {}),
        ...(options.authoredExplanation !== undefined
          ? { authoredExplanation: options.authoredExplanation }
          : {}),
        ...(options.conceptTags !== undefined ? { conceptTags: options.conceptTags } : {}),
        ...(options.hintLevel !== undefined ? { hintLevel: options.hintLevel } : {}),
      };
      const streams =
        request.task === 'chat' || request.task === 'explain' || request.task === 'example';
      const result = await aiTask.run(request, {
        ...(options.correctOptionTexts !== undefined
          ? { correctOptionTexts: options.correctOptionTexts }
          : {}),
        ...(streams
          ? {
              onToken: (token: string) =>
                dispatch(
                  appendAssistantToken({ key, messageId, requestId, token }),
                ),
            }
          : {}),
      });
      if (result === undefined) {
        if (activeRef.current?.requestId === requestId) {
          dispatch(
            failAssistantMessage({
              key,
              messageId,
              requestId,
              error: 'The AI request could not be completed.',
            }),
          );
          activeRef.current = undefined;
          announceLive('The tutor response could not be completed.', 'assertive');
        }
        return undefined;
      }
      if (!streams) {
        dispatch(
          appendAssistantToken({ key, messageId, requestId, token: result.text }),
        );
      }
      const publishedIds = new Set(catalog.missions.map((mission) => mission.id as string));
      dispatch(
        completeAssistantMessage({
          key,
          messageId,
          requestId,
          isMock: result.isMock,
          label: result.label,
          sourceMissionIds: result.sourceMissionIds.filter((missionId) =>
            publishedIds.has(missionId as string),
          ),
          safety: result.safety,
          structured: options.structured ?? result.structured,
          providerError: result.fallbackError,
          text: result.text,
        }),
      );
      activeRef.current = undefined;
      announceLive(result.isMock ? 'Sample AI response ready.' : 'Tutor response ready.');
      return result;
    },
    [
      aiTask,
      catalog.missions,
      conversation?.messages,
      details.isLoading,
      details.missions,
      dispatch,
      explainLikeNew,
      explanationLevelOverride,
      key,
      projection,
      requestState.status,
      scope,
    ],
  );

  const clearMessages = useCallback(() => {
    stop();
    dispatch(clearConversation(key));
    announceLive('Chat messages cleared.');
  }, [dispatch, key, stop]);

  return {
    scope,
    key,
    messages: conversation?.messages ?? [],
    draft,
    missionChoices,
    missions: details.missions,
    ...(selectedMission !== undefined ? { selectedMission } : {}),
    projection,
    busy: requestState.status === 'running' || aiTask.status === 'running',
    isLoadingContent: details.isLoading,
    ...(details.error !== undefined ? { contentError: details.error.message } : {}),
    availability,
    setScope: changeScope,
    setDraft: (nextDraft) => dispatch(setAiOnlyDraft({ key, draft: nextDraft })),
    send,
    stop,
    clearMessages,
    openSource: (missionId) => {
      const choice = missionChoices.find((candidate) => candidate.id === missionId);
      if (choice?.locked) return;
      const mission = catalog.missions.find((candidate) => candidate.id === missionId);
      if (mission !== undefined) openMission(mission);
    },
    refreshContent: details.refresh,
  };
}
