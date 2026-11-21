import type { IntegrationSpec } from '../domain';
import { buildDataFlows } from './flows';
import { fixtureArchitectureDesign } from './testFixtures';

const components = fixtureArchitectureDesign().components;

/** A minimal, valid IntegrationSpec so each test only overrides the fields it cares about. */
function integrationSpec(overrides: Partial<IntegrationSpec>): IntegrationSpec {
  return {
    id: 'IF_TEST',
    name: 'Test integration',
    system: 'Test System',
    systemType: 'external',
    direction: 'bidirectional',
    pattern: 'api',
    protocol: 'REST/JSON over HTTPS',
    authentication: 'OAuth 2.0 client credentials grant',
    errorHandling: 'Retried with backoff, then dead-lettered.',
    retry: 'Retried up to 3 times.',
    monitoring: 'Tracked in platform monitoring.',
    dataSync: '',
    requirementIds: [],
    componentIds: [],
    complexity: 'Medium',
    readiness: 'unknown',
    ...overrides,
  };
}

describe('buildDataFlows', () => {
  it('flows an inbound/bidirectional integration from its system into the platform store', () => {
    const flows = buildDataFlows([integrationSpec({ system: 'Salesforce CRM', direction: 'bidirectional' })], components);
    const flow = flows.at(0);
    expect(flow?.from).toBe('Salesforce CRM');
    expect(flow?.to).toBe('Member Transactional Store');
  });

  it('flows an outbound (notification-style) integration from the platform store out to its system', () => {
    const flows = buildDataFlows([integrationSpec({ system: 'Twilio', direction: 'outbound' })], components);
    const flow = flows.at(0);
    expect(flow?.from).toBe('Member Transactional Store');
    expect(flow?.to).toBe('Twilio');
  });

  it('flows an authentication interface to the identity/API layer, never the data store', () => {
    const flows = buildDataFlows(
      [
        integrationSpec({
          system: 'Okta',
          direction: 'inbound',
          protocol: 'OIDC/SAML federation (browser redirect) with Okta over HTTPS',
          dataSync: "Okta is the identity source of truth for the signed-in user during federation; the platform stores no password or long-lived credential of its own and persists nothing beyond the session created once Okta confirms the user's identity.",
        }),
      ],
      components,
    );
    const flow = flows.at(0);
    expect(flow?.from).toBe('Okta');
    expect(flow?.to).toBe('Identity Provider');
    expect(flow?.to).not.toBe('Member Transactional Store');
  });

  it('always appends the store -> analytics flow after every integration flow', () => {
    const flows = buildDataFlows([integrationSpec({})], components);
    expect(flows.at(-1)?.to).toBe('AI Assistant Platform');
  });

  it('never crashes with no integrations, still returning the store -> analytics flow', () => {
    const flows = buildDataFlows([], components);
    expect(flows).toHaveLength(1);
  });
});
