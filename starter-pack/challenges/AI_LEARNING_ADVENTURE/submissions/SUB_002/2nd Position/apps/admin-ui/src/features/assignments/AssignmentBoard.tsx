import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AdminContentItem, AdminMissionDoc } from '@ai-learning-adventure/types';
import { Button, ErrorState, IconButton, LoadingState, Select, TabContent, TabList, TabTrigger, Tabs, TextInput, Typography } from '@/components/ui';
import { AdminShell } from '@/components/layout/AdminShell';
import { StatusBadge } from '@/components/StatusBadge';
import { AdminApiError, adminApi } from '@/lib/api';
import { useContentList, useRevalidateAll } from '@/lib/hooks';
import { LEVEL_TRACK_ORDER, itemTitle } from '@/lib/labels';
import styles from './AssignmentBoard.module.scss';

type PracticeType = 'question' | 'flashcard';

interface BoardState {
  questions: Record<string, string[]>;
  flashcards: Record<string, string[]>;
  unassignedQuestions: string[];
  unassignedFlashcards: string[];
}

interface ActiveDrag {
  entityType: PracticeType;
  id: string;
  from: string | 'library' | 'unassigned';
}

function emptyBoard(missionIds: string[]): BoardState {
  return {
    questions: Object.fromEntries(missionIds.map((missionId) => [missionId, []])),
    flashcards: Object.fromEntries(missionIds.map((missionId) => [missionId, []])),
    unassignedQuestions: [],
    unassignedFlashcards: [],
  };
}

function listForType(board: BoardState, entityType: PracticeType): Record<string, string[]> {
  return entityType === 'question' ? board.questions : board.flashcards;
}

function unassignedForType(board: BoardState, entityType: PracticeType): string[] {
  return entityType === 'question' ? board.unassignedQuestions : board.unassignedFlashcards;
}

function withListForType(board: BoardState, entityType: PracticeType, next: Record<string, string[]>): BoardState {
  return entityType === 'question' ? { ...board, questions: next } : { ...board, flashcards: next };
}

function withUnassignedForType(board: BoardState, entityType: PracticeType, next: string[]): BoardState {
  return entityType === 'question' ? { ...board, unassignedQuestions: next } : { ...board, unassignedFlashcards: next };
}

function cloneBoard(board: BoardState): BoardState {
  return {
    questions: Object.fromEntries(Object.entries(board.questions).map(([missionId, ids]) => [missionId, [...ids]])),
    flashcards: Object.fromEntries(Object.entries(board.flashcards).map(([missionId, ids]) => [missionId, [...ids]])),
    unassignedQuestions: [...board.unassignedQuestions],
    unassignedFlashcards: [...board.unassignedFlashcards],
  };
}

function findContainerOf(board: BoardState, entityType: PracticeType, id: string): string | 'unassigned' {
  const lists = listForType(board, entityType);
  for (const [missionId, ids] of Object.entries(lists)) {
    if (ids.includes(id)) return missionId;
  }
  return 'unassigned';
}

function removeFrom(board: BoardState, entityType: PracticeType, id: string): BoardState {
  const container = findContainerOf(board, entityType, id);
  if (container === 'unassigned') {
    return withUnassignedForType(
      board,
      entityType,
      unassignedForType(board, entityType).filter((entry) => entry !== id),
    );
  }
  const lists = listForType(board, entityType);
  return withListForType(board, entityType, {
    ...lists,
    [container]: lists[container]!.filter((entry) => entry !== id),
  });
}

function insertInto(
  board: BoardState,
  entityType: PracticeType,
  id: string,
  target: string | 'unassigned',
  index: number,
): BoardState {
  const next = removeFrom(board, entityType, id);
  if (target === 'unassigned') {
    const list = unassignedForType(next, entityType);
    const clamped = Math.max(0, Math.min(index, list.length));
    const updated = [...list];
    updated.splice(clamped, 0, id);
    return withUnassignedForType(next, entityType, updated);
  }
  const lists = listForType(next, entityType);
  const list = lists[target] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? [];
  const clamped = Math.max(0, Math.min(index, list.length));
  const updated = [...list];
  updated.splice(clamped, 0, id);
  return withListForType(next, entityType, { ...lists, [target]: updated });
}

function parseDraggableId(raw: string): { kind: 'library' | 'item'; entityType: PracticeType; id: string } | undefined {
  if (raw.startsWith('library:')) {
    const [, entityType, id] = raw.split(':');
    if ((entityType === 'question' || entityType === 'flashcard') && id !== undefined) {
      return { kind: 'library', entityType, id };
    }
    return undefined;
  }
  if (raw.startsWith('item:')) {
    const [, entityType, id] = raw.split(':');
    if ((entityType === 'question' || entityType === 'flashcard') && id !== undefined) {
      return { kind: 'item', entityType, id };
    }
    return undefined;
  }
  return undefined;
}

function LibraryChip({
  item,
  missions,
  onAssign,
}: {
  item: AdminContentItem;
  missions: Array<AdminContentItem<AdminMissionDoc>>;
  onAssign: (id: string, missionId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `library:${item.entityType}:${item.id}`,
    data: { entityType: item.entityType, id: item.id },
  });
  const [moving, setMoving] = useState(false);
  return (
    <div ref={setNodeRef} className={isDragging ? `${styles.chip} ${styles.chipDragging}` : styles.chip}>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        aria-label={`Drag ${itemTitle(item.entityType, item.doc)}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className={styles.chipTitle} title={itemTitle(item.entityType, item.doc)}>
        {itemTitle(item.entityType, item.doc)}
      </span>
      <Select
        aria-label={`Assign ${itemTitle(item.entityType, item.doc)} to mission`}
        value=""
        disabled={moving}
        options={[
          { label: 'Assign to…', value: '' },
          ...missions.map((mission) => ({ label: itemTitle('mission', mission.doc), value: mission.id })),
        ]}
        onChange={(value) => {
          if (value === '') return;
          setMoving(true);
          onAssign(item.id, value);
          setMoving(false);
        }}
      />
    </div>
  );
}

function SortableChip({
  item,
  missions,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onMoveTo,
}: {
  item: AdminContentItem;
  missions: Array<AdminContentItem<AdminMissionDoc>>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveTo: (missionId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `item:${item.entityType}:${item.id}`,
    data: { entityType: item.entityType, id: item.id },
  });
  const [moving, setMoving] = useState(false);
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={styles.chip}>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        aria-label={`Drag ${itemTitle(item.entityType, item.doc)}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <IconButton aria-label="Move up" size="sm" disabled={!canMoveUp} onClick={onMoveUp}>
        ↑
      </IconButton>
      <IconButton aria-label="Move down" size="sm" disabled={!canMoveDown} onClick={onMoveDown}>
        ↓
      </IconButton>
      <span className={styles.chipTitle} title={itemTitle(item.entityType, item.doc)}>
        {itemTitle(item.entityType, item.doc)}
      </span>
      <Select
        aria-label={`Move ${itemTitle(item.entityType, item.doc)} to`}
        value=""
        disabled={moving}
        options={[
          { label: 'Move to…', value: '' },
          { label: 'Unassigned', value: '__unassigned__' },
          ...missions.map((mission) => ({ label: itemTitle('mission', mission.doc), value: mission.id })),
        ]}
        onChange={(value) => {
          if (value === '') return;
          setMoving(true);
          onMoveTo(value === '__unassigned__' ? null : value);
          setMoving(false);
        }}
      />
    </div>
  );
}

function MissionZone({
  mission,
  entityType,
  itemIds,
  itemsById,
  missions,
  onMoveUp,
  onMoveDown,
  onMoveTo,
  questionCount,
  flashcardCount,
}: {
  mission: AdminContentItem<AdminMissionDoc>;
  entityType: PracticeType;
  itemIds: string[];
  itemsById: Map<string, AdminContentItem>;
  missions: Array<AdminContentItem<AdminMissionDoc>>;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onMoveTo: (id: string, missionId: string | null) => void;
  questionCount: number;
  flashcardCount: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:mission:${mission.id}`, data: { missionId: mission.id } });
  return (
    <section
      ref={setNodeRef}
      className={isOver ? `${styles.zone} ${styles.zoneOver}` : styles.zone}
      aria-label={`Mission ${itemTitle('mission', mission.doc)}`}
    >
      <header className={styles.zoneHeader}>
        <div className={styles.zoneTitle}>
          <span className={styles.zoneName}>{itemTitle('mission', mission.doc)}</span>
          <StatusBadge status={mission.status} enabled={mission.enabled} />
        </div>
        <span className={questionCount >= 5 && flashcardCount >= 3 ? styles.coverageOk : styles.coverageWarn}>
          {questionCount}/5 questions · {flashcardCount}/3 flashcards
        </span>
      </header>
      <SortableContext items={itemIds.map((id) => `item:${entityType}:${id}`)} strategy={verticalListSortingStrategy}>
        <ul className={styles.zoneList}>
          {itemIds.map((id, index) => {
            const item = itemsById.get(id);
            if (item === undefined) return null;
            return (
              <li key={id}>
                <SortableChip
                  item={item}
                  missions={missions}
                  canMoveUp={index > 0}
                  canMoveDown={index < itemIds.length - 1}
                  onMoveUp={() => onMoveUp(id)}
                  onMoveDown={() => onMoveDown(id)}
                  onMoveTo={(missionId) => onMoveTo(id, missionId)}
                />
              </li>
            );
          })}
        </ul>
      </SortableContext>
      {itemIds.length === 0 && <p className={styles.zoneEmpty}>Drop {entityType}s here</p>}
    </section>
  );
}

export function AssignmentBoard() {
  const revalidateAll = useRevalidateAll();
  const missionsResult = useContentList('mission');
  const questionsResult = useContentList('question');
  const flashcardsResult = useContentList('flashcard');
  const [tab, setTab] = useState('question');
  const [search, setSearch] = useState('');
  const [overlayItem, setOverlayItem] = useState<AdminContentItem | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const activeRef = useRef<ActiveDrag | undefined>(undefined);

  const entityType: PracticeType = tab === 'question' ? 'question' : 'flashcard';

  const board = useMemo(() => {
    const next = emptyBoard(missionsResult.items.map((mission) => mission.id));
    const questionOrder = new Map(
      questionsResult.items.map((item) => [item.id, (item.doc as { displayOrder?: number }).displayOrder ?? 0]),
    );
    const flashcardOrder = new Map(
      flashcardsResult.items.map((item) => [item.id, (item.doc as { displayOrder?: number }).displayOrder ?? 0]),
    );
    for (const item of questionsResult.items) {
      const missionId = (item.doc as { missionId?: string | null }).missionId;
      if (typeof missionId === 'string' && next.questions[missionId] !== undefined) {
        next.questions[missionId]!.push(item.id);
      } else {
        next.unassignedQuestions.push(item.id);
      }
    }
    for (const item of flashcardsResult.items) {
      const missionId = (item.doc as { missionId?: string | null }).missionId;
      if (typeof missionId === 'string' && next.flashcards[missionId] !== undefined) {
        next.flashcards[missionId]!.push(item.id);
      } else {
        next.unassignedFlashcards.push(item.id);
      }
    }
    for (const list of Object.values(next.questions)) {
      list.sort((a, b) => (questionOrder.get(a) ?? 0) - (questionOrder.get(b) ?? 0));
    }
    for (const list of Object.values(next.flashcards)) {
      list.sort((a, b) => (flashcardOrder.get(a) ?? 0) - (flashcardOrder.get(b) ?? 0));
    }
    return next;
  }, [missionsResult.items, questionsResult.items, flashcardsResult.items]);

  const itemsById = useMemo(() => {
    const map = new Map<string, AdminContentItem>();
    for (const item of questionsResult.items) map.set(item.id, item);
    for (const item of flashcardsResult.items) map.set(item.id, item);
    return map;
  }, [questionsResult.items, flashcardsResult.items]);

  const missions = useMemo(
    () =>
      [...missionsResult.items]
        .filter((mission): mission is AdminContentItem<AdminMissionDoc> => true)
        .sort((a, b) => {
          const docA = a.doc as AdminMissionDoc;
          const docB = b.doc as AdminMissionDoc;
          const trackA = LEVEL_TRACK_ORDER.indexOf(docA.levelTrack);
          const trackB = LEVEL_TRACK_ORDER.indexOf(docB.levelTrack);
          return (trackA - trackB) || (docA.trackOrder - docB.trackOrder);
        }),
    [missionsResult.items],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commitChange = useCallback(
    async (entity: PracticeType, id: string, missionId: string | null, index: number) => {
      setActionError(undefined);
      try {
        await adminApi.practiceAssignments([{ entityType: entity, id, missionId, index }]);
        await revalidateAll();
      } catch (error) {
        setActionError(error instanceof AdminApiError ? error.message : 'The move could not be saved.');
        await revalidateAll();
      }
    },
    [revalidateAll],
  );

  function handleDragStart(event: DragStartEvent) {
    const parsed = parseDraggableId(String(event.active.id));
    if (parsed === undefined) return;
    activeRef.current = {
      entityType: parsed.entityType,
      id: parsed.id,
      from: parsed.kind === 'library' ? 'library' : findContainerOf(board, parsed.entityType, parsed.id),
    };
    setOverlayItem(itemsById.get(parsed.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = activeRef.current;
    const { over } = event;
    setOverlayItem(undefined);
    activeRef.current = undefined;
    if (active === undefined || over === null || event.active.id === over.id) return;

    const overParsed = parseDraggableId(String(over.id));
    if (overParsed !== undefined) {
      const overContainer = findContainerOf(board, overParsed.entityType, overParsed.id);
      const activeContainer = active.from === 'library' ? 'unassigned' : active.from;
      const targetList =
        overContainer === 'unassigned'
          ? unassignedForType(board, active.entityType)
          : (listForType(board, active.entityType)[overContainer] ?? []);
      const targetIndex = targetList.indexOf(overParsed.id);
      if (activeContainer === overContainer) {
        const oldIndex = targetList.indexOf(active.id);
        if (oldIndex === targetIndex || targetIndex < 0) return;
        void commitChange(active.entityType, active.id, overContainer === 'unassigned' ? null : overContainer, targetIndex);
      } else {
        void commitChange(
          active.entityType,
          active.id,
          overContainer === 'unassigned' ? null : overContainer,
          targetIndex < 0 ? targetList.length : targetIndex,
        );
      }
      return;
    }

    const zoneId = String(over.id);
    if (zoneId.startsWith('zone:mission:')) {
      const missionId = zoneId.slice('zone:mission:'.length);
      const list = listForType(board, active.entityType)[missionId] ?? [];
      void commitChange(active.entityType, active.id, missionId, list.length);
      return;
    }

    if (zoneId === `zone:unassigned:${active.entityType}`) {
      const list = unassignedForType(board, active.entityType);
      void commitChange(active.entityType, active.id, null, list.length);
      return;
    }
  }

  function handleDragCancel() {
    setOverlayItem(undefined);
    activeRef.current = undefined;
  }

  const visibleQuestions = useMemo(() => {
    const list = questionsResult.items.filter((item) => (item.doc as { missionId?: string | null }).missionId === null);
    if (search.trim().length === 0) return list;
    const needle = search.trim().toLowerCase();
    return list.filter((item) => itemTitle(item.entityType, item.doc).toLowerCase().includes(needle));
  }, [questionsResult.items, search]);

  const visibleFlashcards = useMemo(() => {
    const list = flashcardsResult.items.filter((item) => (item.doc as { missionId?: string | null }).missionId === null);
    if (search.trim().length === 0) return list;
    const needle = search.trim().toLowerCase();
    return list.filter((item) => itemTitle(item.entityType, item.doc).toLowerCase().includes(needle));
  }, [flashcardsResult.items, search]);

  const isLoading = missionsResult.isLoading || questionsResult.isLoading || flashcardsResult.isLoading;
  const loadError = missionsResult.error ?? questionsResult.error ?? flashcardsResult.error;

  return (
    <AdminShell
      title="Practice assignment board"
      description="Drag questions and flashcards onto missions or between them. Keyboard: focus a drag handle, press Space, then use arrow keys."
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabList aria-label="Content type">
          <TabTrigger value="question">Questions</TabTrigger>
          <TabTrigger value="flashcard">Flashcards</TabTrigger>
        </TabList>
        <TabContent value="question">
          <BoardContent
            entityType="question"
            search={search}
            setSearch={setSearch}
            board={board}
            libraryItems={visibleQuestions}
            missions={missions}
            itemsById={itemsById}
            sensors={sensors}
            isLoading={isLoading}
            loadError={loadError instanceof Error ? loadError.message : undefined}
            actionError={actionError}
            overlayItem={overlayItem}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            onCommit={(id, missionId, index) => void commitChange('question', id, missionId, index)}
          />
        </TabContent>
        <TabContent value="flashcard">
          <BoardContent
            entityType="flashcard"
            search={search}
            setSearch={setSearch}
            board={board}
            libraryItems={visibleFlashcards}
            missions={missions}
            itemsById={itemsById}
            sensors={sensors}
            isLoading={isLoading}
            loadError={loadError instanceof Error ? loadError.message : undefined}
            actionError={actionError}
            overlayItem={overlayItem}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            onCommit={(id, missionId, index) => void commitChange('flashcard', id, missionId, index)}
          />
        </TabContent>
      </Tabs>
    </AdminShell>
  );
}

interface BoardContentProps {
  entityType: PracticeType;
  search: string;
  setSearch: (value: string) => void;
  board: BoardState;
  libraryItems: AdminContentItem[];
  missions: Array<AdminContentItem<AdminMissionDoc>>;
  itemsById: Map<string, AdminContentItem>;
  sensors: ReturnType<typeof useSensors>;
  isLoading: boolean;
  loadError?: string;
  actionError?: string;
  overlayItem?: AdminContentItem;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  onCommit: (id: string, missionId: string | null, index: number) => void;
}

function BoardContent({
  entityType,
  search,
  setSearch,
  board,
  libraryItems,
  missions,
  itemsById,
  sensors,
  isLoading,
  loadError,
  actionError,
  overlayItem,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onCommit,
}: BoardContentProps) {
  const { setNodeRef: unassignedRef, isOver: unassignedOver } = useDroppable({
    id: `zone:unassigned:${entityType}`,
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {actionError !== undefined && (
        <p role="alert" style={{ color: '#B91C1C' }}>
          {actionError}
        </p>
      )}
      {isLoading && <LoadingState label="Loading assignments…" />}
      {loadError !== undefined && (
        <ErrorState
          title="Failed to load assignments"
          description={loadError}
          action={<Button variant="outline">Retry</Button>}
        />
      )}
      {!isLoading && loadError === undefined && (
        <div className={styles.layout}>
          <aside className={styles.library}>
            <TextInput placeholder="Search…" aria-label="Search library" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Typography variant="card-title" as="h2">
              Unassigned {entityType}s
            </Typography>
            <div ref={unassignedRef} className={unassignedOver ? `${styles.unassignedZone} ${styles.zoneOver}` : styles.unassignedZone}>
              {libraryItems.length === 0 && <p className={styles.zoneEmpty}>Nothing unassigned.</p>}
              {libraryItems.map((item) => (
                <LibraryChip
                  key={item.id}
                  item={item}
                  missions={missions}
                  onAssign={(id, missionId) =>
                    onCommit(id, missionId, listForType(board, entityType)[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */?.length ?? 0)
                  }
                />
              ))}
            </div>
          </aside>

          <div className={styles.zones}>
            {missions.map((mission) => (
              <MissionZone
                key={mission.id}
                mission={mission}
                entityType={entityType}
                itemIds={listForType(board, entityType)[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? []}
                itemsById={itemsById}
                missions={missions}
                onMoveUp={(id) => {
                  const list = listForType(board, entityType)[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? [];
                  const index = list.indexOf(id);
                  if (index <= 0) return;
                  onCommit(id, mission.id, index - 1);
                }}
                onMoveDown={(id) => {
                  const list = listForType(board, entityType)[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? [];
                  const index = list.indexOf(id);
                  if (index < 0 || index >= list.length - 1) return;
                  onCommit(id, mission.id, index + 1);
                }}
                onMoveTo={(id, targetMissionId) => {
                  const targetList =
                    targetMissionId === null ? [] : (listForType(board, entityType)[targetMissionId] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? []);
                  onCommit(id, targetMissionId, targetList.length);
                }}
                questionCount={board.questions[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.length ?? 0}
                flashcardCount={board.flashcards[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.length ?? 0}
              />
            ))}
          </div>
        </div>
      )}
      <DragOverlay>
        {overlayItem !== undefined && (
          <div className={styles.overlayChip}>{itemTitle(overlayItem.entityType, overlayItem.doc)}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
