import type { AiResult, AiTaskRequest } from '@ai-learning-adventure/types';
import { contextSearchText } from './context.ts';
import {
  containsAnswerLeak,
  guardHintOutput,
  hasGroundingAnchor,
  isAnswerRevealRequest,
  isObviouslyOffScope,
} from './normalize.ts';
import { isUsefulWrittenFeedback, parseSummary, parseWrittenFeedback } from './parsers.ts';

export interface GuardedResult {
  accepted: boolean;
  result?: AiResult;
  reason?: 'scope' | 'answer_reveal' | 'hint_leak' | 'grounding' | 'format' | 'empty' | 'too_long';
}

export function guardTaskResult(
  request: AiTaskRequest,
  result: AiResult,
  correctOptionTexts: readonly string[] = [],
): GuardedResult {
  if (result.text.trim().length === 0) return { accepted: false, reason: 'empty' };
  if (result.text.length > 6000) return { accepted: false, reason: 'too_long' };
  if (request.task === 'chat' && isObviouslyOffScope(request.message ?? '')) {
    return { accepted: false, reason: 'scope' };
  }
  if (request.task === 'chat' && isAnswerRevealRequest(request.message ?? '')) {
    return { accepted: false, reason: 'answer_reveal' };
  }
  if (request.task === 'hint') {
    const hint = guardHintOutput(result.text, correctOptionTexts);
    if (!hint.safe) return { accepted: false, reason: hint.reason === 'answer_reveal' ? 'answer_reveal' : 'hint_leak' };
  }
  if (request.task === 'answer_feedback' && !hasGroundingAnchor(result.text, request.authoredExplanation ?? '')) {
    return { accepted: false, reason: 'grounding' };
  }
  if (request.task === 'written_feedback' && !isUsefulWrittenFeedback(parseWrittenFeedback(result))) {
    return { accepted: false, reason: 'format' };
  }
  if (request.task === 'summary' && parseSummary(result) === undefined) {
    return { accepted: false, reason: 'format' };
  }
  if (request.context.mission !== undefined && contextSearchText(request.context).length === 0) {
    return { accepted: false, reason: 'scope' };
  }
  return { accepted: true, result };
}

export { containsAnswerLeak, guardHintOutput, hasGroundingAnchor, isAnswerRevealRequest, isObviouslyOffScope };
