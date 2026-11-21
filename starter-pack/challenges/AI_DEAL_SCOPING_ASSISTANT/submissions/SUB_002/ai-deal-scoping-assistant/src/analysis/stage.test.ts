import type { AiProvider, AiRequest, TaskRunOptions } from '../ai/types';
import type { AnalysisOutput, GenerationMeta, ScopeItemDraft, ScopeModel } from '../domain';
import { FIXTURE_NOW, fixtureCustomer, fixtureDocument } from '../test/fixtures';
import { planAnalysis } from './heuristicAnalyzer';
import { analyzeRequirements } from './stage';
import { draft, quoted } from './testKit';

const PROVIDER_ISSUE = { severity: 'warning' as const, code: 'live-fallback', message: 'Live call failed; mock used.', refs: [] };

vi.mock('../ai/promptKit', () => ({
  buildSystemPrompt: (role: string) => role,
  describeCustomerForPrompt: () => 'customer',
  jsonContract: () => 'contract',
}));

vi.mock('../ai', () => ({
  runTask: async (
    task: { schema: { parse(value: unknown): AnalysisOutput }; buildPrompt(context: unknown): { system: string; prompt: string } },
    context: AiRequest['context'],
    options: TaskRunOptions,
  ) => {
    const raw = await options.provider.complete({ ...task.buildPrompt(context), context });
    const meta: GenerationMeta = {
      providerId: options.provider.id,
      providerLabel: options.provider.label,
      mode: options.provider.mode,
      usedFallback: false,
      generatedAt: FIXTURE_NOW,
      durationMs: 1,
      scopeVersion: options.scopeVersion,
      issues: [PROVIDER_ISSUE],
    };
    return { value: task.schema.parse(JSON.parse(raw)), meta };
  },
}));

vi.mock('../scope', () => ({
  createScopeModel: (summary: string, drafts: ScopeItemDraft[]): ScopeModel => ({
    summary,
    items: drafts.map((item) => ({ ...item, signals: [], review: 'pending', inScope: true, userEdited: false, resolved: false, resolution: '' })),
    version: 1,
    approvedAt: null,
    approvedVersion: null,
    issues: [],
  }),
}));

function fakeProvider(output: AnalysisOutput): AiProvider & { requests: AiRequest[] } {
  const requests: AiRequest[] = [];
  return {
    id: 'fake',
    label: 'Fake provider',
    mode: 'live',
    requests,
    complete: async (request) => {
      requests.push(request);
      return JSON.stringify(output);
    },
  };
}

const input = { document: fixtureDocument(), customer: fixtureCustomer(), scenarioId: null };
const runWith = (provider: AiProvider): TaskRunOptions => ({ provider, fallback: null, scopeVersion: 0 });

describe('analyzeRequirements', () => {
  it('sends the analysis prompt and context to the provider', async () => {
    const provider = fakeProvider(planAnalysis({ task: 'analyze-requirements', ...input }));
    await analyzeRequirements(input, runWith(provider));
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests.at(0)?.context).toMatchObject({ task: 'analyze-requirements', scenarioId: null });
    expect(provider.requests.at(0)?.prompt).toContain('L5: Members must be able to register');
  });

  it('builds a scope model whose items are grounded and tagged with signals', async () => {
    const provider = fakeProvider(planAnalysis({ task: 'analyze-requirements', ...input }));
    const { scope, meta } = await analyzeRequirements(input, runWith(provider));
    const integration = scope.items.find((item) => item.id === 'INT_01');
    expect(integration?.signals).toEqual(expect.arrayContaining(['integration:crm', 'integration:realtime']));
    expect(integration?.source?.verified).toBe(true);
    expect(scope.items.find((item) => item.id === 'FR_03')?.signals).toEqual(expect.arrayContaining(['ai:assistant', 'ai:rag']));
    expect(scope.summary).toContain('Northwind Mutual');
    expect(meta).toMatchObject({ providerId: 'fake', mode: 'live' });
  });

  it('repairs IDs, downgrades ungrounded claims and reports every issue on scope and meta', async () => {
    const provider = fakeProvider({
      summary: 'Model summary.',
      items: [
        draft({ id: 'req-1', kind: 'functional', source: quoted('search and download their policy documents'), relatedIds: ['q1', 'ghost'] }),
        draft({ id: 'q1', kind: 'question', provenance: 'ai-inferred', relatedIds: ['req-1'] }),
        draft({ id: 'FR_07', kind: 'functional', title: 'Crypto trading', source: quoted('Members can trade cryptocurrency inside the portal') }),
      ],
    });
    const { scope, meta } = await analyzeRequirements(input, runWith(provider));

    expect(scope.items.map((item) => item.id)).toEqual(['FR_08', 'Q_01', 'FR_07']);
    expect(scope.items.at(0)).toMatchObject({ relatedIds: ['Q_01'], provenance: 'customer-stated', source: { lineStart: 6, verified: true } });
    expect(scope.items.at(0)?.signals).toEqual(expect.arrayContaining(['capability:search', 'capability:documents']));
    expect(scope.items.at(1)?.relatedIds).toEqual(['FR_08']);
    expect(scope.items.at(2)).toMatchObject({ provenance: 'ai-inferred', source: { verified: false } });

    const codes = meta.issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['live-fallback', 'id-reassigned', 'dangling-reference', 'ungrounded-claim']));
    expect(scope.issues).toEqual(meta.issues);
  });

  it('propagates provider failures to the caller', async () => {
    const failing: AiProvider = { id: 'down', label: 'Down', mode: 'live', complete: async () => Promise.reject(new Error('offline')) };
    await expect(analyzeRequirements(input, runWith(failing))).rejects.toThrow('offline');
  });
});
