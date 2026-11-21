import type { ScopeItem, ScopeItemKind, ScopeModel } from '../domain';
import { buildIntegrations } from './integrations';
import { fixtureArchitectureDesign } from './testFixtures';

const NOW = '2026-09-19T00:00:00.000Z';

/** A minimal, valid ScopeItem so each test only overrides the fields it cares about. */
function scopeItem(overrides: Partial<ScopeItem> & { id: string; kind: ScopeItemKind; title: string; description: string }): ScopeItem {
  return {
    priority: 'Medium',
    provenance: 'customer-stated',
    source: null,
    relatedIds: [],
    affectsInputs: [],
    critical: false,
    signals: [],
    review: 'approved',
    inScope: true,
    userEdited: false,
    resolved: false,
    resolution: '',
    ...overrides,
  };
}

function scopeModel(items: ScopeItem[]): ScopeModel {
  return { summary: 'test scope', items, version: 1, approvedAt: NOW, approvedVersion: 1, issues: [] };
}

const components = fixtureArchitectureDesign().components;

describe('buildIntegrations - retiring and manual-process existing systems', () => {
  it('excludes an existing system the customer says is being replaced when no parallel run is requested', () => {
    const system = scopeItem({ id: 'SYS_01', kind: 'existingSystem', title: 'Old Claims Portal', description: 'The current claims portal, being replaced by this program.' });
    const scope = scopeModel([system]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result).toEqual([]);
  });

  it('models a retiring system as a time-boxed cutover interface when a related item asks for a parallel run', () => {
    const system = scopeItem({ id: 'SYS_01', kind: 'existingSystem', title: 'Old Claims Portal', description: 'The current claims portal, being replaced by this program.' });
    const cutover = scopeItem({
      id: 'CON_01',
      kind: 'constraint',
      title: 'Parallel run',
      description: 'Old Claims Portal must keep running in parallel with the new portal for a 60-day stabilisation period after cutover.',
      relatedIds: ['SYS_01'],
    });
    const scope = scopeModel([system, cutover]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result).toHaveLength(1);
    expect(result.at(0)?.name).toBe('Old Claims Portal (parallel-run cutover)');
    expect(result.at(0)?.requirementIds).toEqual(['SYS_01', 'CON_01']);
    expect(result.at(0)?.dataSync).toContain('time-boxed parallel-run interface');
    expect(result.at(0)?.dataSync).toContain('CON_01');
  });

  it('excludes a manual/spreadsheet process even when a retirement deadline is also stated (it is not a system to build an interface with)', () => {
    const system = scopeItem({
      id: 'SYS_01',
      kind: 'existingSystem',
      title: 'Legacy Reconciliation Spreadsheet',
      description: 'A manual spreadsheet process the COO wants eliminated.',
    });
    const deadline = scopeItem({
      id: 'CON_01',
      kind: 'constraint',
      title: 'Retire the spreadsheet',
      description: 'Retire the spreadsheet within 90 days of go-live.',
      relatedIds: ['SYS_01'],
    });
    const scope = scopeModel([system, deadline]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result).toEqual([]);
  });

  it('never invents an integration for a data item with no named source system', () => {
    const data = scopeItem({
      id: 'DATA_01',
      kind: 'data',
      title: 'Renewal tracking data',
      description: 'Renewals are tracked mostly by email and a shared spreadsheet.',
      signals: ['integration:file'],
    });
    const scope = scopeModel([data]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result).toEqual([]);
  });

  it('still models a plain legacy system that is not stated as being retired', () => {
    const system = scopeItem({ id: 'SYS_01', kind: 'existingSystem', title: 'Billing Mainframe', description: 'A legacy mainframe holds billing records.', signals: ['integration:legacy'] });
    const scope = scopeModel([system]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result).toHaveLength(1);
    expect(result.at(0)?.name).toBe('Billing Mainframe Connectivity');
  });
});

describe('buildIntegrations - integrations taken out of scope', () => {
  it('does not bring back a fallback connectivity interface for a system whose only integration is out of scope', () => {
    const system = scopeItem({ id: 'SYS_03', kind: 'existingSystem', title: 'CareEverywhere', description: 'Regional health information exchange.' });
    const later = scopeItem({ id: 'INT_05', kind: 'integration', title: 'Query CareEverywhere', description: 'Query the CareEverywhere exchange in a later phase.', relatedIds: ['SYS_03'], inScope: false });
    const scope = scopeModel([system, later]);
    const active = scope.items.filter((item) => item.inScope);
    expect(buildIntegrations(scope, active, components)).toEqual([]);
  });

  it('treats a rejected integration the same way', () => {
    const system = scopeItem({ id: 'SYS_03', kind: 'existingSystem', title: 'CareEverywhere', description: 'Regional health information exchange.' });
    const rejected = scopeItem({ id: 'INT_05', kind: 'integration', title: 'Query CareEverywhere', description: 'Query the CareEverywhere exchange.', relatedIds: ['SYS_03'], review: 'rejected' });
    const scope = scopeModel([system, rejected]);
    expect(buildIntegrations(scope, [system], components)).toEqual([]);
  });
});

describe('buildIntegrations - system naming', () => {
  it('names the system from the linked existing system, never the requirement title', () => {
    const system = scopeItem({ id: 'SYS_01', kind: 'existingSystem', title: 'Guidewire ClaimCenter', description: 'Claims system of record.' });
    const integration = scopeItem({
      id: 'INT_01',
      kind: 'integration',
      title: 'Guidewire ClaimCenter integration',
      description: 'Integrate with Guidewire ClaimCenter for reserve data.',
      relatedIds: ['SYS_01'],
    });
    const scope = scopeModel([integration, system]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.system).toBe('Guidewire ClaimCenter');
  });

  it('links an integration to an unreferenced existing system named in its own text instead of creating a duplicate entry', () => {
    const system = scopeItem({ id: 'SYS_05', kind: 'existingSystem', title: 'Patient Portal', description: "The clinic's existing patient-facing portal." });
    const integration = scopeItem({
      id: 'INT_04',
      kind: 'integration',
      title: 'Patient-portal authentication reuse',
      description: 'Authenticate patients through the existing patient-portal login rather than introducing a separate identity system.',
    });
    const scope = scopeModel([integration, system]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result).toHaveLength(1);
    expect(result.at(0)?.system).toBe('Patient Portal');
    expect(result.at(0)?.requirementIds).toEqual(['INT_04', 'SYS_05']);
  });

  it('falls back to a cleaned-up requirement label when no existing system or named vendor is in the text', () => {
    const integration = scopeItem({
      id: 'INT_04',
      kind: 'integration',
      title: 'Patient-portal authentication reuse',
      description: 'Authenticate patients through the existing patient-portal login rather than introducing a separate identity system.',
    });
    const scope = scopeModel([integration]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.system).toBe('Patient Portal');
    expect(result.at(0)?.system).not.toBe(integration.title);
  });
});

describe('buildIntegrations - identity/authentication interfaces', () => {
  it('models an identity requirement as a user-delegated, inbound authentication interface with no client-credentials grant', () => {
    const integration = scopeItem({
      id: 'INT_03',
      kind: 'integration',
      title: 'Okta SSO federation',
      description: 'Federate authentication through Okta using SAML or OIDC for all internal staff.',
      signals: ['integration:identity-provider'],
    });
    const scope = scopeModel([integration]);
    const result = buildIntegrations(scope, scope.items, components);
    const spec = result.at(0);
    expect(spec?.system).toBe('Okta');
    expect(spec?.direction).toBe('inbound');
    expect(spec?.authentication).toContain('User-delegated');
    expect(spec?.authentication).not.toContain('client credentials');
    expect(spec?.protocol).toContain('OIDC/SAML federation');
  });

  it('names a known third-party identity provider found in the text as external', () => {
    const integration = scopeItem({
      id: 'INT_05',
      kind: 'integration',
      title: 'Okta staff authentication for Looker',
      description: 'Integrate with the existing Okta tenant for staff authentication into Looker.',
    });
    const scope = scopeModel([integration]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.system).toBe('Okta');
    expect(result.at(0)?.systemType).toBe('external');
  });

  it("types a reused customer-owned login as internal, not a third-party vendor", () => {
    const integration = scopeItem({
      id: 'INT_04',
      kind: 'integration',
      title: 'Patient-portal authentication reuse',
      description: 'Authenticate patients through the existing patient-portal login.',
    });
    const scope = scopeModel([integration]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.systemType).toBe('internal');
  });

  it('routes an identity interface to the identity/API architecture components', () => {
    const integration = scopeItem({
      id: 'INT_03',
      kind: 'integration',
      title: 'Okta SSO federation',
      description: 'Federate authentication through Okta using SAML or OIDC.',
      signals: ['integration:identity-provider'],
    });
    const scope = scopeModel([integration]);
    const result = buildIntegrations(scope, scope.items, components);
    const identityComponent = components.find((component) => component.area === 'identity');
    expect(identityComponent).toBeDefined();
    expect(result.at(0)?.componentIds).toContain(identityComponent?.id);
  });
});

describe('buildIntegrations - linked existing systems that are really third-party vendors', () => {
  it('types a linked health-information exchange as external, not internal, because it is a partner network the customer does not operate', () => {
    const system = scopeItem({ id: 'SYS_03', kind: 'existingSystem', title: 'CareEverywhere Health Information Exchange', description: 'Used ad hoc by physicians to pull outside records.' });
    const integration = scopeItem({ id: 'INT_05', kind: 'integration', title: 'CareEverywhere query integration', description: 'Query the regional health information exchange.', relatedIds: ['SYS_03'] });
    const scope = scopeModel([integration, system]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.systemType).toBe('external');
  });

  it('types a linked contact-centre platform as external even though it is a reviewed existing system', () => {
    const system = scopeItem({ id: 'SYS_04', kind: 'existingSystem', title: 'Five9 Contact Centre', description: 'Cloud contact-centre product used by front-desk staff.' });
    const integration = scopeItem({ id: 'INT_03', kind: 'integration', title: 'Five9 handoff', description: 'Hand a conversation off to an available front-desk agent.', relatedIds: ['SYS_04'] });
    const scope = scopeModel([integration, system]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.systemType).toBe('external');
  });

  it('types a linked carrier network as external', () => {
    const system = scopeItem({ id: 'SYS_05', kind: 'existingSystem', title: 'Carrier EDI Feeds (DHL, UPS, Fastway)', description: 'Shipment tracking delivered as EDI messages over SFTP.' });
    const integration = scopeItem({ id: 'INT_04', kind: 'integration', title: 'Carrier EDI integration', description: 'Receive EDI 214 and EDI 856 messages over SFTP.', relatedIds: ['SYS_05'] });
    const scope = scopeModel([integration, system]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.systemType).toBe('external');
  });

  it('still types a linked system with no vendor/partner cue in its name as internal', () => {
    const system = scopeItem({ id: 'SYS_06', kind: 'existingSystem', title: 'Guidewire ClaimCenter', description: 'Claims system of record.' });
    const integration = scopeItem({ id: 'INT_06', kind: 'integration', title: 'ClaimCenter sync', description: 'Synchronize claim records with ClaimCenter.', relatedIds: ['SYS_06'] });
    const scope = scopeModel([integration, system]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.systemType).toBe('internal');
  });
});

describe('buildIntegrations - protocol grounded in the customer text', () => {
  it('uses the protocol named in the customer text instead of a fixed per-signal override', () => {
    const system = scopeItem({ id: 'SYS_01', kind: 'existingSystem', title: 'Epic EHR', description: "Exposed to partners through Epic's FHIR R4 API.", signals: ['integration:ehr'] });
    const integration = scopeItem({
      id: 'INT_01',
      kind: 'integration',
      title: 'Epic integration',
      description: 'Integrate with Epic through the FHIR R4 API to write structured document data.',
      relatedIds: ['SYS_01'],
      signals: ['integration:ehr', 'integration:api'],
    });
    const scope = scopeModel([integration, system]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.protocol).toBe('FHIR R4 REST APIs');
    expect(result.at(0)?.protocol).not.toContain('HL7');
  });

  it('falls back to the catalog default protocol when the text names none, and cites a pending alternative from an open gap', () => {
    const system = scopeItem({ id: 'SYS_02', kind: 'existingSystem', title: 'SAP S/4HANA', description: 'Finance system of record.' });
    const integration = scopeItem({
      id: 'INT_02',
      kind: 'integration',
      title: 'SAP payment-posting integration',
      description: 'Integrate with SAP S/4HANA to post approved payments as finance journal entries.',
      relatedIds: ['SYS_02', 'GAP_01'],
    });
    const gap = scopeItem({
      id: 'GAP_01',
      kind: 'gap',
      title: 'SAP integration pattern unconfirmed',
      description: 'It is not known whether SAP S/4HANA exposes a REST API for journal posting or only IDoc/BAPI interfaces.',
      relatedIds: ['INT_02'],
      affectsInputs: ['integrationReadiness'],
    });
    const scope = scopeModel([integration, system, gap]);
    const result = buildIntegrations(scope, scope.items, components);
    const spec = result.at(0);
    expect(spec?.protocol).toContain('REST/JSON over HTTPS');
    expect(spec?.protocol).toContain('SAP IDoc batch extracts');
    expect(spec?.protocol).toContain('GAP_01');
    expect(spec?.readiness).toBe('unknown');
  });

  it('does not append a pending-alternative note once the gap is resolved', () => {
    const integration = scopeItem({
      id: 'INT_02',
      kind: 'integration',
      title: 'SAP payment-posting integration',
      description: 'Integrate with SAP S/4HANA to post approved payments.',
      relatedIds: ['GAP_01'],
      signals: ['integration:api'],
    });
    const gap = scopeItem({
      id: 'GAP_01',
      kind: 'gap',
      title: 'SAP integration pattern unconfirmed',
      description: 'REST API or only IDoc/BAPI interfaces.',
      relatedIds: ['INT_02'],
      affectsInputs: ['integrationReadiness'],
      resolved: true,
    });
    const scope = scopeModel([integration, gap]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.protocol).toBe('REST/JSON over HTTPS');
    expect(result.at(0)?.readiness).toBe('confirmed');
  });
});

describe('buildIntegrations - later-phase interfaces', () => {
  it('carries "(later phase)" in the name and says so in dataSync, citing the open gap', () => {
    const system = scopeItem({ id: 'SYS_03', kind: 'existingSystem', title: 'CareEverywhere', description: 'Regional health information exchange.' });
    const integration = scopeItem({
      id: 'INT_05',
      kind: 'integration',
      title: 'CareEverywhere query integration',
      description: 'Querying CareEverywhere is desired in a later phase but not required for go-live.',
      relatedIds: ['SYS_03', 'GAP_03'],
    });
    const gap = scopeItem({ id: 'GAP_03', kind: 'gap', title: 'Phase unresolved', description: 'Whether this happens now or later is unresolved.', relatedIds: ['INT_05'] });
    const scope = scopeModel([integration, system, gap]);
    const result = buildIntegrations(scope, scope.items, components);
    const spec = result.at(0);
    expect(spec?.name).toBe('CareEverywhere query integration (later phase)');
    expect(spec?.dataSync).toContain('not required for go-live');
    expect(spec?.dataSync).toContain('GAP_03');
  });

  it('never appends the later-phase suffix twice when the title already carries it', () => {
    const integration = scopeItem({
      id: 'INT_05',
      kind: 'integration',
      title: 'CareEverywhere query integration (later phase)',
      description: 'Desired in a later phase but not required for go-live.',
    });
    const scope = scopeModel([integration]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.name).toBe('CareEverywhere query integration (later phase)');
  });
});

describe('buildIntegrations - varied error handling/retry/monitoring text', () => {
  it('gives an authentication interface different error-handling/retry/monitoring text than a plain API integration', () => {
    const identity = scopeItem({ id: 'INT_01', kind: 'integration', title: 'SSO federation', description: 'Authenticate staff through the identity provider.' });
    const api = scopeItem({ id: 'INT_02', kind: 'integration', title: 'CRM sync', description: 'Sync member profiles with the CRM.', signals: ['integration:api'] });
    const scope = scopeModel([identity, api]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result).toHaveLength(2);
    const identitySpec = result.find((spec) => spec.requirementIds.includes('INT_01'));
    const apiSpec = result.find((spec) => spec.requirementIds.includes('INT_02'));
    expect(identitySpec).toBeDefined();
    expect(apiSpec).toBeDefined();
    expect(identitySpec?.errorHandling).not.toBe(apiSpec?.errorHandling);
    expect(identitySpec?.retry).not.toBe(apiSpec?.retry);
    expect(identitySpec?.monitoring).not.toBe(apiSpec?.monitoring);
    expect(identitySpec?.dataSync).not.toBe(apiSpec?.dataSync);
  });

  it('never uses identical error-handling text for two different systems of the same pattern', () => {
    const first = scopeItem({ id: 'INT_01', kind: 'integration', title: 'Salesforce sync', description: 'Sync data with Salesforce.', signals: ['integration:api'] });
    const second = scopeItem({ id: 'INT_02', kind: 'integration', title: 'SAP sync', description: 'Sync data with SAP.', signals: ['integration:api'] });
    const scope = scopeModel([first, second]);
    const result = buildIntegrations(scope, scope.items, components);
    expect(result.at(0)?.errorHandling).not.toBe(result.at(1)?.errorHandling);
  });
});

describe('buildIntegrations - every produced interface still cites its requirement (quality gate)', () => {
  it('cites the originating requirement id for every entry, including identity and cutover interfaces', () => {
    const identity = scopeItem({ id: 'INT_01', kind: 'integration', title: 'SSO federation', description: 'Authenticate staff via SAML.' });
    const retiring = scopeItem({ id: 'SYS_01', kind: 'existingSystem', title: 'Old Portal', description: 'Being replaced by this program.' });
    const cutover = scopeItem({ id: 'CON_01', kind: 'constraint', title: 'Parallel run', description: 'Old Portal keeps running in parallel for a stabilisation period.', relatedIds: ['SYS_01'] });
    const scope = scopeModel([identity, retiring, cutover]);
    const result = buildIntegrations(scope, scope.items, components);
    for (const spec of result) {
      expect(spec.requirementIds.length).toBeGreaterThan(0);
    }
  });
});

describe('buildIntegrations - system naming', () => {
  it('names a well-known third-party platform as the system instead of repeating the requirement title', () => {
    const notifications = scopeItem({ id: 'INT_05', kind: 'integration', title: 'Twilio SMS/email claim notifications', description: 'Send claim status notifications by SMS and email.', signals: ['integration:messaging'] });
    const scope = scopeModel([notifications]);
    const spec = buildIntegrations(scope, scope.items, components).at(0);
    expect(spec?.system).toBe('Twilio');
    expect(spec?.name).toContain('Twilio SMS/email claim notifications');
  });
});

describe('buildIntegrations - direction of data movement', () => {
  it('reads a consumed event stream as inbound even though the vendor "publishes" it', () => {
    const wms = scopeItem({ id: 'INT_02', kind: 'integration', title: 'Manhattan WMS event-driven integration', description: 'Event-driven integration with Manhattan WMS for pick and pack events, ideally via its published event stream.', signals: ['integration:realtime'] });
    const scope = scopeModel([wms]);
    expect(buildIntegrations(scope, scope.items, components).at(0)?.direction).toBe('inbound');
  });

  it('takes the direction from the requirement tied to the same system when the interface statement names only the mechanism', () => {
    const system = scopeItem({ id: 'SYS_02', kind: 'existingSystem', title: 'Salesforce Sales Cloud', description: 'CRM holding wholesale accounts.' });
    const ingestion = scopeItem({ id: 'FR_02', kind: 'functional', title: 'Daily Salesforce ingestion', description: 'The platform must ingest account and opportunity data daily.', relatedIds: ['SYS_02'] });
    const batch = scopeItem({ id: 'INT_03', kind: 'integration', title: 'Salesforce Sales Cloud batch integration', description: 'Daily batch integration with Salesforce Sales Cloud for account data.', relatedIds: ['SYS_02'], signals: ['integration:crm', 'integration:batch'] });
    const scope = scopeModel([system, ingestion, batch]);
    const spec = buildIntegrations(scope, scope.items, components).find((candidate) => candidate.requirementIds.includes('INT_03'));
    expect(spec?.direction).toBe('inbound');
  });

  it('marks an interface the customer puts out of scope for the current phase as later phase', () => {
    const future = scopeItem({ id: 'INT_06', kind: 'integration', title: 'Shipment-status API', description: 'Expose a secure API for a future tracking experience; this build is out of scope for the current phase.', signals: ['integration:api'] });
    const scope = scopeModel([future]);
    expect(buildIntegrations(scope, scope.items, components).at(0)?.name).toContain('(later phase)');
  });
});
