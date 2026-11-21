import { describe, expect, it, vi } from 'vitest';
import type { AiTaskRequest, MissionId } from '@ai-learning-adventure/types';
import {
  buildQuestionContext,
  containsAnswerLeak,
  createMockAiProvider,
  executeAiTask,
  guardHintOutput,
  guardTaskResult,
  isAnswerRevealRequest,
  isNearDuplicate,
  parseSummary,
  parseWrittenFeedback,
  buildAiPrompt,
  boundAiConversationHistory,
  buildAiOnlyContext,
  deriveAiOnlyTopics,
  nextAiOnlyWalkthroughStep,
  selectAiOnlyGroundingMissions,
  walkthroughStepToMissionStep,
  createAiProvider,
  createOpenAiCompatibleProvider,
  isAiProviderConfigured,
} from '../src/index.ts';
import { makeMission, missionId } from './fixtures.ts';

function aiMission() {
  const summary = makeMission({ id: 'mission-ai', title: 'AI basics' });
  return {
    ...summary,
    lesson: [{ type: 'paragraph' as const, text: 'Models learn patterns from data.' }],
    example: {
      type: 'worked_example' as const,
      before: 'Explain data.',
      after: 'Explain how models learn patterns from data.',
      annotations: ['The goal is clearer.'],
    },
    checkpoint: {
      kind: 'single_question' as const,
      prompt: 'What do models learn from?',
      options: [{ id: 'checkpoint-data', text: 'Data', isCorrect: true }],
      explanation: 'Models learn patterns from data.',
    },
    questions: [],
    flashcards: [],
    awards: [],
    passThreshold: 70,
  };
}

function aiQuestion() {
  return {
    id: 'question-ai' as never,
    missionId: missionId('mission-ai'),
    type: 'multiple_choice' as const,
    stem: 'What do models learn from?',
    selectionMode: 'single' as const,
    options: [
      { id: 'data', text: 'Data', isCorrect: true },
      { id: 'guesses', text: 'Guesses', isCorrect: false },
    ],
    correctExplanation: 'Models learn patterns from data.',
    incorrectExplanation: 'Models learn patterns from data.',
    conceptTags: ['data'],
  };
}

function request(task: AiTaskRequest['task']): AiTaskRequest {
  const mission = aiMission();
  const question = aiQuestion();
  return {
    task,
    explanationLevel: 'simple',
    context: buildQuestionContext(mission, question),
    ...(task === 'hint' ? { hintLevel: 1 } : {}),
  };
}

describe('R6 AI domain', () => {
  it('removes correctness metadata from question context', () => {
    const context = request('hint').context;
    expect(context.question?.options).toEqual([
      { id: 'data', text: 'Data' },
      { id: 'guesses', text: 'Guesses' },
    ]);
    expect(JSON.stringify(context)).not.toContain('isCorrect');
  });

  it('builds bounded task-specific prompts from curated context', () => {
    const prompt = buildAiPrompt({
      ...request('hint'),
      message: 'Help me reason about this.',
      authoredExplanation: 'Models learn patterns from data.',
    });
    expect(prompt.system).toContain('Do not invent facts');
    expect(prompt.user).toContain('Task: hint');
    expect(prompt.user).toContain('Published context:');
    expect(prompt.user).toContain('Help me reason about this.');
    expect(prompt.user.length).toBeLessThan(13000);
  });

  it('detects direct answer leaks while allowing useful overlap', () => {
    expect(containsAnswerLeak('The correct choice is Data.', ['Data'])).toBe(true);
    expect(guardHintOutput('Look for the kind of input the system learns from.', ['Data']).safe).toBe(true);
    expect(guardHintOutput('The answer is Data.', ['Data']).safe).toBe(false);
  });

  it('recognizes answer-reveal requests', () => {
    expect(isAnswerRevealRequest('Just tell me the correct answer')).toBe(true);
    expect(isAnswerRevealRequest('Can you explain the concept simply?')).toBe(false);
  });

  it('parses structured written feedback and summaries', () => {
    const written = executeResult('strengths: Clear start\nmissing: More detail\nimprovement: Add an example\nencouragement: Keep going');
    expect(parseWrittenFeedback(written)?.improvement).toBe('Add an example');
    const summary = executeResult('- First takeaway\n- Second takeaway\n- Third takeaway');
    expect(parseSummary(summary)?.items).toHaveLength(3);
  });

  it('rejects grounded answer output without authored anchors', () => {
    const answerRequest = request('answer_feedback');
    const result = executeResult('A completely unrelated response.');
    expect(guardTaskResult({ ...answerRequest, authoredExplanation: 'Models learn patterns from data.' }, result).accepted).toBe(false);
  });

  it('uses a safe mock result after a rejected provider response', async () => {
    const provider = createMockAiProvider();
    const result = await executeAiTask({
      provider: {
        ...provider,
        async complete() {
          return {
            id: 'unsafe',
            text: 'The answer is Data.',
            provider: 'mock',
            isMock: false,
            sourceMissionIds: ['mission-ai' as MissionId],
            safety: { redirected: false, uncertain: false, hintLeakChecked: false },
          };
        },
      },
      request: request('hint'),
      correctOptionTexts: ['Data'],
    });
    expect(result.isMock).toBe(true);
    expect(result.label).toBe('Sample / mock AI response');
    expect(containsAnswerLeak(result.text, ['Data'])).toBe(false);
  });

  it('detects near duplicate generated examples', () => {
    expect(isNearDuplicate('A clear goal and a specific format.', ['Use a clear goal and specific format.'])).toBe(true);
    expect(isNearDuplicate('A privacy review for a customer support tool.', ['Use a clear goal and specific format.'])).toBe(false);
  });
});

describe('R7 AI-only domain', () => {
  it('ranks and bounds multi-mission grounding by the learner query', () => {
    const modelMission = aiMission();
    const tokenMission = {
      ...aiMission(),
      id: missionId('mission-tokens'),
      title: 'Tokens and context',
      objective: 'Understand how tokens fill a context window.',
      lesson: [{ type: 'paragraph' as const, text: 'Tokens are chunks of text used by a model.' }],
    };
    const selected = selectAiOnlyGroundingMissions(
      [modelMission, tokenMission],
      'Why does token context run out?',
      1,
    );
    expect(selected.map((mission) => mission.id)).toEqual([missionId('mission-tokens')]);

    const context = buildAiOnlyContext({
      missions: [modelMission, tokenMission],
      progress: { completionPercent: 25, currentLevel: 'beginner', weakTopics: [] },
      query: 'tokens',
    });
    expect(context.sourceMissions?.[0]?.id).toBe(missionId('mission-tokens'));
    expect(context.progress?.completionPercent).toBe(25);
  });

  it('deduplicates topics and retains their published mission sources', () => {
    const first = {
      ...aiMission(),
      questions: [{ ...aiQuestion(), conceptTags: ['Data Safety'] }],
    };
    const second = {
      ...aiMission(),
      id: missionId('mission-second'),
      questions: [{ ...aiQuestion(), missionId: missionId('mission-second'), conceptTags: ['data safety'] }],
    };
    const topics = deriveAiOnlyTopics([first, second]);
    const safety = topics.find((topic) => topic.topic.toLocaleLowerCase() === 'data safety');
    expect(safety?.missionIds).toEqual([missionId('mission-ai'), missionId('mission-second')]);
  });

  it('keeps only recent bounded conversation turns', () => {
    const turns = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      text: `Turn ${index} ${'x'.repeat(20)}`,
    }));
    const bounded = boundAiConversationHistory(turns, 4, 80);
    expect(bounded).toHaveLength(3);
    expect(bounded.at(-1)?.text).toContain('Turn 11');
    expect(bounded.reduce((total, turn) => total + turn.text.length, 0)).toBeLessThanOrEqual(80);
  });

  it('maps walkthrough steps without granting quiz or completion credit', () => {
    expect(nextAiOnlyWalkthroughStep('objective')).toBe('lesson');
    expect(nextAiOnlyWalkthroughStep('checkpoint')).toBeUndefined();
    expect(walkthroughStepToMissionStep('objective')).toBe('lesson');
    expect(walkthroughStepToMissionStep('checkpoint')).toBe('checkpoint');
  });
});

describe('R8 AI providers and fallback', () => {
  it('selects mock for incomplete setup and recognizes complete openai/local setup', () => {
    expect(createAiProvider({ kind: 'openai' }).kind).toBe('mock');
    expect(isAiProviderConfigured({
      kind: 'openai',
      endpoint: 'https://provider.example/v1',
      modelName: 'model-a',
      apiKey: 'secret',
    })).toBe(true);
    expect(isAiProviderConfigured({
      kind: 'local',
      endpoint: 'http://localhost:11434/v1',
      modelName: 'local-model',
    })).toBe(true);
  });

  it('requires a key for openai and treats it as configured only with endpoint, model, and key', () => {
    expect(createAiProvider({ kind: 'openai' }).kind).toBe('mock');
    expect(isAiProviderConfigured({
      kind: 'openai',
      endpoint: 'https://api.openai.com/v1',
      modelName: 'gpt-5.6-luna',
    })).toBe(false);
    expect(isAiProviderConfigured({
      kind: 'openai',
      endpoint: 'https://api.openai.com/v1',
      modelName: 'gpt-5.6-luna',
      apiKey: 'sk-test',
    })).toBe(true);
    expect(createAiProvider({
      kind: 'openai',
      endpoint: 'https://api.openai.com/v1',
      modelName: 'gpt-5.6-luna',
      apiKey: 'sk-test',
    }).kind).toBe('openai');
  });

  it('requires a key for ollama cloud and treats it as configured only with endpoint, model, and key', () => {
    expect(createAiProvider({ kind: 'ollama' }).kind).toBe('mock');
    expect(isAiProviderConfigured({
      kind: 'ollama',
      endpoint: 'https://ollama.com/v1',
      modelName: 'gpt-oss:20b',
    })).toBe(false);
    expect(isAiProviderConfigured({
      kind: 'ollama',
      endpoint: 'https://ollama.com/v1',
      modelName: 'gpt-oss:20b',
      apiKey: 'ollama-test',
    })).toBe(true);
    expect(createAiProvider({
      kind: 'ollama',
      endpoint: 'https://ollama.com/v1',
      modelName: 'gpt-oss:20b',
      apiKey: 'ollama-test',
    }).kind).toBe('ollama');
  });

  it('maps an openai completion request to the OpenAI endpoint and labels the provider', async () => {
    let body: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        id: 'openai-result',
        choices: [{ index: 0, message: { role: 'assistant', content: 'OpenAI models learn patterns from the published data context.' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = createOpenAiCompatibleProvider({
      kind: 'openai',
      endpoint: 'https://api.openai.com/v1/',
      modelName: 'gpt-5.6-luna',
      apiKey: 'sk-top-secret',
    });
    const result = await provider.complete(request('explain'));

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/chat/completions');
    const headersMap = (fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headersMap.Authorization ?? headersMap.authorization).toBe('Bearer sk-top-secret');
    expect(body?.model).toBe('gpt-5.6-luna');
    expect(result.provider).toBe('openai');
    expect(result.isMock).toBe(false);
    expect(JSON.stringify(result)).not.toContain('sk-top-secret');
    vi.unstubAllGlobals();
  });

  it('maps an ollama cloud completion request and returns a live grounded result', async () => {
    let body: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        id: 'live-result',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Models learn patterns from the published data context.' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = createOpenAiCompatibleProvider({
      kind: 'ollama',
      endpoint: 'https://ollama.com/v1/',
      modelName: 'gpt-oss:20b',
      apiKey: 'top-secret',
    });
    const result = await provider.complete(request('explain'));

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ollama.com/v1/chat/completions');
    const headersMap = (fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headersMap.Authorization ?? headersMap.authorization).toBe('Bearer top-secret');
    expect(body?.model).toBe('gpt-oss:20b');
    expect(JSON.stringify(body)).toContain('Published context');
    expect(result.provider).toBe('ollama');
    expect(result.isMock).toBe(false);
    expect(result.sourceMissionIds).toEqual([missionId('mission-ai')]);
    vi.unstubAllGlobals();
  });

  it('parses streamed SSE tokens in order', async () => {
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"id":"stream-1","choices":[{"index":0,"delta":{"content":"Models "}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"id":"stream-1","choices":[{"index":0,"delta":{"content":"learn patterns."}}]}\n\ndata: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(responseStream, { status: 200, headers: { 'content-type': 'text/event-stream' } })));
    const provider = createOpenAiCompatibleProvider({
      kind: 'local',
      endpoint: 'http://localhost:11434/v1',
      modelName: 'llama3.2:3b',
    });
    const tokens: string[] = [];
    const result = await provider.stream?.(request('explain'), (token) => tokens.push(token));
    expect(tokens).toEqual(['Models ', 'learn patterns.']);
    expect(result?.text).toBe('Models learn patterns.');
    vi.unstubAllGlobals();
  });

  it('normalizes live summary and written feedback into structured results', async () => {
    const responses = [
      '- First takeaway\n- Second takeaway\n- Third takeaway',
      'strengths: Clear idea\nmissing: More evidence\nimprovement: Add one example\nencouragement: Keep refining it',
    ];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ index: 0, message: { role: 'assistant', content: responses.shift() } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const provider = createOpenAiCompatibleProvider({
      kind: 'local',
      endpoint: 'http://localhost:11434/v1',
      modelName: 'local-model',
    });
    expect((await provider.complete(request('summary'))).structured?.kind).toBe('summary');
    expect((await provider.complete(request('written_feedback'))).structured?.kind).toBe('written_feedback');
    vi.unstubAllGlobals();
  });

  it('normalizes unauthorized failures and produces a labeled fallback without leaking the key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 401 })));
    const provider = createOpenAiCompatibleProvider({
      kind: 'openai',
      endpoint: 'https://provider.example/v1',
      modelName: 'model-a',
      apiKey: 'super-secret-key',
    });
    const testResult = await provider.test();
    expect(testResult.error?.code).toBe('unauthorized');
    expect(testResult.message).not.toContain('super-secret-key');

    const result = await executeAiTask({ provider, request: request('explain') });
    expect(result.isMock).toBe(true);
    expect(result.label).toBe('Sample / mock AI response');
    expect(result.fallbackError?.code).toBe('unauthorized');
    expect(JSON.stringify(result)).not.toContain('super-secret-key');
    vi.unstubAllGlobals();
  });

  it('times out a stalled provider and returns a timeout-labeled sample', async () => {
    const provider = createMockAiProvider();
    const result = await executeAiTask({
      provider: {
        ...provider,
        kind: 'local',
        complete() {
          return new Promise(() => undefined);
        },
        stream: undefined,
      },
      request: request('summary'),
      timeoutMs: 5,
    });
    expect(result.isMock).toBe(true);
    expect(result.fallbackError?.code).toBe('timeout');
    expect(result.structured?.kind).toBe('summary');
  });
});

function executeResult(text: string) {
  return {
    id: 'fixture',
    text,
    provider: 'mock' as const,
    isMock: true,
    label: 'Sample / mock AI response' as const,
    sourceMissionIds: ['mission-ai' as MissionId],
    safety: { redirected: false, uncertain: false, hintLeakChecked: false },
  };
}
