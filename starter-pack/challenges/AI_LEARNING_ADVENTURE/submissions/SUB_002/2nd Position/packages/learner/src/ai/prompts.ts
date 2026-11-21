import type { AiTask, AiTaskRequest, ExplanationLevel } from '@ai-learning-adventure/types';
import { contextSearchText } from './context.ts';

export const AI_SYSTEM_INSTRUCTIONS = [
  'You are a friendly, beginner-safe AI literacy tutor.',
  'Use only the published learning context supplied with the request.',
  'Do not invent facts or reveal answers to unanswered activities.',
  'If the context does not support an answer, say that you are not certain and point back to the mission.',
  'Keep responses concise, professional, and focused on helping the learner reason.',
].join(' ');

const TASK_INSTRUCTIONS: Record<AiTask, string> = {
  chat: 'Answer the learner question about the scoped learning content.',
  explain: 'Explain the current concept at the requested level.',
  example: 'Give one fresh example that differs from prior examples.',
  hint: 'Give a progressively narrower nudge without stating or identifying the answer. Do not quote or repeat option text.',
  answer_feedback: 'Explain the deterministic answer outcome using the authored explanation as the source of truth.',
  written_feedback: 'Coach the written response without scoring or grading it. Use exactly four lines prefixed strengths:, missing:, improvement:, and encouragement:.',
  summary: 'Return three to five concise mission takeaways, each beginning with a hyphen.',
  recommend: 'Explain the deterministic next learning step using the progress context.',
};

export interface AiPrompt {
  system: string;
  user: string;
}

export function buildAiPrompt(request: AiTaskRequest): AiPrompt {
  const level: ExplanationLevel = request.explanationLevel;
  const context = contextSearchText(request.context).slice(0, 12000);
  const metadata = [
    `Task: ${request.task}`,
    `Explanation level: ${level}`,
    ...(request.hintLevel !== undefined ? [`Hint level: ${request.hintLevel} of 3`] : []),
    ...(request.answerOutcome !== undefined ? [`Deterministic outcome: ${request.answerOutcome}`] : []),
    ...(request.conceptTags !== undefined ? [`Concept tags: ${request.conceptTags.join(', ')}`] : []),
  ].join('\n');
  const grounding = request.authoredExplanation !== undefined
    ? `\nAuthored explanation (do not contradict): ${request.authoredExplanation}`
    : '';
  const learnerInput = request.message !== undefined ? `\nLearner input: ${request.message}` : '';
  const learnerAnswer = request.learnerAnswer !== undefined ? `\nWritten response: ${request.learnerAnswer}` : '';
  const conversation = request.conversation !== undefined && request.conversation.length > 0
    ? `\nRecent conversation:\n${request.conversation
        .map((turn) => `${turn.role === 'user' ? 'Learner' : 'Tutor'}: ${turn.text}`)
        .join('\n')}`
    : '';
  return {
    system: `${AI_SYSTEM_INSTRUCTIONS} ${TASK_INSTRUCTIONS[request.task]}`, // nosemgrep: gitlab.eslint.detect-object-injection
    user: `${metadata}\nPublished context:\n${context}${conversation}${grounding}${learnerInput}${learnerAnswer}`,
  };
}
