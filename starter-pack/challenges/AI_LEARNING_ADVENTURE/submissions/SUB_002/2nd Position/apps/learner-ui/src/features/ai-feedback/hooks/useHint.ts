import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AiProviderSafeError, Checkpoint, MissionDetail, QuizQuestion } from '@ai-learning-adventure/types';
import { buildCheckpointContext, buildQuestionContext } from '@ai-learning-adventure/learner';
import { useAiTask } from '../../../hooks/useAiTask.ts';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';

export interface UseHintOptions {
  mission: MissionDetail;
  question?: QuizQuestion;
  checkpoint?: Checkpoint;
  selection?: string[];
  resetKey?: string;
}

export interface UseHintResult {
  hints: string[];
  hint?: string;
  isMock: boolean;
  level: number;
  canRequestMore: boolean;
  busy: boolean;
  providerError?: AiProviderSafeError;
  requestHint: () => Promise<void>;
}

function correctTexts(question?: QuizQuestion, checkpoint?: Checkpoint): string[] {
  if (question !== undefined) return question.options.filter((option) => option.isCorrect).map((option) => option.text);
  if (checkpoint?.kind === 'single_question') {
    return checkpoint.options.filter((option) => option.isCorrect).map((option) => option.text);
  }
  return [];
}

export function useHint({ mission, question, checkpoint, selection = [], resetKey = '' }: UseHintOptions): UseHintResult {
  const task = useAiTask();
  const [hints, setHints] = useState<string[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [providerError, setProviderError] = useState<AiProviderSafeError | undefined>(undefined);
  const targetKey = `${mission.id}:${question?.id ?? checkpoint?.kind ?? 'mission'}:${resetKey}`;
  const context = useMemo(
    () =>
      question !== undefined
        ? buildQuestionContext(mission, question)
        : checkpoint !== undefined
          ? buildCheckpointContext(mission, checkpoint)
           : {
               mission: {
                 id: mission.id,
                 title: mission.title,
                 objective: mission.objective,
                 levelTrack: mission.levelTrack,
                 lesson: mission.lesson,
                 example: mission.example,
               },
             },
    [checkpoint, mission, question],
  );

  useEffect(() => {
    setHints([]);
    setIsMock(false);
    setProviderError(undefined);
  }, [targetKey]);

  const requestHint = useCallback(async () => {
    if (hints.length >= 3 || task.status === 'running') return;
    setProviderError(undefined);
    const level = (hints.length + 1) as 1 | 2 | 3;
    const result = await task.run(
      {
        task: 'hint',
        explanationLevel: 'simple',
        hintLevel: level,
        selectedOptionIds: selection,
        context,
      },
      { correctOptionTexts: correctTexts(question, checkpoint) },
    );
    if (result === undefined) return;
    setHints((current) => (current.length >= 3 ? current : [...current, result.text]));
    setIsMock(result.isMock);
    setProviderError(result.fallbackError);
    announceLive(`Hint ${level} of 3 is ready.`);
  }, [checkpoint, context, hints.length, question, selection, task]);

  return {
    hints,
    ...(hints.length > 0 ? { hint: hints[hints.length - 1] /* nosemgrep: gitlab.eslint.detect-object-injection */ } : {}),
    isMock,
    level: hints.length,
    canRequestMore: hints.length < 3,
    busy: task.status === 'running',
    ...(providerError !== undefined ? { providerError } : {}),
    requestHint,
  };
}
