import { z } from 'zod';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { buildSystemPrompt, describeConfigForPrompt, describeCustomerForPrompt, describeScopeForPrompt, jsonContract } from './promptKit';

describe('buildSystemPrompt', () => {
  it('includes the role and the shared grounding rules', () => {
    const prompt = buildSystemPrompt('You are a PRD-generation assistant for an enterprise cloud solution architect.');
    expect(prompt).toContain('You are a PRD-generation assistant');
    expect(prompt).toContain('Cite only requirement, scope and component IDs');
    expect(prompt).toContain('Never output effort, cost or timeline numbers');
    expect(prompt).toContain('single JSON object');
  });

  it('never mentions internal Zod/schema plumbing to the model', () => {
    const prompt = buildSystemPrompt('Role');
    expect(prompt.toLowerCase()).not.toContain('zod');
  });
});

describe('describeScopeForPrompt', () => {
  it('lists every active, approved item one per line with id, kind, priority and provenance', () => {
    const description = describeScopeForPrompt(fixtureScope());
    const lines = description.split('\n');
    expect(lines.length).toBe(fixtureScope().items.length);
    expect(lines.some((line) => line.startsWith('FR_01 | functional | High | customer-stated |'))).toBe(true);
  });

  it('excludes rejected and out-of-scope items', () => {
    const scope = fixtureScope();
    const withRejection = {
      ...scope,
      items: scope.items.map((item, index) => (index === 0 ? { ...item, review: 'rejected' as const } : item)),
    };
    const description = describeScopeForPrompt(withRejection);
    const firstItem = scope.items.at(0);
    expect(description).not.toContain(`${firstItem?.id} |`);
  });

  it('returns a clear message when there are no active items', () => {
    const scope = fixtureScope();
    const emptyScope = { ...scope, items: scope.items.map((item) => ({ ...item, inScope: false })) };
    expect(describeScopeForPrompt(emptyScope)).toMatch(/no active/i);
  });
});

describe('describeCustomerForPrompt', () => {
  it('renders every customer field', () => {
    const description = describeCustomerForPrompt(fixtureCustomer());
    expect(description).toContain('Northwind Mutual');
    expect(description).toContain('Insurance');
    expect(description).toContain('EU');
  });

  it('shows a placeholder instead of an empty string for missing notes', () => {
    const description = describeCustomerForPrompt({ ...fixtureCustomer(), notes: '' });
    expect(description).not.toMatch(/Notes:\s*$/m);
    expect(description).toContain('None recorded.');
  });
});

describe('describeConfigForPrompt', () => {
  it('renders a fully specified configuration', () => {
    const description = describeConfigForPrompt(fixtureConfig());
    expect(description).toContain('AZURE');
    expect(description).toContain('50000');
  });

  it('never emits "null" or "undefined" for unspecified fields', () => {
    const description = describeConfigForPrompt(fixtureConfig({ cloudPlatform: null, expectedUsers: null, deliveryDeadlineWeeks: null, environments: null }));
    expect(description).not.toMatch(/null|undefined/i);
    expect(description).toContain('Not yet specified');
  });
});

describe('jsonContract', () => {
  it('returns a JSON Schema string describing the shape of a simple object schema', () => {
    const schema = z.object({ id: z.string(), count: z.number() });
    const contract = jsonContract(schema);
    const parsed = JSON.parse(contract) as { properties?: Record<string, unknown> };
    expect(parsed.properties).toHaveProperty('id');
    expect(parsed.properties).toHaveProperty('count');
  });

  it('falls back to a plain-text description if schema conversion throws', () => {
    const throwingSchema = { toJSONSchema: undefined } as unknown as z.ZodType;
    expect(() => jsonContract(throwingSchema)).not.toThrow();
    expect(jsonContract(throwingSchema).length).toBeGreaterThan(0);
  });
});
