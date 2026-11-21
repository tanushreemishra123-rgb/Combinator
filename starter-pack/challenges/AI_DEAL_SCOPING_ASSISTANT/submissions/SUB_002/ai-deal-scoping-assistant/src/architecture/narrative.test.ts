import { describe, expect, it } from 'vitest';
import type { ArchitectureComponent } from '../domain';
import { buildSecurityStatements, buildSummary, type PendingGapNote } from './narrative';

function component(overrides: Partial<ArchitectureComponent>): ArchitectureComponent {
  return {
    id: 'ARC_01',
    name: 'Test Component',
    area: 'backend',
    logicalComponent: 'test-component',
    service: 'Test Service',
    requirementIds: [],
    assumptionIds: [],
    purpose: 'Test purpose.',
    rationale: 'Test rationale.',
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
    ...overrides,
  };
}

describe('buildSummary', () => {
  it('cites every id directly when the component list stays under the cap', () => {
    const components = [component({ requirementIds: ['FR_01', 'FR_02'] })];
    const headline = buildSummary('aws', components, []).at(0);
    expect(headline?.refs).toEqual(['FR_01', 'FR_02']);
    expect(headline?.text).not.toContain('spans the full reviewed scope');
  });

  it('caps the citation list and describes the rest qualitatively once the scope is large', () => {
    const manyIds = Array.from({ length: 10 }, (_, index) => `FR_${String(index + 1).padStart(2, '0')}`);
    const components = [component({ requirementIds: manyIds })];
    const headline = buildSummary('aws', components, []).at(0);
    expect(headline?.refs.length).toBe(6);
    expect(headline?.text).toContain('spans the full reviewed scope');
  });

  it('never lists the same id twice across components', () => {
    const components = [component({ id: 'ARC_01', requirementIds: ['FR_01'] }), component({ id: 'ARC_02', requirementIds: ['FR_01'] })];
    const headline = buildSummary('aws', components, []).at(0);
    expect(headline?.refs).toEqual(['FR_01']);
  });

  it('appends one statement per omitted, gap-only pending component', () => {
    const pendingGaps: PendingGapNote[] = [{ componentName: 'Mobile Backend', gapId: 'GAP_08', gapTitle: 'Mobile app vs. website undecided' }];
    const statements = buildSummary('aws', [component({})], [], pendingGaps);
    expect(statements).toHaveLength(2);
    expect(statements[1]?.text).toContain('Mobile Backend');
    expect(statements[1]?.text).toContain('GAP_08');
    expect(statements[1]?.refs).toEqual(['GAP_08']);
  });
});

describe('buildSecurityStatements', () => {
  it('describes identity in end-user terms when the audience is not internal-only', () => {
    const componentsByKey = new Map([['identity', component({ id: 'ARC_05', service: 'Test IdP' })]]);
    const [statement] = buildSecurityStatements(componentsByKey, false);
    expect(statement?.text).toContain('end-user session');
    expect(statement?.text).not.toContain('internal staff');
  });

  it('switches to internal-staff wording once the audience is internal-only', () => {
    const componentsByKey = new Map([['identity', component({ id: 'ARC_05', service: 'Test IdP' })]]);
    const [statement] = buildSecurityStatements(componentsByKey, true);
    expect(statement?.text).toContain('internal staff session');
    expect(statement?.text).not.toContain('end-user');
  });

  it('omits a control whose component was never planned', () => {
    const statements = buildSecurityStatements(new Map(), false);
    expect(statements).toEqual([]);
  });

  it('describes WAF/DDoS protection as filtering traffic at the edge', () => {
    const componentsByKey = new Map([['waf-ddos', component({ id: 'ARC_09', service: 'Test WAF' })]]);
    const [statement] = buildSecurityStatements(componentsByKey, false);
    expect(statement?.text).toContain('Test WAF');
    expect(statement?.text).toContain('edge');
  });
});
