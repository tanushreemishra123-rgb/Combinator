/** Structured, traceable identifiers (BR_01, FR_01, NFR_01, INT_01, DATA_01, SEC_01, ...). */
import type { ScopeItemKind } from './scope';

const KIND_PREFIXES: ReadonlyMap<ScopeItemKind, string> = new Map([
  ['business', 'BR'],
  ['persona', 'PER'],
  ['functional', 'FR'],
  ['nonFunctional', 'NFR'],
  ['existingSystem', 'SYS'],
  ['integration', 'INT'],
  ['data', 'DATA'],
  ['security', 'SEC'],
  ['technology', 'TECH'],
  ['constraint', 'CON'],
  ['dependency', 'DEP'],
  ['risk', 'RSK'],
  ['gap', 'GAP'],
  ['assumption', 'ASM'],
  ['question', 'Q'],
]);

const STRUCTURED_ID = /^([A-Z]+)_(\d{2,3})$/;

export function prefixForKind(kind: ScopeItemKind): string {
  return KIND_PREFIXES.get(kind) ?? 'REQ';
}

export function formatId(prefix: string, sequence: number): string {
  return `${prefix}_${String(sequence).padStart(2, '0')}`;
}

/** True when `id` is a well-formed structured ID carrying the prefix expected for `kind`. */
export function isValidIdForKind(id: string, kind: ScopeItemKind): boolean {
  const match = STRUCTURED_ID.exec(id);
  return match !== null && match.at(1) === prefixForKind(kind);
}

/** Next free ID for a kind, given the IDs already in use. */
export function nextIdForKind(kind: ScopeItemKind, existingIds: Iterable<string>): string {
  const prefix = prefixForKind(kind);
  let max = 0;
  for (const id of existingIds) {
    const match = STRUCTURED_ID.exec(id);
    if (match !== null && match.at(1) === prefix) {
      max = Math.max(max, Number(match.at(2)));
    }
  }
  return formatId(prefix, max + 1);
}

/** Collision-free opaque ID for sessions and change records. */
export function newUid(): string {
  return crypto.randomUUID();
}
