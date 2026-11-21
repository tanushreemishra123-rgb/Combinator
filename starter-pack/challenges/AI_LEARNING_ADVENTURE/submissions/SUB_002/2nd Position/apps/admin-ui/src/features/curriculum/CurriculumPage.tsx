import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AdminContentItem, AdminMissionDoc, Difficulty, LevelTrack } from '@ai-learning-adventure/types';
import { ErrorState, LoadingState, Typography } from '@/components/ui';
import { AdminShell } from '@/components/layout/AdminShell';
import { StatusBadge } from '@/components/StatusBadge';
import { AdminApiError, adminApi } from '@/lib/api';
import { useContentList, useRevalidateAll } from '@/lib/hooks';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER, LEVEL_TRACK_LABELS, LEVEL_TRACK_ORDER, itemTitle } from '@/lib/labels';
import styles from './CurriculumPage.module.scss';

function TrackMissionChip({
  mission,
  onSelect,
}: {
  mission: AdminContentItem<AdminMissionDoc>;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: mission.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <li ref={setNodeRef} style={style} className={styles.missionRow}>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        aria-label={`Drag ${itemTitle('mission', mission.doc)}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <button type="button" className={styles.missionTitle} onClick={onSelect}>
        {mission.doc.trackOrder}. {itemTitle('mission', mission.doc)}
      </button>
      <StatusBadge status={mission.status} enabled={mission.enabled} />
    </li>
  );
}

export function CurriculumPage() {
  const router = useRouter();
  const revalidateAll = useRevalidateAll();
  const missions = useContentList('mission');
  const [error, setError] = useState<string | undefined>(undefined);
  const [dragTrack, setDragTrack] = useState<LevelTrack | undefined>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byTrack = useMemo(() => {
    const map = new Map<LevelTrack, Array<AdminContentItem<AdminMissionDoc>>>();
    for (const track of LEVEL_TRACK_ORDER) map.set(track, []);
    for (const item of missions.items) {
      const doc = item.doc as AdminMissionDoc;
      const list = map.get(doc.levelTrack);
      if (list !== undefined) list.push(item as AdminContentItem<AdminMissionDoc>);
    }
    for (const list of map.values()) list.sort((a, b) => a.doc.trackOrder - b.doc.trackOrder);
    return map;
  }, [missions.items]);

  const matrix = useMemo(() => {
    const cells = new Map<string, number>();
    for (const track of LEVEL_TRACK_ORDER) {
      for (const difficulty of DIFFICULTY_ORDER) {
        const list = byTrack.get(track) ?? [];
        cells.set(
          `${track}:${difficulty}`,
          list.filter((mission) => mission.doc.difficulty === difficulty).length,
        );
      }
    }
    return cells;
  }, [byTrack]);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    for (const track of LEVEL_TRACK_ORDER) {
      if ((byTrack.get(track) ?? []).some((mission) => mission.id === id)) {
        setDragTrack(track);
        return;
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const track = dragTrack;
    setDragTrack(undefined);
    if (track === undefined) return;
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const list = byTrack.get(track) ?? [];
    const oldIndex = list.findIndex((mission) => mission.id === active.id);
    const newIndex = list.findIndex((mission) => mission.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(list, oldIndex, newIndex);
    setError(undefined);
    void adminApi
      .reorderMissions(track, reordered.map((mission) => mission.id))
      .then(() => revalidateAll())
      .catch((err: unknown) => {
        setError(err instanceof AdminApiError ? err.message : 'Reorder failed.');
        void revalidateAll();
      });
  }

  const warnings = useMemo(() => {
    const found: Array<{ track: LevelTrack; message: string }> = [];
    for (const track of LEVEL_TRACK_ORDER) {
      const list = byTrack.get(track) ?? [];
      if (list.length === 0) continue;
      const orders = list.map((mission) => mission.doc.trackOrder).sort((a, b) => a - b);
      for (let index = 1; index < orders.length; index += 1) {
        if (orders[index] /* nosemgrep: gitlab.eslint.detect-object-injection */! !== orders[index - 1]! + 1) {
          found.push({ track, message: 'Ordering has gaps — drag rows to close them.' });
          break;
        }
      }
      const difficulties = new Set(list.map((mission) => mission.doc.difficulty));
      if (difficulties.size > 1) {
        found.push({ track, message: 'Track mixes difficulty levels.' });
      }
    }
    return found;
  }, [byTrack]);

  return (
    <AdminShell
      title="Curriculum"
      description="Track × difficulty matrix and mission ordering. Drag to reorder within a track; changes apply to the learner map after the affected missions are published."
    >
      {error !== undefined && (
        <p role="alert" style={{ color: '#B91C1C' }}>
          {error}
        </p>
      )}
      {missions.isLoading && <LoadingState label="Loading curriculum…" />}
      {missions.error !== undefined && (
        <ErrorState
          title="Failed to load curriculum"
          description={missions.error instanceof Error ? missions.error.message : 'Unexpected error.'}
        />
      )}
      {!missions.isLoading && missions.error === undefined && (
        <>
          <div className={styles.matrix}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th scope="col">Track</th>
                  {DIFFICULTY_ORDER.map((difficulty) => (
                    <th scope="col" key={difficulty}>{DIFFICULTY_LABELS[difficulty] /* nosemgrep: gitlab.eslint.detect-object-injection */}</th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {LEVEL_TRACK_ORDER.map((track) => {
                  const list = byTrack.get(track) ?? [];
                  return (
                    <tr key={track}>
                      <th scope="row">{LEVEL_TRACK_LABELS[track] /* nosemgrep: gitlab.eslint.detect-object-injection */}</th>
                      {DIFFICULTY_ORDER.map((difficulty) => (
                        <td key={difficulty} className={matrix.get(`${track}:${difficulty}`) === 0 ? styles.zero : ''}>
                          {matrix.get(`${track}:${difficulty}`) ?? 0}
                        </td>
                      ))}
                      <td>{list.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {warnings.length > 0 && (
            <div className={styles.warnings} aria-label="Progression warnings">
              <Typography variant="label-caps" color="warning">
                Progression warnings
              </Typography>
              {warnings.map((warning) => (
                <p key={`${warning.track}:${warning.message}`} className={styles.warningItem}>
                  {LEVEL_TRACK_LABELS[warning.track] /* nosemgrep: gitlab.eslint.detect-object-injection */}: {warning.message}
                </p>
              ))}
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDragTrack(undefined)}>
            {LEVEL_TRACK_ORDER.map((track) => {
              const list = byTrack.get(track) ?? [];
              return (
                <section key={track} className={styles.trackSection} aria-label={LEVEL_TRACK_LABELS[track] /* nosemgrep: gitlab.eslint.detect-object-injection */}>
                  <Typography variant="card-title" as="h2">
                    {LEVEL_TRACK_LABELS[track] /* nosemgrep: gitlab.eslint.detect-object-injection */}
                  </Typography>
                  {list.length === 0 && (
                    <Typography variant="body-muted">No missions on this track yet.</Typography>
                  )}
                  <SortableContext items={list.map((mission) => mission.id)} strategy={verticalListSortingStrategy}>
                    <ul className={styles.trackList}>
                      {list.map((mission) => (
                        <TrackMissionChip
                          key={mission.id}
                          mission={mission}
                          onSelect={() => {
                            void router.push(`/missions/${encodeURIComponent(mission.id)}`);
                          }}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </section>
              );
            })}
          </DndContext>
        </>
      )}
    </AdminShell>
  );
}
