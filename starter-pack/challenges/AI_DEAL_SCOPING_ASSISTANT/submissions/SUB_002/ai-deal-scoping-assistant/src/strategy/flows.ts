/**
 * Free-text data flows (spec 4: "how information moves between major architecture components and
 * external systems"), derived from the integrations already planned and the storage/analytics
 * components already designed, so the description stays consistent with both instead of retelling
 * the architecture from scratch. An authentication interface flows to the identity/API layer, not a
 * data store, since federation persists nothing.
 */
import type { ArchitectureComponent, DataFlow, IntegrationSpec } from '../domain';
import { findComponents } from './componentLookup';
import { isIdentityInterface } from './integrationCatalog.data';

const PATTERN_MECHANISM: ReadonlyMap<IntegrationSpec['pattern'], string> = new Map([
  ['api', 'synchronous API call'],
  ['event', 'asynchronous event'],
  ['batch', 'scheduled batch transfer'],
  ['file', 'file exchange'],
]);

function storeLabel(components: readonly ArchitectureComponent[]): string {
  const stores = findComponents(components, { areas: ['data-storage'] });
  return stores.length > 0 ? (stores.at(0)?.name ?? 'the platform data store') : 'the platform data store';
}

function analyticsLabel(components: readonly ArchitectureComponent[]): string {
  const analytics = findComponents(components, { areas: ['ai-ml'] });
  return analytics.length > 0 ? (analytics.at(0)?.name ?? 'the analytics and AI layer') : 'the analytics and AI layer';
}

function identityLayerLabel(components: readonly ArchitectureComponent[]): string {
  const identity = findComponents(components, { areas: ['identity'] });
  if (identity.length > 0) {
    return identity.at(0)?.name ?? 'the identity and API layer';
  }
  const api = findComponents(components, { areas: ['api'] });
  return api.length > 0 ? (api.at(0)?.name ?? 'the identity and API layer') : 'the identity and API layer';
}

function flowFor(integration: IntegrationSpec, store: string, identityLayer: string): DataFlow {
  if (isIdentityInterface(integration.protocol)) {
    return {
      from: integration.system,
      to: identityLayer,
      payload: 'Federated sign-in and the confirmed user identity',
      mechanism: `${PATTERN_MECHANISM.get(integration.pattern) ?? 'synchronous API call'} (${integration.protocol})`,
    };
  }
  return {
    from: integration.direction === 'outbound' ? store : integration.system,
    to: integration.direction === 'outbound' ? integration.system : store,
    payload: integration.name,
    mechanism: `${PATTERN_MECHANISM.get(integration.pattern) ?? 'synchronous API call'} (${integration.protocol})`,
  };
}

/** One flow per integration (system <-> platform store, or system -> identity layer for authentication), plus one from the store into analytics/reporting. */
export function buildDataFlows(integrations: readonly IntegrationSpec[], components: readonly ArchitectureComponent[]): DataFlow[] {
  const store = storeLabel(components);
  const identityLayer = identityLayerLabel(components);
  const flows: DataFlow[] = integrations.map((integration) => flowFor(integration, store, identityLayer));
  flows.push({
    from: store,
    to: analyticsLabel(components),
    payload: 'Curated, deduplicated records for reporting and AI use cases',
    mechanism: 'Scheduled extract/transform/load into the analytical store',
  });
  return flows;
}
