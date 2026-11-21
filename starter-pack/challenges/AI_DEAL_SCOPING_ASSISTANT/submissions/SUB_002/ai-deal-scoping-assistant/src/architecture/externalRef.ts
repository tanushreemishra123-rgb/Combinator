/**
 * Encodes an external-system flow endpoint as a single string id, so `buildArchitectureDiagram`
 * (diagramModel.ts) can render a readable external node from `ArchitectureOutput.flows` alone,
 * without needing the scope model that produced it. The encoded id still carries the justifying
 * scope item id (an integration requirement, or the existing system it talks to) so the diagram
 * node keeps its `refs` for traceability.
 */
const EXTERNAL_PREFIX = 'ext';

/** Builds a flow endpoint id for an external system, e.g. makeExternalId('INT_01', 'Salesforce CRM'). */
export function makeExternalId(refId: string, label: string): string {
  return `${EXTERNAL_PREFIX}:${refId}:${label}`;
}

/** Recovers the justifying ref id and display label from an id built by makeExternalId, or null. */
export function parseExternalId(id: string): { refId: string; label: string } | null {
  const prefix = `${EXTERNAL_PREFIX}:`;
  if (!id.startsWith(prefix)) {
    return null;
  }
  const rest = id.slice(prefix.length);
  const separatorIndex = rest.indexOf(':');
  if (separatorIndex === -1) {
    return null;
  }
  const refId = rest.slice(0, separatorIndex);
  const label = rest.slice(separatorIndex + 1).trim();
  if (refId.trim() === '' || label === '') {
    return null;
  }
  return { refId, label };
}

export function isExternalId(id: string): boolean {
  return parseExternalId(id) !== null;
}
