import { AnalysisOutputSchema } from '../domain';
import { fixtureCustomer, fixtureDocument } from '../test/fixtures';
import { MAX_PROMPT_LINES, analyzeRequirementsTask, renderNumberedSource } from './prompt';
import { analyzeContextFor } from './testKit';

vi.mock('../ai/promptKit', () => ({
  buildSystemPrompt: (role: string) => `SYSTEM RULES | ${role}`,
  describeCustomerForPrompt: (customer: { customerName: string }) => `Customer: ${customer.customerName}`,
  jsonContract: () => 'JSON-SCHEMA-CONTRACT',
}));

describe('analyzeRequirementsTask', () => {
  const context = { task: 'analyze-requirements' as const, document: fixtureDocument(), customer: fixtureCustomer(), scenarioId: null };
  const { system, prompt } = analyzeRequirementsTask.buildPrompt(context);

  it('identifies the task and validates output with the analysis schema', () => {
    expect(analyzeRequirementsTask.id).toBe('analyze-requirements');
    expect(analyzeRequirementsTask.schema).toBe(AnalysisOutputSchema);
  });

  it('builds the system prompt from the shared rules and the analyst role', () => {
    expect(system).toContain('SYSTEM RULES');
    expect(system).toContain('business analyst');
  });

  it('shows the source as numbered lines under their section titles', () => {
    expect(prompt).toContain('## [S2] Functional needs');
    expect(prompt).toContain('L7: The portal must sync member profiles with our Salesforce CRM in near real time.');
    expect(prompt).toContain('L13: We need to go live before the annual renewal period; our team prefers Microsoft Azure.');
  });

  it('contains the ID convention for every kind, the provenance rules and the output contract', () => {
    for (const expected of ['functional -> FR_01', 'integration -> INT_01', 'nonFunctional -> NFR_01', 'question -> Q_01', 'gap -> GAP_01']) {
      expect(prompt).toContain(expected);
    }
    expect(prompt).toContain("'customer-stated'");
    expect(prompt).toContain("'ai-inferred'");
    expect(prompt).toContain("'assumed'");
    expect(prompt).toContain('verbatim');
    expect(prompt).toContain('Never invent');
    expect(prompt).toContain('deliveryDeadline');
    expect(prompt).toContain('JSON-SCHEMA-CONTRACT');
    expect(prompt).toContain('Customer: Northwind Mutual');
  });
});

describe('renderNumberedSource', () => {
  it('omits blank lines and states when a very long source was truncated', () => {
    const lines = Array.from({ length: MAX_PROMPT_LINES + 5 }, (_, index) => (index === 1 ? '' : `Requirement ${index + 1}`));
    const rendered = renderNumberedSource(analyzeContextFor(lines).document);
    expect(rendered).toContain('L1: Requirement 1');
    expect(rendered).not.toContain('L2:');
    expect(rendered).not.toContain(`L${MAX_PROMPT_LINES + 1}:`);
    expect(rendered).toContain(`Source truncated after line ${MAX_PROMPT_LINES}`);
  });
});
