import type { Capability, ScopeItem, ScopeModel } from '../domain';
import { fixtureScope } from '../test/fixtures';
import { buildJourneys, MAX_JOURNEY_STEPS } from './journeys';

const IDENTITY: Capability = {
  id: 'CAP_01',
  name: 'Identity, Sign-In and Profile Management',
  scope: 'Provide identity.',
  requirementIds: ['FR_01'],
  priority: 'High',
  dependencies: [],
  label: 'customer-requested',
  module: 'Platform Foundation',
  workstream: 'Identity and Access',
  deliveryPackage: 'Package 1 - Foundation',
  acceptance: [],
};
const SEARCH: Capability = { ...IDENTITY, id: 'CAP_02', name: 'Search and Discovery', requirementIds: ['FR_02'], priority: 'Medium' };
const MIGRATION: Capability = { ...IDENTITY, id: 'CAP_03', name: 'Data Migration', requirementIds: ['DATA_01'], priority: 'High' };

function withPersona(overrides: Partial<ScopeItem>): ScopeModel {
  const scope = fixtureScope();
  return { ...scope, items: scope.items.map((item) => (item.kind === 'persona' ? { ...item, ...overrides } : item)) };
}

describe('buildJourneys', () => {
  it('follows the functional requirements that name the persona, in customer order, with the delivering capability', () => {
    const journey = buildJourneys(fixtureScope(), [MIGRATION, SEARCH, IDENTITY]).at(0);
    expect(journey?.persona).toBe('PER_01');
    expect(journey?.steps).toEqual([
      'Step 1: Members register, sign in with SSO and update their profile (FR_01; delivered by CAP_01).',
      'Step 2: Members search and download their policy documents (FR_02; delivered by CAP_02).',
    ]);
    expect(journey?.requirementIds).toEqual(['FR_01', 'FR_02']);
  });

  it('keeps a step grounded in its requirement when no capability delivers it yet', () => {
    expect(buildJourneys(fixtureScope(), []).at(0)?.steps.at(0)).toBe('Step 1: Members register, sign in with SSO and update their profile (FR_01).');
  });

  it('includes requirements linked to the persona in either direction', () => {
    expect(buildJourneys(withPersona({ relatedIds: ['FR_03'] }), []).at(0)?.requirementIds).toEqual(['FR_01', 'FR_02', 'FR_03']);
    const scope = fixtureScope();
    const linked: ScopeModel = { ...scope, items: scope.items.map((item) => (item.id === 'FR_03' ? { ...item, relatedIds: ['PER_01'] } : item)) };
    expect(buildJourneys(linked, []).at(0)?.requirementIds).toEqual(['FR_01', 'FR_02', 'FR_03']);
  });

  it('ignores a passing mention of the persona late in a requirement', () => {
    const scope = fixtureScope();
    const passing: ScopeModel = {
      ...scope,
      items: scope.items.map((item) => (item.id === 'FR_02' ? { ...item, title: 'Policy document search', description: 'Index every policy document so that it can be attached to the right member record.' } : item)),
    };
    expect(buildJourneys(passing, []).at(0)?.requirementIds).toEqual(['FR_01']);
  });

  it('names likely touchpoints instead of numbered steps when no requirement names the persona', () => {
    const journey = buildJourneys(withPersona({ title: 'Compliance Auditor (External)' }), [MIGRATION, SEARCH, IDENTITY]).at(0);
    expect(journey?.steps).toHaveLength(1);
    const statement = journey?.steps.at(0) ?? '';
    expect(statement).toContain('No reviewed requirement names Compliance Auditor (External) directly');
    expect(statement).toContain('to be defined in discovery');
    // Data Migration delivers no functional requirement in the fixture (DATA_01 is not functional), so it is never a touchpoint.
    expect(statement).not.toContain('Data Migration');
    expect(statement).toContain('Identity, Sign-In and Profile Management');
    expect(statement).toContain('Search and Discovery');
    expect(journey?.requirementIds).toEqual(['FR_01', 'FR_02']);
  });

  it('orders inferred touchpoints as a workflow (identity before search) rather than by priority rank', () => {
    // SEARCH is Medium priority and IDENTITY is High, so a priority-only sort would list Search first.
    const journey = buildJourneys(withPersona({ title: 'Compliance Auditor (External)' }), [SEARCH, IDENTITY]).at(0);
    const statement = journey?.steps.at(0) ?? '';
    expect(statement.indexOf('Identity, Sign-In and Profile Management')).toBeLessThan(statement.indexOf('Search and Discovery'));
  });

  it('caps an inferred journey at four touchpoints, dropping the lowest-priority one first', () => {
    const many: Capability[] = [
      IDENTITY,
      SEARCH,
      { ...IDENTITY, id: 'CAP_04', name: 'Document Management', requirementIds: ['FR_02'] },
      { ...IDENTITY, id: 'CAP_05', name: 'Notifications and Alerts', requirementIds: ['FR_01'] },
      { ...IDENTITY, id: 'CAP_06', name: 'Dashboards and Reporting', requirementIds: ['FR_02'] },
    ];
    const journey = buildJourneys(withPersona({ title: 'Compliance Auditor (External)' }), many).at(0);
    const statement = journey?.steps.at(0) ?? '';
    const mentioned = many.filter((capability) => statement.includes(capability.name));
    expect(mentioned).toHaveLength(4);
    // SEARCH is the only Medium-priority entry, so it is the one dropped by the four-touchpoint cap.
    expect(statement).not.toContain('Search and Discovery');
  });

  it('caps a long journey and points to the remaining requirements by id', () => {
    const scope = fixtureScope();
    const template = scope.items.find((item) => item.id === 'FR_02');
    if (template === undefined) {
      throw new Error('fixture scope no longer contains FR_02');
    }
    const extra = Array.from({ length: MAX_JOURNEY_STEPS }, (_, index) => ({ ...template, id: `FR_1${index}` }));
    const journey = buildJourneys({ ...scope, items: [...scope.items, ...extra] }, []).at(0);
    expect(journey?.steps).toHaveLength(MAX_JOURNEY_STEPS + 1);
    expect(journey?.steps.at(-1)).toContain('Member is also named by FR_14, FR_15');
  });

  it('returns a well-formed step when nothing functional exists, and no journey without a persona', () => {
    const scope = fixtureScope();
    const onlyPersona: ScopeModel = { ...scope, items: scope.items.filter((item) => item.kind === 'persona') };
    expect(buildJourneys(onlyPersona, []).at(0)?.steps).toEqual([
      'No reviewed requirement names Member directly and no functional capability is recorded yet, so this journey is to be defined once discovery describes Member\'s actions.',
    ]);
    expect(buildJourneys({ ...scope, items: [] }, [IDENTITY])).toEqual([]);
  });
});
