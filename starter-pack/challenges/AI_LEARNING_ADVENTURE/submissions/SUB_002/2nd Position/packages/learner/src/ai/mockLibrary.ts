import type {
  AiResult,
  AiTaskRequest,
  MissionId,
  SummaryModel,
  WrittenFeedbackModel,
} from '@ai-learning-adventure/types';
import { contextMissionIds } from './context.ts';

const MOCK_LABEL = 'Sample / mock AI response' as const;

function sourceMissionIds(request: AiTaskRequest): MissionId[] {
  return [...new Set(contextMissionIds(request.context))] as MissionId[];
}

function missionName(request: AiTaskRequest): string {
  return request.context.mission?.title ??
    (request.context.scopeTopic !== undefined
      ? `the ${request.context.scopeTopic} topic`
      : request.context.sourceMissions !== undefined && request.context.sourceMissions.length > 0
        ? 'the published mission collection'
        : 'this learning content');
}

function summaryFor(request: AiTaskRequest): SummaryModel {
  const mission = request.context.mission;
  const items: Array<{ text: string; concept?: string }> = [];
  if (mission !== undefined) {
    items.push({ text: mission.objective });
    for (const block of mission.lesson) {
      if (block.type === 'paragraph' || block.type === 'callout') {
        items.push({ text: block.text, ...(block.type === 'callout' && block.title ? { concept: block.title } : {}) });
      }
      if (block.type === 'key_term') items.push({ text: `Remember the term ${block.term}.`, concept: block.term });
    }
  }
  if (request.context.progress !== undefined) {
    for (const topic of request.context.progress.weakTopics) {
      items.push({ text: `Review ${topic.topic} using the related cards.`, concept: topic.topic });
    }
  }
  if (items.length === 0) items.push({ text: 'Keep connecting the mission examples to the main idea.' });
  return { title: 'Key takeaways', items: items.slice(0, 5) };
}

function writtenFeedbackFor(request: AiTaskRequest): WrittenFeedbackModel {
  const response = request.learnerAnswer?.trim() ?? '';
  if (response.length < 20) {
    return {
      strengths: 'You started putting your idea into words.',
      missing: 'The response needs one clear connection to the mission concept.',
      improvement: 'Add one reason or example that supports your idea.',
      encouragement: 'Try one more sentence and use the mission terms as a guide.',
    };
  }
  return {
    strengths: 'You made a thoughtful attempt and identified part of the main idea.',
    missing: 'A little more detail would make the reasoning easier to follow.',
    improvement: 'Add a concrete example and explain why it supports your answer.',
    encouragement: 'Your draft is a useful starting point for a stronger explanation.',
  };
}

function textFor(request: AiTaskRequest): string {
  const contextName = missionName(request);
  switch (request.task) {
    case 'hint':
      return request.hintLevel === 3
        ? `Look closely at the goal in the prompt and compare each choice with that goal. Submit the choice that best fits the evidence.`
        : request.hintLevel === 2
          ? `Focus on the words in the question that describe the desired outcome. Cross out choices that ignore that outcome.`
          : `Start by identifying the concept this question is testing. Use the mission example to guide your comparison.`;
    case 'answer_feedback':
      return request.answerOutcome === 'correct'
        ? `Your choice matches the reasoning in the authored explanation: ${request.authoredExplanation ?? 'the mission explanation.'} A useful next step is to notice how the same idea appears in the example.`
        : `Your choice missed the main reasoning in the authored explanation: ${request.authoredExplanation ?? 'the mission explanation.'} Compare the goal in the question with the evidence in each option, then try the idea again.`;
    case 'written_feedback': {
      const feedback = writtenFeedbackFor(request);
      return `strengths: ${feedback.strengths}\nmissing: ${feedback.missing}\nimprovement: ${feedback.improvement}\nencouragement: ${feedback.encouragement}`;
    }
    case 'summary':
      return summaryFor(request).items.map((item) => `- ${item.text}`).join('\n');
    case 'example':
      return `Here is a fresh example for ${contextName}: describe a familiar task, name the desired audience, and ask for a specific output format. This keeps the example focused without repeating the authored example.`;
    case 'explain':
      return request.explanationLevel === 'simple'
        ? `${contextName} is easier to understand as a set of small steps: identify the goal, use the available evidence, and check the result.`
        : request.explanationLevel === 'deeper'
          ? `${contextName} connects the learner goal, the evidence in the mission, and the limits of the chosen approach. The important nuance is that a useful result still needs human review.`
          : `${contextName} works by connecting a clear goal with the evidence and examples provided in the mission.`;
    case 'recommend':
      return 'Your next best step is to continue with the deterministic mission recommendation or review the weakest topic shown in your progress.';
    case 'chat':
    default:
      return `This sample tutor response is scoped to ${contextName}. Ask me to explain the current concept, give an example, summarize the mission, or provide a hint.`;
  }
}

export function createMockAiResult(request: AiTaskRequest): AiResult {
  const redirected = request.task === 'chat' &&
    (/\bweather\b|\brecipe\b|\bpolitic(?:s|al)\b|\bmedical diagnosis\b/i.test(request.message ?? '') ||
      /\b(?:what is the|tell me the|reveal the) (?:correct )?answer\b/i.test(request.message ?? ''));
  const text = redirected
    ? 'I can help with the published learning content. Ask me to explain this concept, give a safe hint, or connect it to the mission example.'
    : textFor(request);
  const result: AiResult = {
    id: `mock-${request.task}-${sourceMissionIds(request).join('-') || 'general'}-${Date.now()}`,
    text,
    provider: 'mock',
    isMock: true,
    label: MOCK_LABEL,
    sourceMissionIds: sourceMissionIds(request),
    safety: {
      redirected,
      uncertain: request.task === 'chat' || request.task === 'explain',
      hintLeakChecked: request.task === 'hint',
    },
  };
  if (request.task === 'written_feedback') {
    result.structured = { kind: 'written_feedback', feedback: writtenFeedbackFor(request) };
  }
  if (request.task === 'summary') {
    result.structured = { kind: 'summary', summary: summaryFor(request) };
  }
  if (request.task === 'recommend') {
    const weakTopic = request.context.progress?.weakTopics[0]?.topic;
    result.structured = {
      kind: 'recommendation',
      recommendation: request.context.mission !== undefined
        ? {
            kind: 'mission',
            missionId: request.context.mission.id,
            title: request.context.mission.title,
            reason: 'This is the next deterministic step from your current learning scope.',
          }
        : weakTopic !== undefined
          ? { kind: 'review', topic: weakTopic, reason: 'This topic has the strongest review signal.' }
          : { kind: 'journey_complete', reason: 'Continue with the deterministic next step shown by your progress.' },
    };
  }
  return result;
}

export function createSafeMockAiResult(
  request: AiTaskRequest,
  reason: string,
): AiResult {
  const sourceIds = sourceMissionIds(request);
  const result: AiResult = {
    id: `mock-safe-${request.task}-${sourceIds.join('-') || 'general'}-${Date.now()}`,
    text:
      request.task === 'hint'
        ? 'Start by naming the goal of the question, then eliminate choices that do not support that goal.'
        : request.task === 'answer_feedback'
          ? `Use the authored explanation as your source of truth: ${request.authoredExplanation ?? 'review the mission explanation above.'}`
          : request.task === 'written_feedback'
            ? 'strengths: You made an attempt.\nmissing: Add one connection to the mission idea.\nimprovement: Include a concrete example.\nencouragement: Revise your response and try again.'
            : request.task === 'summary'
              ? '- Review the mission objective.\n- Connect the lesson to its example.\n- Use the checkpoint to practise.'
              : 'I can help explain the published learning content, give a safe hint, or provide an example.',
    provider: 'mock',
    isMock: true,
    label: MOCK_LABEL,
    sourceMissionIds: sourceIds,
    safety: {
      redirected: reason === 'scope' || reason === 'answer_reveal',
      uncertain: request.task === 'chat' || request.task === 'explain',
      hintLeakChecked: request.task === 'hint',
    },
  };
  if (request.task === 'written_feedback') {
    result.structured = {
      kind: 'written_feedback',
      feedback: {
        strengths: 'You made an attempt.',
        missing: 'Add one connection to the mission idea.',
        improvement: 'Include a concrete example.',
        encouragement: 'Revise your response and try again.',
      },
    };
  }
  if (request.task === 'summary') {
    result.structured = {
      kind: 'summary',
      summary: {
        title: 'Key takeaways',
        items: [
          { text: 'Review the mission objective.' },
          { text: 'Connect the lesson to its example.' },
          { text: 'Use the checkpoint to practise.' },
        ],
      },
    };
  }
  if (request.task === 'recommend') {
    result.structured = {
      kind: 'recommendation',
      recommendation: {
        kind: 'journey_complete',
        reason: 'Use the deterministic recommendation shown by your learning progress.',
      },
    };
  }
  return result;
}
