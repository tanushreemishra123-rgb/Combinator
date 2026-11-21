/** Step 2: "Review the extracted scope" (spec Core User Journey steps 5-6). */
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Priority, ReviewStatus, ScopeItem, ScopeItemKind, ScopingSession } from '../../../domain';
import { findItem } from '../../../scope';
import type { NewScopeItemFields } from '../../../scope';
import { useActions, useBusy } from '../../../state';
import { BusyOverlay, Button, Card, EmptyState, Tabs } from '../../common';
import { PlusIcon } from '../../common/icons';
import { AddScopeItemModal } from '../review/AddScopeItemModal';
import { DeleteScopeItemModal } from '../review/DeleteScopeItemModal';
import { ScopeFiltersBar } from '../review/ScopeFiltersBar';
import { filterScopeItems } from '../review/scopeFilters';
import { ScopeIssuesPanel } from '../review/ScopeIssuesPanel';
import { ScopeItemDrawer } from '../review/ScopeItemDrawer';
import { ScopeItemsTable } from '../review/ScopeItemsTable';
import { ScopeStatsPanel } from '../review/ScopeStatsPanel';
import { SourcePanelDrawer } from '../review/SourcePanelDrawer';
import { defaultScopeFilterState, groupForKind, SCOPE_KIND_GROUPS } from '../types';
import type { ScopeFilterState, ScopeKindGroupId } from '../types';

export interface ReviewScopeStepProps {
  session: ScopingSession;
  focusItemId: string | null;
  onFocusHandled: () => void;
}

function emptyGroupCounts(): ReadonlyMap<ScopeKindGroupId, number> {
  return new Map(SCOPE_KIND_GROUPS.map((group) => [group.id, 0]));
}

function countsByGroup(items: readonly ScopeItem[]): ReadonlyMap<ScopeKindGroupId, number> {
  const counts = new Map(emptyGroupCounts());
  for (const item of items) {
    const group = groupForKind(item.kind);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return counts;
}

export function ReviewScopeStep({ session, focusItemId, onFocusHandled }: ReviewScopeStepProps): ReactElement {
  const actions = useActions();
  const busy = useBusy();
  const { scope } = session;

  const [filters, setFilters] = useState<ScopeFilterState>(defaultScopeFilterState());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScopeItem | null>(null);
  const [sourceItem, setSourceItem] = useState<ScopeItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ScopeItem | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [handledFocusId, setHandledFocusId] = useState<string | null>(null);

  // Applies a new cross-workspace focus request during render (rather than in an effect): it only
  // reacts once per genuinely new `focusItemId`, switching the filters to reveal and highlight it.
  if (focusItemId !== null && focusItemId !== handledFocusId) {
    setHandledFocusId(focusItemId);
    const target = scope === null ? undefined : findItem(scope, focusItemId);
    if (target !== undefined) {
      setFilters(defaultScopeFilterState(groupForKind(target.kind)));
      setHighlightedId(target.id);
    }
  }

  useEffect(() => {
    if (focusItemId !== null && focusItemId === handledFocusId) {
      onFocusHandled();
    }
  }, [focusItemId, handledFocusId, onFocusHandled]);

  const visibleItems = useMemo(() => (scope === null ? [] : filterScopeItems(scope.items, filters)), [scope, filters]);
  const counts = useMemo(() => (scope === null ? emptyGroupCounts() : countsByGroup(scope.items)), [scope]);

  function focusOnItem(id: string): void {
    if (scope === null) {
      return;
    }
    const target = findItem(scope, id);
    if (target === undefined) {
      return;
    }
    setFilters(defaultScopeFilterState(groupForKind(target.kind)));
    setHighlightedId(target.id);
  }

  if (scope === null) {
    return (
      <EmptyState
        title="Run the analysis first"
        message="Extracted scope items appear here once you run the AI-assisted requirement analysis in 'Understand the customer need'."
      />
    );
  }

  const kindGroupTabs = SCOPE_KIND_GROUPS.map((group) => ({ id: group.id, label: `${group.label} (${counts.get(group.id) ?? 0})` }));

  return (
    <BusyOverlay active={busy !== null} label={busy?.label ?? 'Working...'}>
      <div className="stack stack-lg">
        <ScopeStatsPanel scope={scope} />
        <ScopeIssuesPanel issues={scope.issues} onSelectRef={focusOnItem} />
        <Card
          title="Structured scope model"
          actions={
            <Button variant="secondary" size="sm" icon={<PlusIcon />} onClick={() => setAddModalOpen(true)}>
              Add item
            </Button>
          }
        >
          <div className="stack stack-md">
            <Tabs items={kindGroupTabs} activeId={filters.kindGroup} ariaLabel="Filter by kind group" onChange={(id) => setFilters(defaultScopeFilterState(id as ScopeFilterState['kindGroup']))}>
              {() => (
                <div className="stack stack-md">
                  <ScopeFiltersBar filters={filters} onChange={setFilters} />
                  <ScopeItemsTable
                    items={visibleItems}
                    highlightedId={highlightedId}
                    onOpenSource={setSourceItem}
                    onSelectRelated={focusOnItem}
                    onPriorityChange={(id, priority: Priority) => void actions.editScopeItem(id, { priority })}
                    onInScopeChange={(id, inScope) => void actions.editScopeItem(id, { inScope })}
                    onReview={(id, review: ReviewStatus) => void actions.setItemReview(id, review)}
                    onEdit={setEditingItem}
                    onDelete={setDeleteCandidate}
                  />
                </div>
              )}
            </Tabs>
          </div>
        </Card>
      </div>
      <ScopeItemDrawer open={editingItem !== null} item={editingItem} onClose={() => setEditingItem(null)} onSave={(id, patch) => void actions.editScopeItem(id, patch)} />
      <SourcePanelDrawer open={sourceItem !== null} item={sourceItem} document={session.input.normalized} onClose={() => setSourceItem(null)} />
      <AddScopeItemModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={(kind: ScopeItemKind, fields: NewScopeItemFields) => void actions.addScopeItem(kind, fields)}
      />
      <DeleteScopeItemModal
        item={deleteCandidate}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={(itemId) => {
          void actions.removeScopeItem(itemId);
          setDeleteCandidate(null);
        }}
      />
    </BusyOverlay>
  );
}
