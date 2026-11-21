import type { AiSolutionContext } from '../ai/types';
import type { ScopeItem } from '../domain';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { buildAiUseCases } from './aiUseCases';
import { fixtureArchitectureDesign } from './testFixtures';

const RAG_PATTERN = 'Retrieval-augmented generation (RAG) assistant';

function context(): AiSolutionContext {
  const design = fixtureArchitectureDesign();
  return { task: 'plan-ai-solution', scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig(), platform: design.platform, components: design.components };
}

/** Clones the fixture's AI requirement into another scope item that carries the same assistant signal. */
function assistantItem(overrides: Partial<ScopeItem>): ScopeItem {
  const base = fixtureScope().items.find((item) => item.id === 'FR_03');
  if (base === undefined) {
    throw new Error('fixture scope no longer contains FR_03');
  }
  return { ...base, ...overrides };
}

describe('buildAiUseCases naming', () => {
  it('names a use case after the single requirement that asks for it', () => {
    const useCases = buildAiUseCases(context(), [assistantItem({})]);
    expect(useCases.at(0)?.name).toBe('AI policy assistant');
  });

  it('keeps the name short when many scope items mention the AI feature', () => {
    const items = [
      assistantItem({ id: 'PER_01', kind: 'persona', title: 'Claims handler' }),
      assistantItem({ id: 'FR_03', title: 'AI policy assistant' }),
      assistantItem({ id: 'FR_04', title: 'Escalation to a human agent' }),
      assistantItem({ id: 'FR_05', title: 'Answer citations' }),
      assistantItem({ id: 'GAP_01', kind: 'gap', title: 'Assistant languages are not stated' }),
    ];
    const useCase = buildAiUseCases(context(), items).at(0);
    expect(useCase?.name).toBe(`${RAG_PATTERN}: AI policy assistant and 2 related functions`);
    expect(useCase?.name).not.toContain('Claims handler');
    expect(useCase?.requirementIds).toEqual(['PER_01', 'FR_03', 'FR_04', 'FR_05', 'GAP_01']);
  });

  it('describes the functional requirements in full and lists the remaining items by id', () => {
    const items = [
      assistantItem({ id: 'FR_03', description: 'Answers policy questions.' }),
      assistantItem({ id: 'NFR_02', kind: 'nonFunctional', title: 'Assistant latency', description: 'Answers within three seconds.' }),
      assistantItem({ id: 'Q_01', kind: 'question', title: 'Which languages?' }),
    ];
    const useCase = buildAiUseCases(context(), items).at(0);
    expect(useCase?.description).toBe(`${RAG_PATTERN} delivering FR_03 (Answers policy questions.). Also shaped by NFR_02, Q_01.`);
  });

  it('falls back to a customer-stated non-functional requirement when nothing functional matched', () => {
    const nonFunctional = assistantItem({ id: 'NFR_02', kind: 'nonFunctional', title: 'Assistant latency' });
    const question = assistantItem({ id: 'Q_01', kind: 'question', title: 'Which languages?' });
    expect(buildAiUseCases(context(), [question, nonFunctional]).at(0)?.name).toBe(`${RAG_PATTERN}: Assistant latency`);
  });
});

describe('buildAiUseCases triggering', () => {
  it('never creates a use case from a non-requirement-kind item alone, even one the customer stated', () => {
    const assumption = assistantItem({ id: 'ASM_05', kind: 'assumption', title: 'Delivery partner recommends supporting services', provenance: 'assumed' });
    expect(buildAiUseCases(context(), [assumption])).toEqual([]);
    const customerStatedAssumption = assistantItem({ id: 'ASM_06', kind: 'assumption', provenance: 'customer-stated' });
    expect(buildAiUseCases(context(), [customerStatedAssumption])).toEqual([]);
  });

  it('never triggers from a requirement-kind item alone unless it is functional/business or customer-stated', () => {
    const inferredNfr = assistantItem({ id: 'NFR_09', kind: 'nonFunctional', provenance: 'ai-inferred' });
    expect(buildAiUseCases(context(), [inferredNfr])).toEqual([]);
  });

  it('does create a use case from a customer-stated integration/data/security item even though it is not functional or business', () => {
    const statedSecurity = assistantItem({ id: 'SEC_09', kind: 'security', provenance: 'customer-stated' });
    expect(buildAiUseCases(context(), [statedSecurity])).toHaveLength(1);
  });

  it('lets a non-requirement-kind item shape a use case that a genuine trigger already justifies', () => {
    const assumption = assistantItem({ id: 'ASM_05', kind: 'assumption', title: 'Delivery partner note', provenance: 'assumed' });
    const trigger = assistantItem({ id: 'FR_20', title: 'Real assistant feature' });
    const useCases = buildAiUseCases(context(), [assumption, trigger]);
    expect(useCases).toHaveLength(1);
    expect(useCases.at(0)?.requirementIds).toEqual(['ASM_05', 'FR_20']);
  });

  it('never triggers from an item whose own text refuses to let AI be used', () => {
    const prohibited = assistantItem({
      id: 'DATA_09',
      kind: 'data',
      description: 'Conversation logs must not be used to retrain or fine-tune any model without a separate, explicit approval process.',
    });
    expect(buildAiUseCases(context(), [prohibited])).toEqual([]);
  });

  it('orders a customer-stated use case ahead of one triggered only by an ai-inferred item', () => {
    const inferred = assistantItem({ id: 'FR_20', title: 'Depot inventory triage', signals: ['ai:extraction'], provenance: 'ai-inferred' });
    const customerStated = assistantItem({ id: 'FR_21', title: 'Suggested reorder quantities', signals: ['ai:recommendation'], provenance: 'customer-stated' });
    const useCases = buildAiUseCases(context(), [inferred, customerStated]);
    expect(useCases.map((useCase) => useCase.pattern)).toEqual(['Recommendation engine', 'Document extraction pipeline with human validation']);
    expect(useCases.map((useCase) => useCase.id)).toEqual(['AIUC_01', 'AIUC_02']);
  });
});
