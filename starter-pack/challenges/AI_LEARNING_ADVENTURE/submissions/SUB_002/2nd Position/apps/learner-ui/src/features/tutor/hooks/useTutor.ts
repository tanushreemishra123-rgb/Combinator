import { useCallback, useMemo, useRef } from 'react';
import type {
  AiContextPacket,
  AiContextTarget,
  AiTaskRequest,
  MissionId,
} from '@ai-learning-adventure/types';
import { useAiTask } from '../../../hooks/useAiTask.ts';
import {
  appendAssistantToken,
  appendUserMessage,
  beginAssistantMessage,
  clearConversation,
  completeAssistantMessage,
  failAssistantMessage,
  inlineTutorKey,
  selectAiRequestState,
  selectConversation,
  stopAssistantMessage,
  type AiMessage,
} from '../../../store/aiSlice.ts';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import { selectExplainLikeNew, selectExplanationLevelOverride } from '../../../store/preferencesSlice.ts';
import { explanationLevelForTrack } from '@ai-learning-adventure/learner';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';

function targetForContext(context: AiContextPacket): AiContextTarget {
  if (context.question !== undefined) {
    return { kind: 'quiz_question', missionId: context.question.missionId, questionId: context.question.id };
  }
  if (context.flashcard !== undefined) {
    return { kind: 'flashcard', missionId: context.flashcard.missionId, flashcardId: context.flashcard.id as string };
  }
  if (context.progress !== undefined && context.mission === undefined) {
    return {
      kind: 'weak_topics',
      topics: context.progress.weakTopics.map((topic) => topic.topic),
      missionIds: [],
    };
  }
  return {
    kind: 'mission_step',
    missionId: context.mission?.id ?? ('general' as MissionId),
    step: context.step ?? 'lesson',
  };
}

export interface UseTutorOptions {
  missionId?: MissionId;
  context?: AiContextPacket;
}

export interface TutorQuickAction {
  id: 'explain' | 'example' | 'hint' | 'summary';
  label: string;
  message: string;
}

export interface UseTutorResult {
  key: string;
  messages: AiMessage[];
  busy: boolean;
  send: (message: string, task?: AiTaskRequest['task']) => Promise<void>;
  stop: () => void;
  clear: () => void;
  quickActions: TutorQuickAction[];
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function useTutor({ missionId, context = {} }: UseTutorOptions): UseTutorResult {
  const dispatch = useAppDispatch();
  const task = useAiTask();
  const explanationLevelOverride = useAppSelector(selectExplanationLevelOverride);
  const explainLikeNew = useAppSelector(selectExplainLikeNew);
  const key = missionId !== undefined ? inlineTutorKey(missionId) : 'inline:general';
  const conversation = useAppSelector(selectConversation(key));
  const requestState = useAppSelector(selectAiRequestState(key));
  const activeMessageRef = useRef<{ messageId: string; requestId: string } | undefined>(undefined);

  const quickActions = useMemo<TutorQuickAction[]>(() => {
    const actions: TutorQuickAction[] = [
      { id: 'explain', label: 'Explain simply', message: 'Explain the current concept simply.' },
      { id: 'example', label: 'Give an example', message: 'Give me a fresh example.' },
    ];
    if (context.question !== undefined) {
      actions.push({ id: 'hint', label: 'Give me a hint', message: 'Give me a safe hint without the answer.' });
    }
    if (context.mission !== undefined) {
      actions.push({ id: 'summary', label: 'Summarize this mission', message: 'Summarize this mission.' });
    }
    return actions;
  }, [context]);

  const send = useCallback(
    async (message: string, taskName: AiTaskRequest['task'] = 'chat') => {
      const text = message.trim();
      if (text.length === 0 || requestState.status === 'running') return;
      const messageId = makeId('assistant');
      const requestId = makeId('request');
      const target = targetForContext(context);
      const userMessage: AiMessage = {
        id: makeId('user'),
        role: 'user',
        text,
        status: 'complete',
        isMock: false,
        createdAt: new Date().toISOString(),
        sourceMissionIds: context.mission !== undefined ? [context.mission.id] : [],
        context: target,
      };
      const assistantMessage: AiMessage = {
        id: messageId,
        role: 'assistant',
        text: '',
        status: 'pending',
        isMock: false,
        createdAt: new Date().toISOString(),
        sourceMissionIds: context.mission !== undefined ? [context.mission.id] : [],
        context: target,
      };
      dispatch(appendUserMessage({ key, message: userMessage }));
      dispatch(beginAssistantMessage({ key, requestId, message: assistantMessage }));
      activeMessageRef.current = { messageId, requestId };

      const request: AiTaskRequest = {
        task: taskName,
        message: text,
        explanationLevel: explainLikeNew
          ? 'simple'
          : explanationLevelOverride ?? explanationLevelForTrack(context.mission?.levelTrack ?? 'beginner'),
        context,
      };
      const taskOptions = {
        ...(taskName === 'chat' || taskName === 'explain' || taskName === 'example'
          ? { onToken: (token: string) => dispatch(appendAssistantToken({ key, messageId, requestId, token })) }
          : {}),
        ...(taskName === 'hint' && context.question !== undefined
          ? { correctOptionTexts: context.question.options.map((option) => option.text) }
          : {}),
      };
      const result = await task.run(request, taskOptions);
      if (result === undefined) {
        if (activeMessageRef.current?.messageId === messageId) {
          dispatch(failAssistantMessage({ key, messageId, requestId, error: task.error ?? 'The AI request failed.' }));
        }
        return;
      }
      if (taskName !== 'chat' && taskName !== 'explain' && taskName !== 'example') {
        dispatch(appendAssistantToken({ key, messageId, requestId, token: result.text }));
      }
      dispatch(
        completeAssistantMessage({
          key,
          messageId,
          requestId,
          isMock: result.isMock,
          label: result.label,
           sourceMissionIds: result.sourceMissionIds,
           safety: result.safety,
           structured: result.structured,
           providerError: result.fallbackError,
           text: result.text,
          }),
      );
      activeMessageRef.current = undefined;
      announceLive(result.isMock ? 'Sample AI response ready.' : 'Tutor response ready.');
    },
    [context, dispatch, explainLikeNew, explanationLevelOverride, key, requestState.status, task],
  );

  const stop = useCallback(() => {
    const activeMessage = activeMessageRef.current;
    if (activeMessage === undefined) return;
    task.cancel();
    dispatch(stopAssistantMessage({ key, messageId: activeMessage.messageId }));
    activeMessageRef.current = undefined;
  }, [dispatch, key, task]);

  const clear = useCallback(() => {
    dispatch(clearConversation(key));
  }, [dispatch, key]);

  return {
    key,
    messages: conversation?.messages ?? [],
    busy: requestState.status === 'running' || task.status === 'running',
    send,
    stop,
    clear,
    quickActions,
  };
}
