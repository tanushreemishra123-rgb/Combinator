import { describe, expect, it } from 'vitest';
import type { ScopeModel } from '../domain';
import { fixtureScope } from '../test/fixtures';
import { buildCapabilities } from './capabilities';

const FIXTURE_REQUIREMENT_IDS = ['BR_01', 'FR_01', 'FR_02', 'FR_03', 'NFR_01', 'NFR_02', 'INT_01', 'DATA_01', 'SEC_01'];

describe('buildCapabilities', () => {
  it('places every reviewed requirement into at least one capability', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const cited = new Set(capabilities.flatMap((capability) => capability.requirementIds));
    expect(cited).toEqual(new Set(FIXTURE_REQUIREMENT_IDS));
  });

  it('routes a requirement with no matching signal to Core Platform Services', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const core = capabilities.find((capability) => capability.name === 'Core Platform Services');
    expect(core).toBeDefined();
    // BR_01, NFR_01 and NFR_02 carry no capability/integration/data/ai/security signal in the fixture.
    expect(core?.requirementIds).toEqual(expect.arrayContaining(['BR_01', 'NFR_01', 'NFR_02']));
  });

  it('merges requirements that share a catalog signal into one capability', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const crm = capabilities.find((capability) => capability.name === 'CRM Integration');
    expect(crm?.requirementIds).toEqual(['INT_01']);
  });

  it('cites a requirement under every capability its signals resolve to', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const search = capabilities.find((capability) => capability.name === 'Search and Discovery');
    const documents = capabilities.find((capability) => capability.name === 'Document Management');
    // FR_02 carries both capability:search and capability:documents, and both are valid for a functional item.
    expect(search?.requirementIds).toContain('FR_02');
    expect(documents?.requirementIds).toContain('FR_02');
  });

  it('gates a signal group by the citing requirement kind, so a signal used in passing on the wrong kind of item does not force-fit its capability', () => {
    const scope = fixtureScope();
    // FR_01 is functional and carries security:sso in the fixture, but a security capability
    // should only be driven by a security or non-functional item stating the control.
    expect(buildCapabilities(scope).find((capability) => capability.name === 'Single Sign-On')).toBeUndefined();

    const ssoOnSecurityItem: ScopeModel = {
      ...scope,
      items: scope.items.map((item) => (item.id === 'SEC_01' ? { ...item, signals: [...item.signals, 'security:sso'] } : item)),
    };
    const sso = buildCapabilities(ssoOnSecurityItem).find((capability) => capability.name === 'Single Sign-On');
    expect(sso?.requirementIds).toEqual(['SEC_01']);
  });

  it('routes a functional requirement by what its title names, not by a feature its description mentions in passing', () => {
    const scope = fixtureScope();
    const passingMention: ScopeModel = {
      ...scope,
      items: scope.items.map((item) =>
        item.id === 'FR_02'
          ? { ...item, title: 'Policy document upload', description: 'Members upload policy documents, including estimates and police reports.', signals: ['capability:documents', 'capability:reporting'] }
          : item,
      ),
    };
    const capabilities = buildCapabilities(passingMention);
    expect(capabilities.find((capability) => capability.name === 'Document Management')?.requirementIds).toContain('FR_02');
    expect(capabilities.find((capability) => capability.name === 'Dashboards and Reporting')?.requirementIds ?? []).not.toContain('FR_02');
  });

  it('never drives a data capability from a non-data item, or an integration capability from a non-integration item', () => {
    const scope = fixtureScope();
    // FR_01 is functional; tag it with an integration and a data signal it has no business carrying.
    const mistagged: ScopeModel = {
      ...scope,
      items: scope.items.map((item) => (item.id === 'FR_01' ? { ...item, signals: [...item.signals, 'integration:erp', 'data:master-data'] } : item)),
    };
    const capabilities = buildCapabilities(mistagged);
    expect(capabilities.find((capability) => capability.name === 'ERP Integration')).toBeUndefined();
    expect(capabilities.find((capability) => capability.name === 'Master and Reference Data Management')).toBeUndefined();
  });

  it('folds a broad/cross-cutting signal into the one specific sibling capability that cites the identical requirement set', () => {
    // The fixture's INT_01 already carries integration:crm (specific) and integration:realtime
    // (broad cadence signal) with no other item citing either, so a naive matcher would bill and
    // trace the same Salesforce sync twice under "CRM Integration" and "Real-Time Integration
    // Platform". Only the specific capability should survive.
    const capabilities = buildCapabilities(fixtureScope());
    expect(capabilities.find((capability) => capability.name === 'Real-Time Integration Platform')).toBeUndefined();
    const crm = capabilities.find((capability) => capability.name === 'CRM Integration');
    expect(crm?.requirementIds).toEqual(['INT_01']);
  });

  it('folds the broad Okta/BI collision into Identity Provider Integration', () => {
    const scope = fixtureScope();
    const okta: ScopeModel = {
      ...scope,
      items: scope.items.map((existing) =>
        existing.id === 'INT_01' ? { ...existing, signals: ['integration:identity-provider', 'integration:data-warehouse'] } : existing,
      ),
    };
    const capabilities = buildCapabilities(okta);
    expect(capabilities.find((capability) => capability.name === 'Data Warehouse and BI Integration')).toBeUndefined();
    expect(capabilities.find((capability) => capability.name === 'Single Sign-On')).toBeUndefined();
    const identityProvider = capabilities.find((capability) => capability.name === 'Identity Provider Integration');
    expect(identityProvider?.requirementIds).toEqual(['INT_01']);
  });

  it('keeps both capabilities when two specific (non-broad) signals on one item collide on the identical requirement set', () => {
    const scope = fixtureScope();
    const twoSystems: ScopeModel = {
      ...scope,
      items: scope.items.map((existing) => (existing.id === 'INT_01' ? { ...existing, signals: ['integration:erp', 'integration:hr'] } : existing)),
    };
    const capabilities = buildCapabilities(twoSystems);
    expect(capabilities.find((capability) => capability.name === 'ERP Integration')?.requirementIds).toEqual(['INT_01']);
    expect(capabilities.find((capability) => capability.name === 'HR Platform Integration')?.requirementIds).toEqual(['INT_01']);
  });

  it('labels a capability assumption-to-confirm when a cited requirement depends on an unresolved assumption', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const assistant = capabilities.find((capability) => capability.name === 'AI Conversational Assistant');
    // FR_03 relates to ASM_01, which the fixture leaves unresolved.
    expect(assistant?.label).toBe('assumption-to-confirm');
  });

  it('labels a capability ai-interpretation when a cited requirement is ai-inferred (and no unresolved assumption applies)', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const documentData = capabilities.find((capability) => capability.name === 'Document and Content Data Management');
    expect(documentData?.label).toBe('ai-interpretation');
  });

  it('labels a capability customer-requested when every cited requirement is customer-stated', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const crm = capabilities.find((capability) => capability.name === 'CRM Integration');
    expect(crm?.label).toBe('customer-requested');
  });

  it('rolls a capability priority up to the highest priority among its requirements', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const core = capabilities.find((capability) => capability.name === 'Core Platform Services');
    // BR_01 and NFR_01 are High, NFR_02 is Medium -> the capability rolls up to High.
    expect(core?.priority).toBe('High');
    const assistant = capabilities.find((capability) => capability.name === 'AI Conversational Assistant');
    expect(assistant?.priority).toBe('Low');
  });

  it('lists the titles of dependency items related to a cited requirement', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const crm = capabilities.find((capability) => capability.name === 'CRM Integration');
    expect(crm?.dependencies).toEqual(['Salesforce API access']);
  });

  it('names the concrete requirements and connected systems in the scope paragraph', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const crm = capabilities.find((capability) => capability.name === 'CRM Integration');
    expect(crm?.scope).toContain('INT_01');
    expect(crm?.scope).toContain('Salesforce CRM');
  });

  it('assigns module, workstream and delivery package from the catalog', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const assistant = capabilities.find((capability) => capability.name === 'AI Conversational Assistant');
    expect(assistant?.module).toBe('AI Capabilities');
    expect(assistant?.deliveryPackage).toBe('Package 3 - AI Capabilities');
  });

  it('returns a single well-formed Core Platform Services capability for an empty scope', () => {
    const empty: ScopeModel = { summary: '', items: [], version: 1, approvedAt: null, approvedVersion: null, issues: [] };
    const capabilities = buildCapabilities(empty);
    expect(capabilities).toHaveLength(1);
    expect(capabilities.at(0)?.name).toBe('Core Platform Services');
    expect(capabilities.at(0)?.requirementIds).toEqual([]);
    expect(capabilities.at(0)?.scope.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same scope', () => {
    const scope = fixtureScope();
    expect(buildCapabilities(scope)).toEqual(buildCapabilities(scope));
  });
});
