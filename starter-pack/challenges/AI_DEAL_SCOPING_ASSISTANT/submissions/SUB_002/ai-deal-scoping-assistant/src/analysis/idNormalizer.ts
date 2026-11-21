/**
 * ID normaliser for AI output: every item ends up with a well-formed, unique structured ID carrying
 * the prefix of its kind (FR_01, INT_02, ...). Related IDs are remapped to the new IDs, and
 * references to items that do not exist are dropped and reported rather than kept dangling.
 */
import { isValidIdForKind, nextIdForKind } from '../domain';
import type { ScopeItemDraft, ValidationIssue } from '../domain';

export interface IdNormalizationResult {
  items: ScopeItemDraft[];
  issues: ValidationIssue[];
}

interface IdPlan {
  /** Final ID of each draft, by position. */
  finalIds: string[];
  /** Original ID -> final ID, used to remap relatedIds (first holder wins for duplicated IDs). */
  remap: Map<string, string>;
  issues: ValidationIssue[];
}

/** Valid IDs are reserved first so a repaired item can never take an ID another item validly holds. */
function reserveValidIds(drafts: readonly ScopeItemDraft[]): Set<string> {
  const reserved = new Set<string>();
  for (const draft of drafts) {
    if (isValidIdForKind(draft.id.trim(), draft.kind)) {
      reserved.add(draft.id.trim());
    }
  }
  return reserved;
}

function planIds(drafts: readonly ScopeItemDraft[]): IdPlan {
  const used = reserveValidIds(drafts);
  const claimed = new Set<string>();
  const remap = new Map<string, string>();
  const issues: ValidationIssue[] = [];
  const finalIds = drafts.map((draft) => {
    const original = draft.id.trim();
    if (isValidIdForKind(original, draft.kind) && !claimed.has(original)) {
      claimed.add(original);
      remap.set(original, original);
      return original;
    }
    const reason = isValidIdForKind(original, draft.kind) ? 'duplicate' : 'malformed';
    const replacement = nextIdForKind(draft.kind, used);
    used.add(replacement);
    claimed.add(replacement);
    if (!remap.has(original)) {
      remap.set(original, replacement);
    }
    issues.push({
      severity: 'info',
      code: 'id-reassigned',
      message: `"${draft.title}" arrived with the ${reason} ID "${original}" and was renumbered ${replacement}.`,
      refs: [replacement],
    });
    return replacement;
  });
  return { finalIds, remap, issues };
}

function remapRelatedIds(draft: ScopeItemDraft, ownId: string, plan: IdPlan, known: ReadonlySet<string>): { relatedIds: string[]; dropped: string[] } {
  const relatedIds: string[] = [];
  const dropped: string[] = [];
  for (const related of draft.relatedIds) {
    const target = plan.remap.get(related.trim()) ?? related.trim();
    if (!known.has(target)) {
      dropped.push(related);
    } else if (target !== ownId && !relatedIds.includes(target)) {
      relatedIds.push(target);
    }
  }
  return { relatedIds, dropped };
}

/** Makes IDs well-formed and unique per kind, remaps relatedIds and drops dangling references. */
export function normalizeIds(drafts: readonly ScopeItemDraft[]): IdNormalizationResult {
  const plan = planIds(drafts);
  const known = new Set(plan.finalIds);
  const issues = [...plan.issues];
  const items = drafts.map((draft, index) => {
    const id = plan.finalIds.at(index) ?? draft.id;
    const { relatedIds, dropped } = remapRelatedIds(draft, id, plan, known);
    if (dropped.length > 0) {
      issues.push({
        severity: 'warning',
        code: 'dangling-reference',
        message: `${id} referenced ${dropped.join(', ')}, which ${dropped.length === 1 ? 'is' : 'are'} not in the analysis output; the ${dropped.length === 1 ? 'reference was' : 'references were'} removed.`,
        refs: [id],
      });
    }
    return { ...draft, id, relatedIds };
  });
  return { items, issues };
}
