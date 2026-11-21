import { planEstimateInputs } from './inputPlanner';
import { estimateInputsTask } from './prompt';
import { estimateContext } from './testing/estimateFixtures';

vi.mock('../ai', () => ({
  buildSystemPrompt: (role: string) => `SYSTEM RULES for ${role}`,
  describeScopeForPrompt: () => 'FR_01 | functional | High | customer-stated | Registration',
  describeCustomerForPrompt: () => 'Northwind Mutual (Insurance)',
  describeConfigForPrompt: () => 'Cloud: azure; expected users: 50000',
  jsonContract: () => 'JSON-SCHEMA-OF-ESTIMATE-SUGGESTION',
}));

describe('estimateInputsTask', () => {
  const parts = estimateInputsTask.buildPrompt(estimateContext());

  it('identifies the task and validates output with the estimate suggestion schema', () => {
    expect(estimateInputsTask.id).toBe('suggest-estimate-inputs');
    expect(estimateInputsTask.schema.safeParse(planEstimateInputs(estimateContext())).success).toBe(true);
    expect(estimateInputsTask.schema.safeParse({ workstreams: [] }).success).toBe(false);
  });

  it('forbids days, weeks and money in both the system and the user prompt', () => {
    expect(parts.system).toContain('SYSTEM RULES');
    expect(parts.system).toContain('never state person-days, hours, weeks');
    expect(parts.prompt).toContain('NUMBERS RULE');
    expect(parts.prompt).toContain('It must not contain numbers of days, weeks or money');
  });

  it('grounds the request in the reviewed scope and the upstream deliverables', () => {
    expect(parts.prompt).toContain('FR_01 | functional');
    expect(parts.prompt).toContain('CAP_01 | Registration and profile | High');
    expect(parts.prompt).toContain('ARC_03 | integration | Integration bus');
    expect(parts.prompt).toContain('IS_01 | Salesforce CRM profile sync | Salesforce CRM | bidirectional event | complexity: High | readiness: unknown');
    expect(parts.prompt).toContain('AIUC_01 | Policy question answering');
    expect(parts.prompt).toContain('JSON-SCHEMA-OF-ESTIMATE-SUGGESTION');
  });

  it('asks only for inputs: workstreams in the build phases, drivers, complexity and notes', () => {
    expect(parts.prompt).toContain('PH_2, PH_3, PH_4');
    expect(parts.prompt).toContain('capability, integration, data, ai, security, infrastructure, nonFunctional');
    expect(parts.prompt).toContain('Low, Medium, High, Very High');
    expect(parts.prompt).toContain('exclusions (EX_01...)');
  });

  it('states when a deliverable list is empty instead of leaving a blank section', () => {
    const empty = estimateInputsTask.buildPrompt(estimateContext({ aiUseCases: [], integrations: [] }));
    expect(empty.prompt).toContain('AI USE CASES\nNone.');
    expect(empty.prompt).toContain('INTEGRATIONS\nNone.');
  });
});
