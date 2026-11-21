/**
 * Working set of the heuristic engine: allocates structured IDs per kind (FR_01, INT_02, ...) and
 * keeps the bidirectional "associated dependencies or open questions" links between items until
 * the final drafts are emitted.
 */
import { nextIdForKind, ScopeItemKindSchema } from '../domain';
import type { EstimationInputKey, Priority, Provenance, ScopeItemDraft, ScopeItemKind, SourceRef } from '../domain';
import type { Statement } from './segmentation';

export interface DraftFields {
  title: string;
  description: string;
  priority: Priority;
  provenance: Provenance;
  source: SourceRef | null;
  affectsInputs?: EstimationInputKey[];
  critical?: boolean;
}

/** An item extracted from one statement, kept with the evidence later stages reason over. */
export interface ExtractedItem {
  id: string;
  kind: ScopeItemKind;
  statement: Statement;
  signals: readonly string[];
}

/** Source pointer for a statement; `verified` is set later by the grounding validator only. */
export function sourceFromStatement(statement: Statement): SourceRef {
  return {
    sectionId: statement.sectionId,
    sectionTitle: statement.sectionTitle,
    lineStart: statement.lineNumber,
    lineEnd: statement.lineNumber,
    quote: statement.text,
    verified: false,
  };
}

export class DraftBook {
  private readonly drafts = new Map<string, ScopeItemDraft>();
  private readonly links = new Map<string, Set<string>>();

  /** Adds an item and returns its newly allocated structured ID. */
  add(kind: ScopeItemKind, fields: DraftFields): string {
    const id = nextIdForKind(kind, this.drafts.keys());
    this.drafts.set(id, {
      id,
      kind,
      title: fields.title,
      description: fields.description,
      priority: fields.priority,
      provenance: fields.provenance,
      source: fields.source,
      relatedIds: [],
      affectsInputs: fields.affectsInputs ?? [],
      critical: fields.critical ?? false,
    });
    this.links.set(id, new Set());
    return id;
  }

  /** Records a two-way association; unknown IDs and self-links are ignored. */
  link(firstId: string, secondId: string): void {
    const first = this.links.get(firstId);
    const second = this.links.get(secondId);
    if (first === undefined || second === undefined || firstId === secondId) {
      return;
    }
    first.add(secondId);
    second.add(firstId);
  }

  linkAll(id: string, otherIds: readonly string[]): void {
    for (const otherId of otherIds) {
      this.link(id, otherId);
    }
  }

  countOf(kind: ScopeItemKind): number {
    return [...this.drafts.values()].filter((draft) => draft.kind === kind).length;
  }

  /** Final drafts grouped in the taxonomy's kind order, each with its related IDs filled in. */
  toDrafts(): ScopeItemDraft[] {
    const all = [...this.drafts.values()];
    return ScopeItemKindSchema.options.flatMap((kind) =>
      all
        .filter((draft) => draft.kind === kind)
        .map((draft) => ({ ...draft, relatedIds: [...(this.links.get(draft.id) ?? [])] })),
    );
  }
}
