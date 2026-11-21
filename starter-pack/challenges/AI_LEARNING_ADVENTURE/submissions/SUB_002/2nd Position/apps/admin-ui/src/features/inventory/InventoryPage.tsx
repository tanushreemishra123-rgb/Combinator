import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import type { AdminContentItem, AdminEntityType, AdminMissionDoc } from '@ai-learning-adventure/types';
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  FilterToolbar,
  IconButton,
  LoadingState,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextInput,
} from '@/components/ui';
import { AdminShell } from '@/components/layout/AdminShell';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PublishGateDialog } from '@/components/PublishGateDialog';
import { PreviewDialog } from '@/components/PreviewDialog';
import { AdminApiError, adminApi } from '@/lib/api';
import { useContentList, useRevalidateAll } from '@/lib/hooks';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  ENTITY_TYPE_PLURAL,
  LEVEL_TRACK_LABELS,
  LEVEL_TRACK_ORDER,
  formatDate,
  itemTitle,
} from '@/lib/labels';

const ENTITY_BASE: Record<AdminEntityType, string> = {
  mission: '/missions',
  question: '/questions',
  flashcard: '/flashcards',
  award: '/badges',
};

interface PendingAction {
  kind: 'unpublish' | 'archive' | 'disable-mission';
  item: AdminContentItem;
}

export function InventoryPage({ entityType }: { entityType: AdminEntityType }) {
  const router = useRouter();
  const revalidateAll = useRevalidateAll();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [missionFilter, setMissionFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingAction | undefined>(undefined);
  const [publishTarget, setPublishTarget] = useState<AdminContentItem | undefined>(undefined);
  const [previewTarget, setPreviewTarget] = useState<AdminContentItem | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const params = useMemo(
    () => ({
      q: search.trim().length > 0 ? search.trim() : undefined,
      status: statusFilter.length > 0 ? statusFilter : undefined,
      difficulty: difficultyFilter.length > 0 ? difficultyFilter : undefined,
      levelTrack: trackFilter.length > 0 ? trackFilter : undefined,
      missionId: missionFilter.length > 0 ? missionFilter : undefined,
    }),
    [search, statusFilter, difficultyFilter, trackFilter, missionFilter],
  );

  const { items, isLoading, error, refresh } = useContentList(entityType, params);
  const missionsForLookup = useContentList('mission');
  const questionsForCounts = useContentList('question');
  const flashcardsForCounts = useContentList('flashcard');

  const missionTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of missionsForLookup.items) {
      map.set(item.id, itemTitle('mission', item.doc));
    }
    return map;
  }, [missionsForLookup.items]);

  const practiceCounts = useMemo(() => {
    const counts = new Map<string, { questions: number; flashcards: number }>();
    for (const item of questionsForCounts.items) {
      const missionId = (item.doc as { missionId?: string | null }).missionId;
      if (typeof missionId !== 'string') continue;
      const entry = counts.get(missionId) ?? { questions: 0, flashcards: 0 };
      entry.questions += 1;
      counts.set(missionId, entry);
    }
    for (const item of flashcardsForCounts.items) {
      const missionId = (item.doc as { missionId?: string | null }).missionId;
      if (typeof missionId !== 'string') continue;
      const entry = counts.get(missionId) ?? { questions: 0, flashcards: 0 };
      entry.flashcards += 1;
      counts.set(missionId, entry);
    }
    return counts;
  }, [questionsForCounts.items, flashcardsForCounts.items]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(undefined);
    try {
      await action();
      await revalidateAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    await run(async () => {
      const created = await adminApi.create(entityType);
      await router.push(`${ENTITY_BASE[entityType] /* nosemgrep: gitlab.eslint.detect-object-injection */}/${encodeURIComponent(created.id)}`);
    });
  }

  async function handleBulk(action: 'enable' | 'disable' | 'publish' | 'unpublish') {
    await run(async () => {
      const refs = [...selected].map((id) => ({ entityType, id }));
      const result = await adminApi.bulk(action, refs, true);
      setSelected(new Set());
      if (result.failed.length > 0) {
        setActionError(`${result.failed.length} item(s) failed: ${result.failed[0]?.message}`);
      }
    });
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => (current.size === items.length ? new Set() : new Set(items.map((item) => item.id))));
  }

  const title = ENTITY_BASE[entityType] /* nosemgrep: gitlab.eslint.detect-object-injection */ === '/badges' ? 'Badges & Milestones' : ENTITY_TYPE_PLURAL[entityType];

  return (
    <AdminShell
      title={title}
      description="Create, filter, and manage content before it reaches learners."
      actions={
        <Button variant="primary" iconLeft="+" onClick={() => void handleCreate()} disabled={busy}>
          New
        </Button>
      }
    >
      <FilterToolbar>
        <TextInput placeholder="Search…" aria-label="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'All statuses', value: '' },
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
            { label: 'Published with changes', value: 'published_changed' },
          ]}
        />
        {entityType !== 'award' && (
          <Select
            aria-label="Filter by difficulty"
            value={difficultyFilter}
            onChange={setDifficultyFilter}
            options={[
              { label: 'All difficulties', value: '' },
              ...DIFFICULTY_ORDER.map((difficulty) => ({ label: DIFFICULTY_LABELS[difficulty] /* nosemgrep: gitlab.eslint.detect-object-injection */, value: difficulty })),
            ]}
          />
        )}
        {entityType === 'mission' && (
          <Select
            aria-label="Filter by track"
            value={trackFilter}
            onChange={setTrackFilter}
            options={[
              { label: 'All tracks', value: '' },
              ...LEVEL_TRACK_ORDER.map((track) => ({ label: LEVEL_TRACK_LABELS[track] /* nosemgrep: gitlab.eslint.detect-object-injection */, value: track })),
            ]}
          />
        )}
        {(entityType === 'question' || entityType === 'flashcard') && (
          <Select
            aria-label="Filter by mission"
            value={missionFilter}
            onChange={setMissionFilter}
            options={[
              { label: 'All missions', value: '' },
              { label: 'Unassigned', value: '__unassigned__' },
              ...missionsForLookup.items.map((mission) => ({
                label: itemTitle('mission', mission.doc),
                value: mission.id,
              })),
            ]}
          />
        )}
      </FilterToolbar>

      {selected.size > 0 && (
        <FilterToolbar>
          <span>{selected.size} selected</span>
          <Button size="sm" onClick={() => void handleBulk('enable')}>
            Enable
          </Button>
          <Button size="sm" onClick={() => void handleBulk('disable')}>
            Disable
          </Button>
          <Button size="sm" onClick={() => void handleBulk('publish')}>
            Publish
          </Button>
          <Button size="sm" onClick={() => void handleBulk('unpublish')}>
            Unpublish
          </Button>
        </FilterToolbar>
      )}

      {actionError !== undefined && (
        <p role="alert" style={{ color: '#B91C1C' }}>
          {actionError}
        </p>
      )}

      {isLoading && <LoadingState label={`Loading ${title.toLowerCase()}…`} />}
      {error !== undefined && (
        <ErrorState
          title="Failed to load content"
          description={error instanceof AdminApiError ? error.message : 'Unexpected error.'}
          action={
            <Button variant="outline" onClick={() => void refresh()}>
              Retry
            </Button>
          }
        />
      )}
      {!isLoading && error === undefined && items.length === 0 && (
        <EmptyState
          title={`No ${title.toLowerCase()} found`}
          description="Adjust the filters or create a new item."
          action={
            <Button variant="primary" onClick={() => void handleCreate()}>
              New
            </Button>
          }
        />
      )}

      {items.length > 0 && (
        <TableContainer>
          <Table minWidth={800}>
            <TableHead>
              <TableRow hoverable={false}>
                <TableHeaderCell>
                  <Checkbox
                    aria-label="Select all"
                    checked={selected.size === items.length && items.length > 0}
                    indeterminate={selected.size > 0 && selected.size < items.length}
                    onChange={toggleAll}
                  />
                </TableHeaderCell>
                <TableHeaderCell>Name</TableHeaderCell>
                {entityType !== 'mission' && <TableHeaderCell>Mission</TableHeaderCell>}
                {entityType === 'mission' && <TableHeaderCell>Practice</TableHeaderCell>}
                {entityType !== 'award' && <TableHeaderCell>Difficulty</TableHeaderCell>}
                {entityType === 'mission' && <TableHeaderCell>Track</TableHeaderCell>}
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell sortable sorted="desc">
                  Updated
                </TableHeaderCell>
                <TableHeaderCell align="center">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const doc = item.doc as Record<string, unknown>;
                const missionId = typeof doc.missionId === 'string' ? doc.missionId : undefined;
                const counts = practiceCounts.get(item.id);
                return (
                  <TableRow key={item.id} selected={selected.has(item.id)} disabled={!item.enabled}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${itemTitle(entityType, item.doc)}`}
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => void router.push(`${ENTITY_BASE[entityType] /* nosemgrep: gitlab.eslint.detect-object-injection */}/${encodeURIComponent(item.id)}`)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                      >
                        {itemTitle(entityType, item.doc)}
                      </button>
                    </TableCell>
                    {entityType !== 'mission' && (
                      <TableCell>
                        {missionId === undefined || missionId === null
                          ? '—'
                          : (missionTitles.get(missionId) ?? missionId)}
                      </TableCell>
                    )}
                    {entityType === 'mission' && (
                      <TableCell>
                        {counts === undefined ? '0 / 0' : `${counts.questions} q · ${counts.flashcards} c`}
                      </TableCell>
                    )}
                    {entityType !== 'award' && (
                      <TableCell>{DIFFICULTY_LABELS[doc.difficulty as keyof typeof DIFFICULTY_LABELS] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? '—'}</TableCell>
                    )}
                    {entityType === 'mission' && (
                      <TableCell>{LEVEL_TRACK_LABELS[doc.levelTrack as keyof typeof LEVEL_TRACK_LABELS] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? '—'}</TableCell>
                    )}
                    <TableCell>
                      <StatusBadge status={item.status} enabled={item.enabled} />
                    </TableCell>
                    <TableCell>{formatDate(item.updatedAt)}</TableCell>
                    <TableCell align="center">
                      <Menu>
                        <MenuTrigger aria-label={`Actions for ${itemTitle(entityType, item.doc)}`}>⋮</MenuTrigger>
                        <MenuContent>
                          <MenuItem
                            icon="✎"
                            onSelect={() => void router.push(`${ENTITY_BASE[entityType] /* nosemgrep: gitlab.eslint.detect-object-injection */}/${encodeURIComponent(item.id)}`)}
                          >
                            Edit
                          </MenuItem>
                          {entityType === 'mission' && (
                            <MenuItem icon="◎" onSelect={() => setPreviewTarget(item)}>
                              Preview
                            </MenuItem>
                          )}
                          <MenuItem icon="⧉" onSelect={() => void run(() => adminApi.duplicate(entityType, item.id))}>
                            Duplicate
                          </MenuItem>
                          <MenuSeparator />
                          {item.enabled ? (
                            <MenuItem
                              onSelect={() => {
                                if (entityType === 'mission') setPending({ kind: 'disable-mission', item });
                                else void run(() => adminApi.setEnabled(entityType, item.id, false));
                              }}
                            >
                              Disable
                            </MenuItem>
                          ) : (
                            <MenuItem onSelect={() => void run(() => adminApi.setEnabled(entityType, item.id, true))}>
                              Enable
                            </MenuItem>
                          )}
                          {item.status === 'draft' || item.status === 'published_changed' ? (
                            <MenuItem onSelect={() => setPublishTarget(item)}>Publish…</MenuItem>
                          ) : (
                            <MenuItem onSelect={() => setPending({ kind: 'unpublish', item })}>Unpublish…</MenuItem>
                          )}
                          <MenuSeparator />
                          <MenuItem destructive icon="✕" onSelect={() => setPending({ kind: 'archive', item })}>
                            Delete
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pending !== undefined && (
        <ConfirmDialog
          open
          title={
            pending.kind === 'archive'
              ? `Delete ${itemTitle(entityType, pending.item.doc)}?`
              : pending.kind === 'unpublish'
                ? `Unpublish ${itemTitle(entityType, pending.item.doc)}?`
                : `Disable ${itemTitle(entityType, pending.item.doc)}?`
          }
          description={
            pending.kind === 'archive'
              ? 'Learners lose access immediately. Earned awards and history are retained.'
              : pending.kind === 'unpublish'
                ? 'Learners will lose access until it is published again.'
                : 'Disabled content is hidden from learners while kept for editing.'
          }
          confirmLabel={pending.kind === 'archive' ? 'Delete' : pending.kind === 'unpublish' ? 'Unpublish' : 'Disable'}
          destructive={pending.kind === 'archive'}
          busy={busy}
          onConfirm={() => {
            const target = pending.item;
            void run(async () => {
              if (pending.kind === 'archive') await adminApi.archive(entityType, target.id);
              else if (pending.kind === 'unpublish') await adminApi.unpublish(entityType, target.id);
              else await adminApi.setEnabled(entityType, target.id, false);
              setPending(undefined);
            });
          }}
          onClose={() => setPending(undefined)}
        >
          {pending.kind === 'disable-mission' && (
            <p>
              This hides the mission and its practice content from the learner map. Questions and flashcards keep
              their own enable state.
            </p>
          )}
        </ConfirmDialog>
      )}

      {publishTarget !== undefined && (
        <PublishGateDialog
          open
          entityType={entityType}
          entityId={publishTarget.id}
          expectedRevision={publishTarget.revision}
          allowDependentDrafts={entityType === 'mission'}
          onClose={() => setPublishTarget(undefined)}
          onPublished={() => {
            setPublishTarget(undefined);
            void revalidateAll();
          }}
        />
      )}

      {previewTarget !== undefined && (
        <PreviewDialog open missionId={previewTarget.id} onClose={() => setPreviewTarget(undefined)} />
      )}
    </AdminShell>
  );
}

export function missionDocOf(item: AdminContentItem): AdminMissionDoc {
  return item.doc as AdminMissionDoc;
}
