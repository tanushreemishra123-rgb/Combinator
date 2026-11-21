import { describe, expect, it } from 'vitest';
import type { ArchitectureContext } from '../ai/types';
import type { CloudPlatform, ScopeItem, ScopeModel } from '../domain';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { CLOUD_SERVICE_CATALOG, getCatalogEntry } from './catalog/cloudServiceCatalog.data';
import { CONDITIONAL_RULES, FOUNDATION_RULES } from './componentRules.data';
import { planArchitecture } from './planner';

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

/** A scope item to use as a spread base for a hand-built variant, never undefined. */
function itemAt(scope: ScopeModel, index: number): ScopeItem {
  const found = scope.items.at(index);
  if (found === undefined) {
    throw new Error(`scope has no item at index ${index}`);
  }
  return found;
}

function withoutItems(scope: ScopeModel, predicate: (item: ScopeItem) => boolean): ScopeModel {
  return { ...scope, items: scope.items.filter((item) => !predicate(item)) };
}

function emptyScope(): ScopeModel {
  return { summary: 'Nothing reviewed yet', items: [], version: 0, approvedAt: null, approvedVersion: null, issues: [] };
}

describe('componentRules data integrity', () => {
  it('every foundation and conditional rule points at a real catalog entry', () => {
    for (const rule of [...FOUNDATION_RULES, ...CONDITIONAL_RULES]) {
      expect(getCatalogEntry(rule.logicalComponent), `${rule.key} -> ${rule.logicalComponent}`).toBeDefined();
    }
  });
});

describe('planArchitecture', () => {
  it('produces sequential, unique ARC ids and at least one component', () => {
    const output = planArchitecture(buildContext());
    expect(output.components.length).toBeGreaterThan(0);
    expect(output.components.map((component) => component.id)).toEqual(output.components.map((_, index) => `ARC_${String(index + 1).padStart(2, '0')}`));
  });

  it('gives every component at least one requirement or assumption ref', () => {
    const output = planArchitecture(buildContext());
    for (const component of output.components) {
      expect(component.requirementIds.length + component.assumptionIds.length, component.name).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same input', () => {
    const first = planArchitecture(buildContext());
    const second = planArchitecture(buildContext());
    expect(second).toEqual(first);
  });

  it('always includes the foundation components for a normally populated scope', () => {
    const output = planArchitecture(buildContext());
    const names = output.components.map((component) => component.name);
    expect(names).toContain('Web Front End');
    expect(names).toContain('API Layer');
    expect(names).toContain('Application Compute Runtime');
    expect(names).toContain('Primary Relational Database');
    expect(names).toContain('Customer Identity and Access Management');
  });

  it('produces the same set of logical components across platforms, only the service differs', () => {
    const platforms: readonly CloudPlatform[] = ['aws', 'azure', 'gcp'];
    const outputs = platforms.map((platform) => planArchitecture(buildContext({ platform })));
    const logicalSets = outputs.map((output) => output.components.map((component) => component.logicalComponent).sort());
    expect(logicalSets[1]).toEqual(logicalSets.at(0));
    expect(logicalSets[2]).toEqual(logicalSets.at(0));

    const relationalServices = outputs.map((output) => output.components.find((component) => component.logicalComponent === 'managed-relational-db')?.service);
    expect(new Set(relationalServices).size).toBe(3);
    expect(relationalServices.at(1)).toContain('Azure Database for PostgreSQL');
  });

  it('sets output.platform to the requested platform', () => {
    const output = planArchitecture(buildContext({ platform: 'gcp' }));
    expect(output.platform).toBe('gcp');
  });

  describe('conditional components appear and disappear with their triggering signal', () => {
    it('includes the AI components only when an ai:* signal is present', () => {
      const withAi = planArchitecture(buildContext());
      expect(withAi.components.map((c) => c.logicalComponent)).toEqual(expect.arrayContaining(['llm-platform', 'vector-search']));

      const withoutAi = planArchitecture(buildContext({ scope: withoutItems(fixtureScope(), (item) => item.id === 'FR_03') }));
      expect(withoutAi.components.map((c) => c.logicalComponent)).not.toContain('llm-platform');
      expect(withoutAi.components.map((c) => c.logicalComponent)).not.toContain('vector-search');
    });

    it('includes integration components only when an integration item is present', () => {
      const withIntegration = planArchitecture(buildContext());
      expect(withIntegration.components.map((c) => c.logicalComponent)).toContain('integration-service');

      const withoutIntegration = planArchitecture(buildContext({ scope: withoutItems(fixtureScope(), (item) => item.id === 'INT_01') }));
      expect(withoutIntegration.components.map((c) => c.logicalComponent)).not.toContain('integration-service');
      expect(withoutIntegration.components.map((c) => c.logicalComponent)).not.toContain('event-bus');
    });

    it('includes availability/DR components only when nfr:availability is present', () => {
      const withAvailability = planArchitecture(buildContext());
      expect(withAvailability.components.map((c) => c.logicalComponent)).toEqual(expect.arrayContaining(['availability-scaling', 'dr-multi-region']));

      const withoutAvailability = planArchitecture(buildContext({ scope: withoutItems(fixtureScope(), (item) => item.id === 'NFR_01') }));
      expect(withoutAvailability.components.map((c) => c.logicalComponent)).not.toContain('availability-scaling');
      expect(withoutAvailability.components.map((c) => c.logicalComponent)).not.toContain('dr-multi-region');
    });

    it('does not include availability/DR components when only a functional (non-NFR) item carries the availability signal', () => {
      const scope = fixtureScope();
      const withoutNfr = withoutItems(scope, (item) => item.id === 'NFR_01');
      const channelRequirementOnly: ScopeModel = {
        ...withoutNfr,
        items: [...withoutNfr.items, { ...itemAt(scope, 2), id: 'FR_90', kind: 'functional', title: 'Assistant availability through the portal', signals: ['nfr:availability'] }],
      };
      const output = planArchitecture(buildContext({ scope: channelRequirementOnly }));
      expect(output.components.map((c) => c.logicalComponent)).not.toContain('availability-scaling');
      expect(output.components.map((c) => c.logicalComponent)).not.toContain('dr-multi-region');
    });

    it('does not include SFTP file transfer when only a non-integration item carries the file signal', () => {
      const scope = fixtureScope();
      const dataItemOnly: ScopeModel = {
        ...scope,
        items: [...scope.items, { ...itemAt(scope, 2), id: 'DATA_90', kind: 'data', title: 'Renewal Tracking Data (Spreadsheet-Based)', signals: ['integration:file'] }],
      };
      const output = planArchitecture(buildContext({ scope: dataItemOnly }));
      expect(output.components.map((c) => c.logicalComponent)).not.toContain('sftp-file-transfer');
    });
  });

  it('cites the requirement ids for a conditional component (search service <- FR_02)', () => {
    const output = planArchitecture(buildContext());
    const search = output.components.find((component) => component.logicalComponent === 'search-service');
    expect(search?.requirementIds).toContain('FR_02');
  });

  it('proposes cache when expected users are high even without an explicit scalability signal', () => {
    const scope = withoutItems(fixtureScope(), (item) => item.id === 'NFR_02');
    const output = planArchitecture(buildContext({ scope, config: fixtureConfig({ expectedUsers: 250_000 }) }));
    expect(output.components.map((c) => c.logicalComponent)).toContain('cache');
  });

  it('never crashes on a completely empty scope and still returns a valid, well-formed output', () => {
    const output = planArchitecture(buildContext({ scope: emptyScope(), config: fixtureConfig({ environments: null }) }));
    expect(output.components.length).toBeGreaterThan(0);
    expect(output.summary.length).toBeGreaterThan(0);
    expect(output.environments.length).toBeGreaterThan(0);
    expect(output.platform).toBe('azure');
  });

  it('flags an assumption-only environment count with an explicit note', () => {
    const output = planArchitecture(buildContext({ config: fixtureConfig({ environments: null }) }));
    expect(output.environments.some((environment) => environment.sizing.includes('assumption'))).toBe(true);
  });

  it('includes a flow to an external system for the CRM integration', () => {
    const output = planArchitecture(buildContext());
    const externalFlow = output.flows.find((flow) => flow.to.includes('Salesforce'));
    expect(externalFlow).toBeDefined();
    expect(externalFlow?.kind).toBe('event');
  });

  it('every flow endpoint is either a component id or a well-formed external reference', () => {
    const output = planArchitecture(buildContext());
    const componentIds = new Set(output.components.map((component) => component.id));
    for (const flow of output.flows) {
      const fromKnown = componentIds.has(flow.from) || flow.from.startsWith('ext:');
      const toKnown = componentIds.has(flow.to) || flow.to.startsWith('ext:');
      expect(fromKnown, flow.from).toBe(true);
      expect(toKnown, flow.to).toBe(true);
    }
  });

  it('gives cross-cutting foundation components their own specific citations, never one shared identical list', () => {
    const output = planArchitecture(buildContext());
    const byLogical = new Map(output.components.map((component) => [component.logicalComponent, component]));
    const monitoring = byLogical.get('monitoring');
    const ciCd = byLogical.get('ci-cd');
    const secretsManager = byLogical.get('secrets-manager');
    const networkProtection = byLogical.get('private-networking');
    expect(monitoring?.requirementIds).toEqual(['NFR_01', 'SEC_01']);
    expect(ciCd?.requirementIds).toEqual(['TECH_01', 'CON_01']);
    expect(networkProtection?.requirementIds).toEqual(['FR_01', 'SEC_01']);
    // None of these cross-cutting components should collapse onto the identical full FR list.
    const allFunctionalIds = ['FR_01', 'FR_02', 'FR_03'];
    for (const component of [monitoring, ciCd, secretsManager, networkProtection]) {
      expect(component?.requirementIds, component?.name).not.toEqual(allFunctionalIds);
    }
  });

  it('proposes a WAF/DDoS component from the platform catalog when a network-security item is in scope', () => {
    const output = planArchitecture(buildContext({ platform: 'aws' }));
    const waf = output.components.find((component) => component.logicalComponent === 'waf-ddos');
    expect(waf?.service).toContain('WAF');
    expect(waf?.requirementIds.length).toBeGreaterThan(0);
  });

  it('never cites a persona, risk, gap, dependency or question as a requirement/assumption id', () => {
    const output = planArchitecture(buildContext());
    const nonCitableIds = new Set(['PER_01', 'RSK_01', 'GAP_01', 'DEP_01', 'Q_01', 'Q_02']);
    for (const component of output.components) {
      for (const id of [...component.requirementIds, ...component.assumptionIds]) {
        expect(nonCitableIds.has(id), `${component.name} cited ${id}`).toBe(false);
      }
    }
  });

  it('omits a conditional component whose only trigger is an unresolved gap, and records why in the summary', () => {
    const scope = fixtureScope();
    const gapOnly: ScopeItem = { ...itemAt(scope, 0), id: 'GAP_90', kind: 'gap', title: 'Mobile app vs. website undecided', description: 'Whether a native mobile app is needed is unresolved.', signals: ['capability:mobile'] };
    const output = planArchitecture(buildContext({ scope: { ...scope, items: [...scope.items, gapOnly] } }));
    expect(output.components.map((c) => c.logicalComponent)).not.toContain('mobile-backend');
    const pendingNote = output.summary.find((statement) => statement.text.includes('Mobile Backend'));
    expect(pendingNote?.text).toContain('GAP_90');
    expect(pendingNote?.refs).toEqual(['GAP_90']);
  });

  it('adds a lightweight-alternative trade-off when a heavier component is driven only by a Low-priority, undefined requirement', () => {
    const scope = fixtureScope();
    const lowPriorityReporting: ScopeItem = { ...itemAt(scope, 0), id: 'FR_90', kind: 'functional', title: 'Ad hoc reporting', description: 'Some reporting may be useful eventually.', priority: 'Low', signals: ['data:warehouse'] };
    const output = planArchitecture(buildContext({ scope: { ...scope, items: [...scope.items, lowPriorityReporting] } }));
    const warehouse = output.components.find((c) => c.logicalComponent === 'data-warehouse');
    expect(warehouse?.requirementIds).toEqual(['FR_90']);
    expect(warehouse?.tradeOffs.some((tradeOff) => tradeOff.includes('reporting views directly in the primary relational database'))).toBe(true);
  });

  it('labels a later-phase integration as such in its dependency title, without duplicating the entry under two labels', () => {
    const scope = fixtureScope();
    const laterPhaseIntegration: ScopeItem = { ...itemAt(scope, 0), id: 'INT_90', kind: 'integration', title: 'Legacy directory sync (later phase)', description: 'Deferred to a later phase; not required for go-live.', signals: ['integration:crm'] };
    const output = planArchitecture(buildContext({ scope: { ...scope, items: [...scope.items, laterPhaseIntegration] } }));
    const integrationService = output.components.find((c) => c.name === 'Integration Service');
    expect(integrationService?.dependencies.filter((dependency) => dependency.includes('Salesforce CRM'))).toEqual(['Salesforce CRM (later phase)']);
  });

  it('never lists a dependency/risk/gap item’s own narrative title in a component’s Dependencies column', () => {
    const output = planArchitecture(buildContext());
    for (const component of output.components) {
      expect(component.dependencies).not.toContain('Salesforce API access'); // DEP_01's own title
      expect(component.dependencies).not.toContain('Document library quality'); // RSK_01's own title
    }
  });

  it('describes the web front end and identity in internal-staff terms once every persona is internal', () => {
    const scope = fixtureScope();
    const internalPersona: ScopeItem = { ...scope.items.find((i) => i.id === 'PER_01') as ScopeItem, title: 'Operations Analyst', description: 'Internal operations staff who review queues and configuration.' };
    const output = planArchitecture(buildContext({ scope: { ...scope, items: scope.items.map((i) => (i.id === 'PER_01' ? internalPersona : i)) } }));
    const webFrontEnd = output.components.find((c) => c.logicalComponent === 'web-hosting-cdn');
    const identity = output.components.find((c) => c.logicalComponent === 'identity-customer');
    expect(webFrontEnd?.purpose).toContain('internal web experience');
    expect(webFrontEnd?.purpose).not.toContain('customer-facing');
    expect(identity?.purpose).toContain('internal staff');
  });

  describe('dependencies never dangle (ARC-2)', () => {
    function bareDependencyName(dependency: string): string {
      const laterPhaseSuffix = ' (later phase)';
      return dependency.endsWith(laterPhaseSuffix) ? dependency.slice(0, -laterPhaseSuffix.length) : dependency;
    }

    it('lists only planned component names or scope existingSystem titles as dependencies', () => {
      const scope = fixtureScope();
      const output = planArchitecture(buildContext({ scope }));
      const componentNames = new Set(output.components.map((component) => component.name));
      const systemTitles = new Set(scope.items.filter((item) => item.kind === 'existingSystem').map((item) => item.title));
      for (const component of output.components) {
        for (const dependency of component.dependencies) {
          const valid = componentNames.has(dependency) || systemTitles.has(bareDependencyName(dependency));
          expect(valid, `${component.name} lists dangling dependency '${dependency}'`).toBe(true);
        }
      }
    });

    it('drops a static dependency on a component that was not triggered in this run (SFTP -> Scheduler)', () => {
      const scope = fixtureScope();
      const fileTransferOnly: ScopeItem = { ...itemAt(scope, 0), id: 'INT_90', kind: 'integration', title: 'Nightly renewal file exchange', description: 'Exchange a nightly file with the partner system.', signals: ['integration:file'] };
      const output = planArchitecture(buildContext({ scope: { ...scope, items: [...scope.items, fileTransferOnly] } }));
      expect(output.components.map((c) => c.logicalComponent)).not.toContain('scheduler');
      const sftp = output.components.find((c) => c.logicalComponent === 'sftp-file-transfer');
      expect(sftp?.dependencies).not.toContain('Scheduler');
    });

    it('does not attach an unrelated external system to a component whose citing item is not an integration requirement', () => {
      // FR_02 (Policy document search) shares no integration kind, but if it shared a signal with an
      // existingSystem it must not turn into a dependency on a non-integration component like Search Service.
      const output = planArchitecture(buildContext());
      const searchService = output.components.find((c) => c.logicalComponent === 'search-service');
      expect(searchService?.dependencies.every((dependency) => !dependency.includes('Salesforce'))).toBe(true);
    });
  });
});
