import type { AnalysisOutput, ArchitectureOutput, PrdOutput } from '../../domain';
import { normalizeRequirements } from '../../ingestion';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../../test/fixtures';
import type {
  AiSolutionContext,
  AnalyzeContext,
  ArchitectureContext,
  DataIntegrationContext,
  EstimateContext,
  ImpactContext,
  PrdContext,
  SummaryContext,
} from '../types';
import { createMockProvider, MOCK_PROVIDER_ID, MOCK_PROVIDER_LABEL } from './mockProvider';

vi.mock('../../analysis', () => ({ planAnalysis: vi.fn(() => ({ summary: 'heuristic summary', items: [] })) }));
vi.mock('../../prd', () => ({ planPrd: vi.fn(() => ({ overview: [], businessProblem: [], journeys: [], capabilities: [], recommendedEnhancements: [], outOfScope: [] })) }));
vi.mock('../../architecture', () => ({ planArchitecture: vi.fn(() => ({ components: [], integrationNotes: [] })) }));
vi.mock('../../strategy', () => ({
  planDataIntegration: vi.fn(() => ({ pipelines: [] })),
  planAiSolution: vi.fn(() => ({ useCases: [] })),
}));
vi.mock('../../estimation', () => ({ planEstimateInputs: vi.fn(() => ({ workstreams: [] })) }));
vi.mock('../../impact', () => ({ planImpactExplanation: vi.fn(() => 'Plain-language impact explanation.') }));
vi.mock('../../export', () => ({ planExecutiveSummary: vi.fn(() => 'Plain-language executive summary.') }));
vi.mock('../../seed', () => ({ getScenario: vi.fn(() => undefined), getRecordedAnalysis: vi.fn(() => undefined) }));

function reviewedScopeStub(): { scope: ReturnType<typeof fixtureScope>; customer: ReturnType<typeof fixtureCustomer>; config: ReturnType<typeof fixtureConfig> } {
  return { scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig() };
}

describe('createMockProvider', () => {
  it('reports mode "mock" and a descriptive label', () => {
    const provider = createMockProvider();
    expect(provider.mode).toBe('mock');
    expect(provider.id).toBe(MOCK_PROVIDER_ID);
    expect(provider.label).toBe(MOCK_PROVIDER_LABEL);
  });

  it('dispatches analyze-requirements to planAnalysis when there is no matching seed scenario', async () => {
    const { planAnalysis } = await import('../../analysis');
    const provider = createMockProvider();
    const document = normalizeRequirements('The customer needs a member portal.');
    const context: AnalyzeContext = { task: 'analyze-requirements', document, customer: fixtureCustomer(), scenarioId: null };
    const raw = await provider.complete({ system: '', prompt: '', context });
    expect(planAnalysis).toHaveBeenCalledWith(context);
    expect(JSON.parse(raw)).toEqual({ summary: 'heuristic summary', items: [] });
  });

  it('uses the recorded analysis when scenarioId matches a seed scenario whose text is unmodified', async () => {
    const seed = await import('../../seed');
    const document = normalizeRequirements('Recorded scenario text.');
    const recorded: AnalysisOutput = { summary: 'recorded summary', items: [] };
    vi.mocked(seed.getScenario).mockReturnValue({
      id: 'scenario-1',
      name: 'Scenario',
      category: 'application-modernization',
      tagline: '',
      customer: fixtureCustomer(),
      requirementsText: 'Recorded scenario text.',
      config: fixtureConfig(),
    });
    vi.mocked(seed.getRecordedAnalysis).mockReturnValue(recorded);

    const provider = createMockProvider();
    const context: AnalyzeContext = { task: 'analyze-requirements', document, customer: fixtureCustomer(), scenarioId: 'scenario-1' };
    const raw = await provider.complete({ system: '', prompt: '', context });
    expect(JSON.parse(raw)).toEqual(recorded);

    vi.mocked(seed.getScenario).mockReturnValue(undefined);
    vi.mocked(seed.getRecordedAnalysis).mockReturnValue(undefined);
  });

  it('falls back to planAnalysis when the document text was edited away from the recorded scenario', async () => {
    const seed = await import('../../seed');
    const { planAnalysis } = await import('../../analysis');
    vi.mocked(planAnalysis).mockClear();
    vi.mocked(seed.getScenario).mockReturnValue({
      id: 'scenario-1',
      name: 'Scenario',
      category: 'application-modernization',
      tagline: '',
      customer: fixtureCustomer(),
      requirementsText: 'Original recorded text.',
      config: fixtureConfig(),
    });

    const provider = createMockProvider();
    const editedDocument = normalizeRequirements('This text was edited by the user.');
    const context: AnalyzeContext = { task: 'analyze-requirements', document: editedDocument, customer: fixtureCustomer(), scenarioId: 'scenario-1' };
    await provider.complete({ system: '', prompt: '', context });
    expect(planAnalysis).toHaveBeenCalledWith(context);

    vi.mocked(seed.getScenario).mockReturnValue(undefined);
  });

  it('dispatches generate-prd to planPrd', async () => {
    const { planPrd } = await import('../../prd');
    const provider = createMockProvider();
    const context: PrdContext = { task: 'generate-prd', ...reviewedScopeStub() };
    const raw = await provider.complete({ system: '', prompt: '', context });
    expect(planPrd).toHaveBeenCalledWith(context);
    const parsed = JSON.parse(raw) as PrdOutput;
    expect(parsed.capabilities).toEqual([]);
  });

  it('dispatches design-architecture to planArchitecture', async () => {
    const { planArchitecture } = await import('../../architecture');
    const provider = createMockProvider();
    const context: ArchitectureContext = { task: 'design-architecture', ...reviewedScopeStub(), platform: 'azure', catalog: [], capabilities: [] };
    const raw = await provider.complete({ system: '', prompt: '', context });
    expect(planArchitecture).toHaveBeenCalledWith(context);
    expect((JSON.parse(raw) as ArchitectureOutput).components).toEqual([]);
  });

  it('dispatches plan-data-integration and plan-ai-solution to the strategy planners', async () => {
    const { planDataIntegration, planAiSolution } = await import('../../strategy');
    const provider = createMockProvider();
    const dataContext: DataIntegrationContext = { task: 'plan-data-integration', ...reviewedScopeStub(), platform: 'azure', components: [] };
    await provider.complete({ system: '', prompt: '', context: dataContext });
    expect(planDataIntegration).toHaveBeenCalledWith(dataContext);

    const aiContext: AiSolutionContext = { task: 'plan-ai-solution', ...reviewedScopeStub(), platform: 'azure', components: [] };
    await provider.complete({ system: '', prompt: '', context: aiContext });
    expect(planAiSolution).toHaveBeenCalledWith(aiContext);
  });

  it('dispatches suggest-estimate-inputs to planEstimateInputs', async () => {
    const { planEstimateInputs } = await import('../../estimation');
    const provider = createMockProvider();
    const context: EstimateContext = { task: 'suggest-estimate-inputs', ...reviewedScopeStub(), capabilities: [], components: [], integrations: [], aiUseCases: [] };
    await provider.complete({ system: '', prompt: '', context });
    expect(planEstimateInputs).toHaveBeenCalledWith(context);
  });

  it('dispatches explain-change-impact to planImpactExplanation and returns its text directly (not JSON)', async () => {
    const { planImpactExplanation } = await import('../../impact');
    const provider = createMockProvider();
    const context: ImpactContext = {
      task: 'explain-change-impact',
      change: { kind: 'cloud-platform', targetId: 'T', label: 'L', from: 'aws', to: 'azure' },
      affected: [],
      unaffected: [],
    };
    const raw = await provider.complete({ system: '', prompt: '', context });
    expect(planImpactExplanation).toHaveBeenCalledWith(context);
    expect(raw).toBe('Plain-language impact explanation.');
  });

  it('dispatches summarize-package to planExecutiveSummary and returns its text directly (not JSON)', async () => {
    const { planExecutiveSummary } = await import('../../export');
    const provider = createMockProvider();
    const context: SummaryContext = { task: 'summarize-package', ...reviewedScopeStub(), facts: [] };
    const raw = await provider.complete({ system: '', prompt: '', context });
    expect(planExecutiveSummary).toHaveBeenCalledWith(context);
    expect(raw).toBe('Plain-language executive summary.');
  });

  it('applies the configured artificial latency before resolving', async () => {
    vi.useFakeTimers();
    const provider = createMockProvider({ latencyMs: 50 });
    const context: ImpactContext = {
      task: 'explain-change-impact',
      change: { kind: 'cloud-platform', targetId: 'T', label: 'L', from: 'aws', to: 'azure' },
      affected: [],
      unaffected: [],
    };
    let resolved = false;
    void provider.complete({ system: '', prompt: '', context }).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});
