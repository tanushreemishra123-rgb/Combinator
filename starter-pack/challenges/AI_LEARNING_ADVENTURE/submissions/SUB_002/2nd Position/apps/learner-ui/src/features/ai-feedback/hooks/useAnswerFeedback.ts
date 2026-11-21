import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AiProviderSafeError, MissionDetail, QuizQuestion } from '@ai-learning-adventure/types';
import { buildMissionContext, buildQuestionContext, parseWrittenFeedback, isUsefulWrittenFeedback } from '@ai-learning-adventure/learner';
import { useAiTask } from '../../../hooks/useAiTask.ts';

export interface UseAnswerFeedbackOptions {
  mission: MissionDetail;
  question?: QuizQuestion;
  selectedOptionIds?: string[];
  authoredExplanation?: string;
  outcome?: 'correct' | 'incorrect';
  learnerAnswer?: string;
}

export interface UseAnswerFeedbackResult {
  text?: string;
  writtenFeedback?: ReturnType<typeof parseWrittenFeedback>;
  isMock: boolean;
  busy: boolean;
  providerError?: AiProviderSafeError;
  requestExplanation: () => Promise<void>;
  requestSimpler: () => Promise<void>;
  requestExample: () => Promise<void>;
}

export function useAnswerFeedback({
  mission,
  question,
  selectedOptionIds = [],
  authoredExplanation = '',
  outcome,
  learnerAnswer,
}: UseAnswerFeedbackOptions): UseAnswerFeedbackResult {
  const task = useAiTask();
  const [resultText, setResultText] = useState<string | undefined>(undefined);
  const [writtenFeedback, setWrittenFeedback] = useState<ReturnType<typeof parseWrittenFeedback>>(undefined);
  const [isMock, setIsMock] = useState(false);
  const [providerError, setProviderError] = useState<AiProviderSafeError | undefined>(undefined);
  const context = useMemo(
    () => (question !== undefined ? buildQuestionContext(mission, question) : buildMissionContext(mission)),
    [mission, question],
  );

  useEffect(() => {
    setResultText(undefined);
    setWrittenFeedback(undefined);
    setIsMock(false);
    setProviderError(undefined);
  }, [learnerAnswer, question?.id, outcome]);

  const request = useCallback(
    async (taskName: 'answer_feedback' | 'written_feedback' | 'explain' | 'example') => {
      if (task.status === 'running') return;
      setResultText(undefined);
      setWrittenFeedback(undefined);
      setIsMock(false);
      setProviderError(undefined);
      const result = await task.run({
        task: taskName,
        explanationLevel: taskName === 'explain' ? 'simple' : 'standard',
        selectedOptionIds,
        ...(outcome !== undefined ? { answerOutcome: outcome } : {}),
        ...(authoredExplanation.length > 0 ? { authoredExplanation } : {}),
        ...(learnerAnswer !== undefined ? { learnerAnswer } : {}),
        context,
      }, {
        correctOptionTexts: question?.options.filter((option) => option.isCorrect).map((option) => option.text),
      });
      if (result === undefined) return;
      setResultText(result.text);
      setIsMock(result.isMock);
      setProviderError(result.fallbackError);
      const parsed = parseWrittenFeedback(result);
      setWrittenFeedback(isUsefulWrittenFeedback(parsed) ? parsed : undefined);
    },
    [authoredExplanation, context, learnerAnswer, outcome, question, selectedOptionIds, task],
  );

  return {
    ...(resultText !== undefined ? { text: resultText } : {}),
    ...(writtenFeedback !== undefined ? { writtenFeedback } : {}),
    isMock,
    busy: task.status === 'running',
    ...(providerError !== undefined ? { providerError } : {}),
    requestExplanation: () => request(learnerAnswer !== undefined ? 'written_feedback' : 'answer_feedback'),
    requestSimpler: () => request('explain'),
    requestExample: () => request('example'),
  };
}
