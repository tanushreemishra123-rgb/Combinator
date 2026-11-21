import { describe, expect, it } from 'vitest';
import type { ArchitectureContext } from '../ai/types';
import type { ArchitectureOutput } from '../domain';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { CLOUD_SERVICE_CATALOG } from './catalog/cloudServiceCatalog.data';
import { planArchitecture } from './planner';
import { validateArchitectureOutput } from './validate';

function buildContext(overrides: Partial<ArchitectureContext> = {}): ArchitectureContext {
  return {
    task: 'design-architecture',
    scope: fixtureScope(),
    customer: fixtureCustomer(),
    config: fixtureConfig(),
    platform: 'azure',
    catalog: [...CLOUD_SERVICE_CATALOG],
    capabilities: [],
    ...overrides,
  };
}

describe('validateArchitectureOutput', () => {
  it('passes a clean planner output through unchanged (aside from immaterial identity)', () => {
    const context = buildContext();
    const output = planArchitecture(context);
    const { value, issues } = validateArchitectureOutput(output, context);
    expect(issues.filter((issue) => issue.severity === 'error')).toHaveLength(0);
    expect(value.components).toEqual(output.components);
  });

  it('drops unknown requirement and assumption ids with a warning', () => {
    const context = buildContext();
    const output = planArchitecture(context);
    const firstComponent = output.components.at(0);
    if (firstComponent === undefined) {
      throw new Error('expected at least one component');
    }
    const tampered: ArchitectureOutput = {
      ...output,
      components: output.components.map((component, index) =>
        index === 0 ? { ...component, requirementIds: [...component.requirementIds, 'FR_99'], assumptionIds: [...component.assumptionIds, 'ASM_99'] } : component,
      ),
    };
    const { value, issues } = validateArchitectureOutput(tampered, context);
    const corrected = value.components.at(0);
    expect(corrected?.requirementIds).not.toContain('FR_99');
    expect(corrected?.assumptionIds).not.toContain('ASM_99');
    expect(issues.some((issue) => issue.code === 'unknown-requirement-id')).toBe(true);
    expect(issues.some((issue) => issue.code === 'unknown-assumption-id')).toBe(true);
  });

  it('flags a component with no citation left as unjustified', () => {
    const context = buildContext();
    const output = planArchitecture(context);
    const tampered: ArchitectureOutput = {
      ...output,
      components: output.components.map((component, index) => (index === 0 ? { ...component, requirementIds: [], assumptionIds: [] } : component)),
    };
    const { issues } = validateArchitectureOutput(tampered, context);
    expect(issues.some((issue) => issue.code === 'unjustified-component')).toBe(true);
  });

  it('corrects a cross-cloud service name to the platform catalog service', () => {
    const context = buildContext({ platform: 'azure' });
    const output = planArchitecture(context);
    const tampered: ArchitectureOutput = {
      ...output,
      components: output.components.map((component) =>
        component.logicalComponent === 'managed-relational-db' ? { ...component, service: 'Amazon RDS for PostgreSQL' } : component,
      ),
    };
    const { value, issues } = validateArchitectureOutput(tampered, context);
    const corrected = value.components.find((component) => component.logicalComponent === 'managed-relational-db');
    expect(corrected?.service).toContain('Azure Database for PostgreSQL');
    expect(issues.some((issue) => issue.code === 'cross-cloud-service')).toBe(true);
  });

  it('renumbers duplicate component ids so every id stays unique', () => {
    const context = buildContext();
    const output = planArchitecture(context);
    const [first, second, ...rest] = output.components;
    if (first === undefined || second === undefined) {
      throw new Error('expected at least two components');
    }
    const tampered: ArchitectureOutput = { ...output, components: [first, { ...second, id: first.id }, ...rest] };
    const { value, issues } = validateArchitectureOutput(tampered, context);
    const ids = value.components.map((component) => component.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(issues.some((issue) => issue.code === 'duplicate-component-id')).toBe(true);
  });

  it('removes flows that reference an unknown component id', () => {
    const context = buildContext();
    const output = planArchitecture(context);
    const tampered: ArchitectureOutput = { ...output, flows: [...output.flows, { from: 'ARC_99', to: 'ARC_98', label: 'bogus', kind: 'request' }] };
    const { value, issues } = validateArchitectureOutput(tampered, context);
    expect(value.flows.some((flow) => flow.from === 'ARC_99')).toBe(false);
    expect(issues.some((issue) => issue.code === 'unknown-flow-endpoint')).toBe(true);
  });

  it('keeps a flow to a well-formed external system reference', () => {
    const context = buildContext();
    const output = planArchitecture(context);
    const { value } = validateArchitectureOutput(output, context);
    expect(value.flows.some((flow) => flow.to.startsWith('ext:'))).toBe(true);
  });

  it('flags a dependency that names neither a planned component nor a known external system', () => {
    const context = buildContext();
    const output = planArchitecture(context);
    const firstComponent = output.components.at(0);
    if (firstComponent === undefined) {
      throw new Error('expected at least one component');
    }
    const tampered: ArchitectureOutput = {
      ...output,
      components: output.components.map((component, index) => (index === 0 ? { ...component, dependencies: [...component.dependencies, 'Nonexistent Service'] } : component)),
    };
    const { issues } = validateArchitectureOutput(tampered, context);
    expect(issues.some((issue) => issue.code === 'dangling-dependency' && issue.message.includes('Nonexistent Service'))).toBe(true);
  });

  it('does not flag a dependency on a planned component or a known existing system', () => {
    const context = buildContext();
    const output = planArchitecture(context);
    const { issues } = validateArchitectureOutput(output, context);
    expect(issues.some((issue) => issue.code === 'dangling-dependency')).toBe(false);
  });

  it('corrects output.platform to match the requested platform', () => {
    const context = buildContext({ platform: 'gcp' });
    const output = planArchitecture(context);
    const tampered: ArchitectureOutput = { ...output, platform: 'aws' };
    const { value, issues } = validateArchitectureOutput(tampered, context);
    expect(value.platform).toBe('gcp');
    expect(issues.some((issue) => issue.code === 'platform-mismatch' && issue.severity === 'error')).toBe(true);
  });
});
