import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AiProviderSafeError, MissionDetail } from '@ai-learning-adventure/types';
import { buildMissionContext, buildWeakTopicContext, parseSummary } from '@ai-learning-adventure/learner';
import { useAiTask } from '../../../hooks/useAiTask.ts';
import { useAppDispatch } from '../../../store/index.ts';
import { addReviewTopics } from '../../../store/aiSlice.ts';

export interface UseMissionSummaryOptions {
  mission?: MissionDetail;
  weakTopics?: Array<{ topic: string; weight: number; sources: string[] }>;
}

export interface UseMissionSummaryResult {
  title?: string;
  items: Array<{ text: string; concept?: string }>;
  isMock: boolean;
  busy: boolean;
  copied: boolean;
  addedToReview: boolean;
  providerError?: AiProviderSafeError;
  request: () => Promise<void>;
  copy: () => Promise<void>;
  addToReview: () => void;
}

export function useMissionSummary({ mission, weakTopics = [] }: UseMissionSummaryOptions): UseMissionSummaryResult {
  const task = useAiTask();
  const dispatch = useAppDispatch();
  const [summary, setSummary] = useState<{ title: string; items: Array<{ text: string; concept?: string }> } | undefined>(undefined);
  const [isMock, setIsMock] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addedToReview, setAddedToReview] = useState(false);
  const [providerError, setProviderError] = useState<AiProviderSafeError | undefined>(undefined);
  const context = useMemo(
    () => (mission !== undefined ? buildMissionContext(mission) : buildWeakTopicContext(undefined, weakTopics)),
    [mission, weakTopics],
  );

  const summaryKey = `${mission?.id ?? 'weak-topics'}:${weakTopics.map((topic) => topic.topic).join('|')}`;
  useEffect(() => {
    setSummary(undefined);
    setCopied(false);
    setAddedToReview(false);
    setProviderError(undefined);
  }, [summaryKey]);

  const request = useCallback(async () => {
    if (task.status === 'running') return;
    setProviderError(undefined);
    const result = await task.run({ task: 'summary', explanationLevel: 'simple', context });
    if (result === undefined) return;
    const parsed = parseSummary(result);
    if (parsed === undefined) return;
    setSummary(parsed);
    setIsMock(result.isMock);
    setProviderError(result.fallbackError);
  }, [context, task]);

  const copy = useCallback(async () => {
    if (summary === undefined) return;
    const text = `${summary.title}\n${summary.items.map((item) => `- ${item.text}`).join('\n')}`;
    if (navigator.clipboard?.writeText !== undefined) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
  }, [summary]);

  return {
    ...(summary !== undefined ? { title: summary.title, items: summary.items } : { items: [] }),
    isMock,
    busy: task.status === 'running',
    copied,
    addedToReview,
    ...(providerError !== undefined ? { providerError } : {}),
    request,
    copy,
    addToReview: () => {
      if (summary === undefined) return;
      const concepts = [
        ...summary.items.flatMap((item) => item.concept !== undefined ? [item.concept] : []),
        ...(mission?.flashcards.flatMap((card) => card.conceptTags) ?? []),
      ];
      dispatch(addReviewTopics(concepts));
      setAddedToReview(true);
    },
  };
}
