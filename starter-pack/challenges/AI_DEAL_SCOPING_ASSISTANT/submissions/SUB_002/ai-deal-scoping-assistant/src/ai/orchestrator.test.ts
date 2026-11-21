import { z } from 'zod';
import { runTask, runTextTask, zodIssuesToValidationIssues } from './orchestrator';
import type { AiProvider, AiRequest, ImpactContext, TaskDefinition, TaskRunOptions } from './types';
import { AiProviderError } from './types';

const OutputSchema = z.object({ id: z.string().min(1), title: z.string().min(1) });
type Output = z.infer<typeof OutputSchema>;

const CONTEXT: ImpactContext = {
  task: 'explain-change-impact',
  change: { kind: 'cloud-platform', targetId: 'T', label: 'Test change', from: 'aws', to: 'azure' },
  affected: [],
  unaffected: [],
};

const TASK: TaskDefinition<ImpactContext, Output> = {
  id: 'explain-change-impact',
  label: 'Test task',
  schema: OutputSchema,
  buildPrompt: () => ({ system: 'system prompt', prompt: 'user prompt' }),
};

const TEXT_TASK = { id: 'explain-change-impact' as const, label: 'Test text task', buildPrompt: () => ({ system: 'sys', prompt: 'user' }) };

function fakeProvider(id: string, mode: 'mock' | 'live', responses: readonly string[]): AiProvider {
  const queue = [...responses];
  return {
    id,
    label: `Fake ${id}`,
    mode,
    async complete(_request: AiRequest): Promise<string> {
      const next = queue.shift();
      if (next === undefined) {
        throw new Error('fakeProvider ran out of queued responses');
      }
      return next;
    },
  };
}

function throwingProvider(id: string, mode: 'mock' | 'live', error: Error): AiProvider {
  return {
    id,
    label: `Fake ${id}`,
    mode,
    async complete(): Promise<string> {
      throw error;
    },
  };
}

describe('runTask', () => {
  it('returns the parsed value and a full GenerationMeta on a first-try success', async () => {
    const provider = fakeProvider('mock', 'mock', ['{"id":"FR_01","title":"Registration"}']);
    const options: TaskRunOptions = { provider, fallback: null, scopeVersion: 3 };
    const result = await runTask(TASK, CONTEXT, options);
    expect(result.value).toEqual({ id: 'FR_01', title: 'Registration' });
    expect(result.meta).toMatchObject({ providerId: 'mock', providerLabel: 'Fake mock', mode: 'mock', usedFallback: false, scopeVersion: 3, issues: [] });
    expect(result.meta.durationMs).toBeGreaterThanOrEqual(0);
    expect(new Date(result.meta.generatedAt).toString()).not.toBe('Invalid Date');
  });

  it('throws when a mock provider returns data that fails schema validation (programming error)', async () => {
    const provider = fakeProvider('mock', 'mock', ['{"id":"FR_01"}']);
    const options: TaskRunOptions = { provider, fallback: null, scopeVersion: 1 };
    await expect(runTask(TASK, CONTEXT, options)).rejects.toThrow(/failed validation/);
  });

  it('retries once on a live schema failure and succeeds with the corrective response', async () => {
    const provider = fakeProvider('live', 'live', ['{"id":"FR_01"}', '{"id":"FR_01","title":"Fixed after retry"}']);
    const options: TaskRunOptions = { provider, fallback: null, scopeVersion: 1 };
    const result = await runTask(TASK, CONTEXT, options);
    expect(result.value).toEqual({ id: 'FR_01', title: 'Fixed after retry' });
    expect(result.meta.usedFallback).toBe(false);
  });

  it('falls back to mock after a live schema failure survives the retry, and records a live-fallback issue', async () => {
    const live = fakeProvider('live', 'live', ['{"id":"FR_01"}', '{"id":"FR_01"}']);
    const mock = fakeProvider('mock', 'mock', ['{"id":"FR_02","title":"From mock fallback"}']);
    const options: TaskRunOptions = { provider: live, fallback: mock, scopeVersion: 5 };
    const result = await runTask(TASK, CONTEXT, options);
    expect(result.value).toEqual({ id: 'FR_02', title: 'From mock fallback' });
    expect(result.meta.usedFallback).toBe(true);
    expect(result.meta.providerId).toBe('mock');
    expect(result.meta.issues.some((issue) => issue.code === 'live-fallback')).toBe(true);
    expect(result.meta.issues.some((issue) => issue.code === 'schema')).toBe(true);
  });

  it('falls back to mock when the live provider throws outright (e.g. auth failure)', async () => {
    const live = throwingProvider('live', 'live', new AiProviderError('auth', 'bad key'));
    const mock = fakeProvider('mock', 'mock', ['{"id":"FR_03","title":"From mock fallback"}']);
    const options: TaskRunOptions = { provider: live, fallback: mock, scopeVersion: 1 };
    const result = await runTask(TASK, CONTEXT, options);
    expect(result.meta.usedFallback).toBe(true);
    expect(result.meta.issues.at(0)?.message).toContain('auth');
  });

  it('rethrows an AiProviderError when the live provider fails and there is no fallback configured', async () => {
    const live = throwingProvider('live', 'live', new AiProviderError('network', 'offline'));
    const options: TaskRunOptions = { provider: live, fallback: null, scopeVersion: 1 };
    await expect(runTask(TASK, CONTEXT, options)).rejects.toThrow(AiProviderError);
  });
});

describe('runTextTask', () => {
  it('returns trimmed non-empty text with a full GenerationMeta', async () => {
    const provider = fakeProvider('mock', 'mock', ['  Cloud platform changed from AWS to Azure.  ']);
    const options: TaskRunOptions = { provider, fallback: null, scopeVersion: 2 };
    const result = await runTextTask(TEXT_TASK, CONTEXT, options);
    expect(result.value).toBe('Cloud platform changed from AWS to Azure.');
    expect(result.meta.usedFallback).toBe(false);
  });

  it('falls back to mock when the live provider returns an empty response', async () => {
    const live = fakeProvider('live', 'live', ['   ']);
    const mock = fakeProvider('mock', 'mock', ['Mock explanation text.']);
    const options: TaskRunOptions = { provider: live, fallback: mock, scopeVersion: 1 };
    const result = await runTextTask(TEXT_TASK, CONTEXT, options);
    expect(result.value).toBe('Mock explanation text.');
    expect(result.meta.usedFallback).toBe(true);
  });

  it('throws when a mock provider itself returns an empty response', async () => {
    const provider = fakeProvider('mock', 'mock', ['']);
    const options: TaskRunOptions = { provider, fallback: null, scopeVersion: 1 };
    await expect(runTextTask(TEXT_TASK, CONTEXT, options)).rejects.toThrow();
  });
});

describe('zodIssuesToValidationIssues', () => {
  it('folds the issue path into the message and codes every issue "schema"', () => {
    const result = OutputSchema.safeParse({ id: 'FR_01' });
    if (result.success) {
      throw new Error('expected schema validation to fail for this test fixture');
    }
    const issues = zodIssuesToValidationIssues(result.error);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.code === 'schema')).toBe(true);
    expect(issues.at(0)?.message).toContain('title');
  });
});
