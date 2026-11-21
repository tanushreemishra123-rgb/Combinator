/**
 * Data-driven comparison of configuration fields: one `FieldRule` per field says which kind of
 * change it is and how to render the value, and `diffFields` turns every difference into a
 * `ChangeDescriptor` with a readable sentence ('Expected users increased from 5,000 to 500,000').
 */
import type { ChangeDescriptor, ChangeKind } from '../../domain';

export interface FieldRule<T> {
  kind: ChangeKind;
  targetId: string;
  /** Sentence subject, e.g. 'Expected users'. */
  noun: string;
  /** Human-readable value; two snapshots differ when their renderings differ. */
  describe(source: T): string;
  /** Numeric reading of the value so the label can say 'increased' / 'decreased'. */
  magnitude?(source: T): number | null;
}

export const NOT_SPECIFIED = 'not specified';

function changeVerb<T>(rule: FieldRule<T>, before: T, after: T): string {
  const from = rule.magnitude?.(before) ?? null;
  const to = rule.magnitude?.(after) ?? null;
  if (from === null || to === null || from === to) {
    return 'changed';
  }
  return to > from ? 'increased' : 'decreased';
}

export function diffFields<T>(rules: readonly FieldRule<T>[], before: T, after: T): ChangeDescriptor[] {
  const changes: ChangeDescriptor[] = [];
  for (const rule of rules) {
    const from = rule.describe(before);
    const to = rule.describe(after);
    if (from !== to) {
      changes.push({ kind: rule.kind, targetId: rule.targetId, label: `${rule.noun} ${changeVerb(rule, before, after)} from ${from} to ${to}`, from, to });
    }
  }
  return changes;
}
