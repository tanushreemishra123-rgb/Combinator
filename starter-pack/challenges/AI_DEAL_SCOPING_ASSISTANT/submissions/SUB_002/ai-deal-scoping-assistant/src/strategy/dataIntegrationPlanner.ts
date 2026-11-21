/**
 * Deterministic data + integration strategy used by the mock provider (and as the grounded baseline
 * a live-generated response is validated against, see validate.ts). Composes the data domains,
 * the ten fixed data topics, the integration inventory and the resulting data flows from the same
 * reviewed scope and architecture so the three stay consistent with each other (spec 4).
 */
import type { DataIntegrationContext } from '../ai/types';
import type { DataIntegrationOutput } from '../domain';
import { DataIntegrationOutputSchema } from '../domain';
import { getActiveItems } from '../scope';
import { buildDataDomains } from './dataDomains';
import { buildDataTopics } from './dataTopics';
import { buildDataFlows } from './flows';
import { buildIntegrations } from './integrations';

/** Builds the full DataIntegrationOutput for the reviewed scope and architecture. */
export function planDataIntegration(context: DataIntegrationContext): DataIntegrationOutput {
  const items = getActiveItems(context.scope).filter((item) => item.inScope);

  const domains = buildDataDomains(context.scope, items);
  const domainNames = domains.map((domain) => domain.name);
  const topics = buildDataTopics(items, context.components, context.platform, domainNames, context.customer.customerName);
  const integrations = buildIntegrations(context.scope, items, context.components);
  const flows = buildDataFlows(integrations, context.components);

  const draft: DataIntegrationOutput = { domains, topics, integrations, flows };
  return DataIntegrationOutputSchema.parse(draft);
}
