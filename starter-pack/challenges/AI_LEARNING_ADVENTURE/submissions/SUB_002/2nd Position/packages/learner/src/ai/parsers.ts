import { z } from 'zod';
import type {
  AiResult,
  SummaryModel,
  WrittenFeedbackModel,
} from '@ai-learning-adventure/types';
import { normalizeAiText } from './normalize.ts';

export const WrittenFeedbackSchema = z.object({
  strengths: z.string(),
  missing: z.string(),
  improvement: z.string(),
  encouragement: z.string(),
});

export const SummaryItemSchema = z.object({
  text: z.string(),
  concept: z.string().optional(),
});

export const SummarySchema = z.object({
  title: z.string().default('Key takeaways'),
  items: z.array(SummaryItemSchema),
});

const WRITTEN_KEYS = ['strengths', 'missing', 'improvement', 'encouragement'] as const;

const WRITTEN_PATTERNS: Record<(typeof WRITTEN_KEYS)[number], RegExp> = {
  strengths: /(?:^|\n)\s*strengths\s*:\s*(.+?)(?=\n\s*(?:strengths|missing|improvement|encouragement)\s*:|$)/is,
  missing: /(?:^|\n)\s*missing\s*:\s*(.+?)(?=\n\s*(?:strengths|missing|improvement|encouragement)\s*:|$)/is,
  improvement: /(?:^|\n)\s*improvement\s*:\s*(.+?)(?=\n\s*(?:strengths|missing|improvement|encouragement)\s*:|$)/is,
  encouragement: /(?:^|\n)\s*encouragement\s*:\s*(.+?)(?=\n\s*(?:strengths|missing|improvement|encouragement)\s*:|$)/is,
};

export function parseWrittenFeedback(result: AiResult): WrittenFeedbackModel | undefined {
  if (result.structured?.kind === 'written_feedback') return result.structured.feedback;
  const values: Partial<Record<(typeof WRITTEN_KEYS)[number], string>> = {};
  for (const key of WRITTEN_KEYS) {
    const pattern = WRITTEN_PATTERNS[key]; // nosemgrep: gitlab.eslint.detect-object-injection
    const match = pattern.exec(result.text);
    if (match?.[1] !== undefined) values[key] = match[1].trim(); // nosemgrep: gitlab.eslint.detect-object-injection
  }
  if (WRITTEN_KEYS.some((key) => values[key] === undefined)) return undefined; // nosemgrep: gitlab.eslint.detect-object-injection
  const parsed = WrittenFeedbackSchema.safeParse(values);
  return parsed.success ? parsed.data : (values as WrittenFeedbackModel);
}

export function parseSummary(result: AiResult): SummaryModel | undefined {
  if (result.structured?.kind === 'summary') return result.structured.summary;
  const lines = result.text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0);
  if (lines.length < 3 || lines.length > 8) return undefined;
  const data = {
    title: 'Key takeaways',
    items: lines.slice(0, 5).map((text) => ({ text })),
  };
  const parsed = SummarySchema.safeParse(data);
  return parsed.success ? parsed.data : data;
}

export function isUsefulWrittenFeedback(feedback: WrittenFeedbackModel | undefined): boolean {
  if (feedback === undefined) return false;
  return WRITTEN_KEYS.every((key) => normalizeAiText(feedback[key]).length >= 3); // nosemgrep: gitlab.eslint.detect-object-injection
}
