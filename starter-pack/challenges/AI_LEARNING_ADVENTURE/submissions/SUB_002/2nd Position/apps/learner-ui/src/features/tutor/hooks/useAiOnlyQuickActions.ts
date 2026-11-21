import { useCallback, useMemo, useState } from 'react';
import type {
  AiContextPacket,
  AiRecommendationModel,
  AiStructuredOutput,
  CatalogDto,
  MissionDetail,
  MissionId,
  ProgressProjection,
  ProgressSnapshotDto,
  QuestionId,
} from '@ai-learning-adventure/types';
import {
  buildAiOnlyContext,
  buildMissionContext,
  buildQuestionContext,
  recommendNextStep,
} from '@ai-learning-adventure/learner';
import { useAppDispatch } from '../../../store/index.ts';
import { addReviewTopics } from '../../../store/aiSlice.ts';
import type { AiOnlySendOptions } from './useAiOnlySession.ts';

export type AiOnlyQuickActionId =
  | 'explain'
  | 'example'
  | 'hint'
  | 'summary'
  | 'recommend'
  | 'review';

export interface AiOnlyQuickAction {
  id: AiOnlyQuickActionId;
  label: string;
}

export interface AiOnlyPickerState {
  kind: 'hint' | 'summary' | 'review';
  missionId?: MissionId;
  questionId?: QuestionId;
  answer: string;
  error?: string;
}

interface LastReviewTarget {
  missionId?: MissionId;
  questionId?: QuestionId;
  answer: string;
}

export interface UseAiOnlyQuickActionsResult {
  actions: AiOnlyQuickAction[];
  picker?: AiOnlyPickerState;
  busy: boolean;
  run: (action: AiOnlyQuickActionId) => void;
  updatePicker: (patch: Partial<AiOnlyPickerState>) => void;
  closePicker: () => void;
  submitPicker: () => Promise<void>;
  reviseLastAnswer: () => void;
  addSummaryToReview: (structured: AiStructuredOutput) => void;
}

export function useAiOnlyQuickActions(input: {
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
  projection: ProgressProjection;
  missions: MissionDetail[];
  selectedMission?: MissionDetail;
  lastUserMessage?: string;
  busy: boolean;
  send: (
    message: string,
    options?: AiOnlySendOptions,
  ) => Promise<unknown>;
}): UseAiOnlyQuickActionsResult {
  const dispatch = useAppDispatch();
  const [picker, setPicker] = useState<AiOnlyPickerState | undefined>(undefined);
  const [lastReview, setLastReview] = useState<LastReviewTarget | undefined>(undefined);
  const [hintLevels, setHintLevels] = useState<Record<string, 1 | 2 | 3>>({});

  const actions = useMemo<AiOnlyQuickAction[]>(
    () => [
      { id: 'explain', label: 'Explain simply' },
      { id: 'example', label: 'Give an example' },
      { id: 'hint', label: 'Give me a hint' },
      { id: 'summary', label: 'Summarize a mission' },
      { id: 'recommend', label: 'What should I learn next?' },
      { id: 'review', label: 'Review my answer' },
    ],
    [],
  );

  const defaultMissionId = input.selectedMission?.id ?? input.missions[0]?.id;
  const concept =
    input.lastUserMessage ??
    input.selectedMission?.title ??
    'the current AI learning concept';

  const run = useCallback(
    (action: AiOnlyQuickActionId) => {
      if (input.busy) return;
      switch (action) {
        case 'explain':
          void input.send(`Explain ${concept} in simpler language.`, {
            task: 'explain',
            explanationLevel: 'simple',
          });
          return;
        case 'example':
          void input.send(`Give me a fresh example of ${concept}.`, { task: 'example' });
          return;
        case 'hint':
        case 'summary':
        case 'review': {
          const mission = input.missions.find((candidate) => candidate.id === defaultMissionId);
          setPicker({
            kind: action,
            ...(mission !== undefined ? { missionId: mission.id } : {}),
            ...(action !== 'summary' && mission?.questions[0] !== undefined
              ? { questionId: mission.questions[0].id }
              : {}),
            answer: '',
          });
          return;
        }
        case 'recommend': {
          const recommendation = recommendNextStep({
            catalog: input.catalog,
            snapshot: input.progress,
            weakTopics: input.projection.weakTopics,
          });
          let structuredRecommendation: AiRecommendationModel;
          let context: AiContextPacket | undefined;
          if (recommendation.kind === 'mission') {
            structuredRecommendation = {
              kind: 'mission',
              missionId: recommendation.mission.mission.id,
              title: recommendation.mission.mission.title,
              reason: recommendation.mission.reason,
            };
            context = buildAiOnlyContext({
              missions: input.missions,
              progress: input.projection,
              missionId: recommendation.mission.mission.id,
            });
          } else if (recommendation.kind === 'review') {
            structuredRecommendation = {
              kind: 'review',
              topic: recommendation.review.topic,
              reason: recommendation.review.reason,
            };
          } else {
            structuredRecommendation = {
              kind: 'journey_complete',
              reason: 'You have completed every published mission. Review a weak topic to stay sharp.',
            };
          }
          void input.send('What should I learn next?', {
            task: 'recommend',
            ...(context !== undefined ? { context } : {}),
            structured: {
              kind: 'recommendation',
              recommendation: structuredRecommendation,
            },
          });
        }
      }
    },
    [concept, defaultMissionId, input],
  );

  const submitPicker = useCallback(async () => {
    if (picker === undefined || input.busy) return;
    const mission = input.missions.find((candidate) => candidate.id === picker.missionId);
    if (mission === undefined) {
      setPicker((current) =>
        current === undefined ? current : { ...current, error: 'Choose a mission first.' },
      );
      return;
    }
    if (picker.kind === 'summary') {
      const result = await input.send(`Summarize ${mission.title}.`, {
        task: 'summary',
        context: buildMissionContext(mission),
        explanationLevel: 'simple',
      });
      if (result !== undefined) setPicker(undefined);
      return;
    }
    const question = mission.questions.find((candidate) => candidate.id === picker.questionId);
    if (question === undefined) {
      setPicker((current) =>
        current === undefined ? current : { ...current, error: 'Choose a question first.' },
      );
      return;
    }
    if (picker.kind === 'hint') {
      const key = `${mission.id}:${question.id}`;
      const previous = hintLevels[key] ?? 0;
      const level = Math.min(previous + 1, 3) as 1 | 2 | 3;
      const result = await input.send(`Give me hint ${level} for this question.`, {
        task: 'hint',
        context: buildQuestionContext(mission, question, input.projection),
        hintLevel: level,
        correctOptionTexts: question.options
          .filter((option) => option.isCorrect)
          .map((option) => option.text),
      });
      if (result !== undefined) {
        setHintLevels((current) => ({ ...current, [key]: level }));
        setPicker(undefined);
      }
      return;
    }
    const answer = picker.answer.trim();
    if (answer.length === 0) {
      setPicker((current) =>
        current === undefined
          ? current
          : { ...current, error: 'Write an answer before requesting feedback.' },
      );
      return;
    }
    const result = await input.send('Review my answer and help me improve it.', {
      task: 'written_feedback',
      context: buildQuestionContext(mission, question, input.projection),
      learnerAnswer: answer,
      conceptTags: question.conceptTags,
    });
    if (result !== undefined) {
      setLastReview({ missionId: mission.id, questionId: question.id, answer });
      setPicker(undefined);
    }
  }, [hintLevels, input, picker]);

  return {
    actions,
    ...(picker !== undefined ? { picker } : {}),
    busy: input.busy,
    run,
    updatePicker: (patch) =>
      setPicker((current) =>
        current === undefined ? current : { ...current, ...patch, error: undefined },
      ),
    closePicker: () => setPicker(undefined),
    submitPicker,
    reviseLastAnswer: () => {
      setPicker({
        kind: 'review',
        ...(lastReview?.missionId !== undefined
          ? { missionId: lastReview.missionId }
          : defaultMissionId !== undefined
            ? { missionId: defaultMissionId }
            : {}),
        ...(lastReview?.questionId !== undefined
          ? { questionId: lastReview.questionId }
          : {}),
        answer: lastReview?.answer ?? '',
      });
    },
    addSummaryToReview: (structured) => {
      if (structured.kind !== 'summary') return;
      dispatch(
        addReviewTopics(
          structured.summary.items.flatMap((item) =>
            item.concept !== undefined ? [item.concept] : [],
          ),
        ),
      );
    },
  };
}
