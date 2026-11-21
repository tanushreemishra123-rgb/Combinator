import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import type {
  AdminFlashcardDoc,
  AdminMissionDoc,
  AdminQuestionDoc,
  Checkpoint,
  Difficulty,
  LessonBlock,
  LevelTrack,
  MissionExample,
} from '@ai-learning-adventure/types';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  Button,
  IconButton,
  Select,
  TextArea,
  TextInput,
  Typography,
} from '@/components/ui';
import { AdminShell } from '@/components/layout/AdminShell';
import { EditorFooter } from './EditorFooter';
import { useEditorDraft } from './useEditor';
import { PublishGateDialog } from '@/components/PublishGateDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PreviewDialog } from '@/components/PreviewDialog';
import { adminApi } from '@/lib/api';
import { useContentList, useRevalidateAll } from '@/lib/hooks';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER, LEVEL_TRACK_LABELS, LEVEL_TRACK_ORDER, itemTitle } from '@/lib/labels';
import styles from './MissionEditorPage.module.scss';

function LessonBlockEditor({
  block,
  flashcards,
  onChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  block: LessonBlock;
  flashcards: Array<{ id: string; label: string }>;
  onChange: (next: LessonBlock) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className={styles.blockRow}>
      <div className={styles.blockControls}>
        <Select
          aria-label="Block type"
          value={block.type}
          options={[
            { label: 'Paragraph', value: 'paragraph' },
            { label: 'List', value: 'list' },
            { label: 'Callout', value: 'callout' },
            { label: 'Key term', value: 'key_term' },
          ]}
          onChange={(value) => {
            switch (value) {
              case 'paragraph':
                onChange({ type: 'paragraph', text: blockTextOf(block) });
                break;
              case 'list':
                onChange({ type: 'list', items: [blockTextOf(block)] });
                break;
              case 'callout':
                onChange({ type: 'callout', tone: 'key_idea', text: blockTextOf(block) });
                break;
              case 'key_term':
                onChange({ type: 'key_term', term: blockTextOf(block), flashcardId: '' as never });
                break;
            }
          }}
        />
        <div className={styles.blockMove}>
          <IconButton aria-label="Move block up" size="sm" disabled={!canMoveUp} onClick={() => onMove(-1)}>
            ↑
          </IconButton>
          <IconButton aria-label="Move block down" size="sm" disabled={!canMoveDown} onClick={() => onMove(1)}>
            ↓
          </IconButton>
          <IconButton aria-label="Remove block" size="sm" onClick={onRemove}>
            ✕
          </IconButton>
        </div>
      </div>
      {block.type === 'paragraph' && (
        <TextArea aria-label="Paragraph text" rows={2} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
      )}
      {block.type === 'list' && (
        <TextArea
          aria-label="List items (one per line)"
          rows={3}
          hint="One item per line"
          value={block.items.join('\n')}
          onChange={(event) => onChange({ ...block, items: event.target.value.split('\n') })}
        />
      )}
      {block.type === 'callout' && (
        <div className={styles.blockFields}>
          <Select
            aria-label="Callout tone"
            value={block.tone}
            options={[
              { label: 'Key idea', value: 'key_idea' },
              { label: 'Watch out', value: 'watch_out' },
            ]}
            onChange={(value) => onChange({ ...block, tone: value as 'key_idea' | 'watch_out' })}
          />
          <TextInput aria-label="Callout title" placeholder="Title (optional)" value={block.title ?? ''} onChange={(event) => onChange({ ...block, title: event.target.value.length > 0 ? event.target.value : undefined })} />
          <TextArea aria-label="Callout text" rows={2} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
        </div>
      )}
      {block.type === 'key_term' && (
        <div className={styles.blockFields}>
          <TextInput aria-label="Key term" value={block.term} onChange={(event) => onChange({ ...block, term: event.target.value })} />
          <Select
            aria-label="Linked flashcard"
            value={block.flashcardId as string}
            options={[{ label: 'No flashcard', value: '' }, ...flashcards.map((card) => ({ label: card.label, value: card.id }))]}
            onChange={(value) => onChange({ ...block, flashcardId: value as never })}
          />
        </div>
      )}
    </div>
  );
}

function blockTextOf(block: LessonBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.text;
    case 'list':
      return block.items.join('\n');
    case 'callout':
      return block.text;
    case 'key_term':
      return block.term;
  }
}

export function MissionEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const revalidateAll = useRevalidateAll();
  const editor = useEditorDraft<AdminMissionDoc>('mission', id);
  const missions = useContentList('mission');
  const questions = useContentList('question', { missionId: id });
  const flashcards = useContentList('flashcard', { missionId: id });
  const awards = useContentList('award');
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const doc = editor.doc;

  const missionOptions = useMemo(
    () => [
      { label: 'None', value: '' },
      ...missions.items
        .filter((mission) => mission.id !== id)
        .map((mission) => ({ label: itemTitle('mission', mission.doc), value: mission.id })),
    ],
    [missions.items, id],
  );

  const linkedAwards = useMemo(
    () => awards.items.filter((award) => (award.doc as { missionId?: string }).missionId === id),
    [awards.items, id],
  );

  if (editor.isLoading) {
    return (
      <AdminShell title="Mission">
        <p>Loading…</p>
      </AdminShell>
    );
  }

  if (editor.loadError !== undefined || doc === undefined) {
    return (
      <AdminShell title="Mission">
        <p role="alert">{editor.loadError ?? 'Mission not found.'}</p>
        <Button onClick={() => void router.push('/missions')}>Back to missions</Button>
      </AdminShell>
    );
  }

  function updateLesson(index: number, next: LessonBlock) {
    if (doc === undefined) return;
    const lesson = doc.lesson.map((block, blockIndex) => (blockIndex === index ? next : block));
    editor.update({ ...doc, lesson });
  }

  function moveLesson(index: number, direction: -1 | 1) {
    if (doc === undefined) return;
    const target = index + direction;
    if (target < 0 || target >= doc.lesson.length) return;
    const lesson = [...doc.lesson];
    const [moved] = lesson.splice(index, 1);
    lesson.splice(target, 0, moved as LessonBlock);
    editor.update({ ...doc, lesson });
  }

  function updateExample(next: MissionExample) {
    if (doc === undefined) return;
    editor.update({ ...doc, example: next });
  }

  function updateCheckpoint(next: Checkpoint) {
    if (doc === undefined) return;
    editor.update({ ...doc, checkpoint: next });
  }

  const flashcardLookup = flashcards.items.map((card) => ({
    id: card.id,
    label: itemTitle('flashcard', card.doc),
  }));

  const example = doc.example;
  const checkpoint = doc.checkpoint;

  return (
    <AdminShell title={doc.title.length > 0 ? doc.title : 'New mission'} description="Mission editor">
      <Accordion type="multiple" defaultValue={['basics', 'lesson', 'practice']}>
        <AccordionItem value="basics">
          <AccordionHeader>Basics</AccordionHeader>
          <AccordionContent>
            <div className={styles.sectionGrid}>
              <div id="field-title">
                <TextInput label="Title" value={doc.title} onChange={(event) => editor.update({ ...doc, title: event.target.value })} />
              </div>
              <div id="field-slug">
                <TextInput
                  label="Slug"
                  value={doc.slug}
                  hint="Lowercase letters, numbers, hyphens."
                  onChange={(event) => editor.update({ ...doc, slug: event.target.value })}
                />
              </div>
              <div id="field-objective">
                <TextArea
                  label="Learning objective"
                  rows={2}
                  value={doc.objective}
                  onChange={(event) => editor.update({ ...doc, objective: event.target.value })}
                />
              </div>
              <Select
                label="Difficulty"
                value={doc.difficulty}
                options={DIFFICULTY_ORDER.map((difficulty) => ({ label: DIFFICULTY_LABELS[difficulty] /* nosemgrep: gitlab.eslint.detect-object-injection */, value: difficulty }))}
                onChange={(value) => editor.update({ ...doc, difficulty: value as Difficulty })}
              />
              <Select
                label="Level track"
                value={doc.levelTrack}
                options={LEVEL_TRACK_ORDER.map((track) => ({ label: LEVEL_TRACK_LABELS[track] /* nosemgrep: gitlab.eslint.detect-object-injection */, value: track }))}
                onChange={(value) => editor.update({ ...doc, levelTrack: value as LevelTrack })}
              />
              <TextInput
                label="Order in track"
                type="number"
                value={String(doc.trackOrder || '')}
                onChange={(event) => {
                  const val = event.target.value;
                  const parsed = val === '' ? 0 : Number(val);
                  if (!Number.isNaN(parsed)) editor.update({ ...doc, trackOrder: parsed });
                }}
              />
              <TextInput
                label="Estimated minutes"
                type="number"
                value={String(doc.estimatedMinutes || '')}
                onChange={(event) => {
                  const val = event.target.value;
                  const parsed = val === '' ? 0 : Number(val);
                  if (!Number.isNaN(parsed)) editor.update({ ...doc, estimatedMinutes: parsed });
                }}
              />
              <TextInput
                label="Pass threshold (%)"
                type="number"
                value={String(doc.passThreshold || '')}
                onChange={(event) => {
                  const val = event.target.value;
                  const parsed = val === '' ? 0 : Number(val);
                  if (!Number.isNaN(parsed)) editor.update({ ...doc, passThreshold: parsed });
                }}
              />
              <Select
                label="Prerequisite mission"
                value={doc.prerequisiteMissionId ?? ''}
                options={missionOptions}
                onChange={(value) =>
                  editor.update({ ...doc, prerequisiteMissionId: value === '' ? undefined : value })
                }
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="lesson">
          <AccordionHeader>Lesson</AccordionHeader>
          <AccordionContent>
            <div id="field-lesson" className={styles.lessonBlocks}>
              {doc.lesson.map((block, index) => (
                <LessonBlockEditor
                  key={index}
                  block={block}
                  flashcards={flashcardLookup}
                  onChange={(next) => updateLesson(index, next)}
                  onRemove={() => editor.update({ ...doc, lesson: doc.lesson.filter((_, blockIndex) => blockIndex !== index) })}
                  onMove={(direction) => moveLesson(index, direction)}
                  canMoveUp={index > 0}
                  canMoveDown={index < doc.lesson.length - 1}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                iconLeft="+"
                onClick={() => editor.update({ ...doc, lesson: [...doc.lesson, { type: 'paragraph', text: '' }] })}
              >
                Add block
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="example">
          <AccordionHeader>Example</AccordionHeader>
          <AccordionContent>
            <div id="field-example" className={styles.sectionGrid}>
              <Select
                label="Example type"
                value={example.type}
                options={[
                  { label: 'Worked example', value: 'worked_example' },
                  { label: 'Scenario', value: 'scenario' },
                ]}
                onChange={(value) => {
                  if (value === 'worked_example') {
                    updateExample({ type: 'worked_example', before: '', after: '', annotations: [] });
                  } else {
                    updateExample({ type: 'scenario', narrative: '', reflectionPrompt: '', takeaway: '' });
                  }
                }}
              />
              {example.type === 'worked_example' ? (
                <>
                  <TextArea label="Before" rows={3} value={example.before} onChange={(event) => updateExample({ ...example, before: event.target.value })} />
                  <TextArea label="After" rows={3} value={example.after} onChange={(event) => updateExample({ ...example, after: event.target.value })} />
                  <TextArea
                    label="Annotations (one per line)"
                    rows={3}
                    value={example.annotations.join('\n')}
                    onChange={(event) => updateExample({ ...example, annotations: event.target.value.split('\n') })}
                  />
                </>
              ) : (
                <>
                  <TextArea label="Narrative" rows={3} value={example.narrative} onChange={(event) => updateExample({ ...example, narrative: event.target.value })} />
                  <TextArea label="Reflection prompt" rows={2} value={example.reflectionPrompt} onChange={(event) => updateExample({ ...example, reflectionPrompt: event.target.value })} />
                  <TextArea label="Takeaway" rows={2} value={example.takeaway} onChange={(event) => updateExample({ ...example, takeaway: event.target.value })} />
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="checkpoint">
          <AccordionHeader>Checkpoint</AccordionHeader>
          <AccordionContent>
            <div id="field-checkpoint" className={styles.sectionGrid}>
              <Select
                label="Checkpoint kind"
                value={checkpoint.kind}
                options={[
                  { label: 'Single question', value: 'single_question' },
                  { label: 'Write a response', value: 'write_response' },
                  { label: 'Sort into buckets', value: 'sort_into_buckets' },
                  { label: 'Spot the problem', value: 'spot_the_problem' },
                ]}
                onChange={(value) => {
                  switch (value) {
                    case 'single_question':
                      updateCheckpoint({ kind: 'single_question', prompt: '', options: [], explanation: '' });
                      break;
                    case 'write_response':
                      updateCheckpoint({ kind: 'write_response', prompt: '' });
                      break;
                    case 'sort_into_buckets':
                      updateCheckpoint({ kind: 'sort_into_buckets', prompt: '', buckets: [], items: [] });
                      break;
                    case 'spot_the_problem':
                      updateCheckpoint({ kind: 'spot_the_problem', prompt: '', passage: '', answerRange: { start: 0, end: 0 } });
                      break;
                  }
                }}
              />
              <TextArea
                label="Prompt"
                rows={2}
                value={checkpoint.prompt}
                onChange={(event) => updateCheckpoint({ ...checkpoint, prompt: event.target.value })}
              />
              {checkpoint.kind === 'single_question' && (
                <SingleQuestionCheckpointEditor checkpoint={checkpoint} onChange={updateCheckpoint} />
              )}
              {checkpoint.kind === 'sort_into_buckets' && (
                <JsonCheckpointEditor checkpoint={checkpoint} onChange={updateCheckpoint} />
              )}
              {checkpoint.kind === 'spot_the_problem' && (
                <JsonCheckpointEditor checkpoint={checkpoint} onChange={updateCheckpoint} />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="practice">
          <AccordionHeader>Practice</AccordionHeader>
          <AccordionContent>
            <div className={styles.practice}>
              <Typography variant="body">
                {questions.items.length} question{questions.items.length === 1 ? '' : 's'} · {flashcards.items.length} flashcard{flashcards.items.length === 1 ? '' : 's'} assigned.
              </Typography>
              <Typography variant="body-muted">
                Drag and drop questions or flashcards onto this mission on the{' '}
                <Link href="/missions/assignments">assignment board</Link>.
              </Typography>
              <ul className={styles.practiceList}>
                {questions.items.map((question) => (
                  <li key={question.id}>
                    <Link href={`/questions/${encodeURIComponent(question.id)}`}>
                      {itemTitle('question', question.doc)}
                    </Link>
                    <UnassignButton
                      entityType="question"
                      itemId={question.id}
                      onDone={() => void revalidateAll()}
                    />
                  </li>
                ))}
                {flashcards.items.map((card) => (
                  <li key={card.id}>
                    <Link href={`/flashcards/${encodeURIComponent(card.id)}`}>
                      {itemTitle('flashcard', card.doc)}
                    </Link>
                    <UnassignButton
                      entityType="flashcard"
                      itemId={card.id}
                      onDone={() => void revalidateAll()}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="award">
          <AccordionHeader>Award</AccordionHeader>
          <AccordionContent>
            <div className={styles.practice}>
              {linkedAwards.length === 0 ? (
                <Typography variant="body-muted">
                  No badge or milestone linked. <Link href="/badges">Create one</Link> and set its mission to this one.
                </Typography>
              ) : (
                <ul className={styles.practiceList}>
                  {linkedAwards.map((award) => (
                    <li key={award.id}>
                      <Link href={`/badges/${encodeURIComponent(award.id)}`}>{itemTitle('award', award.doc)}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <EditorFooter
        status={editor.status}
        enabled={editor.enabled}
        dirty={editor.dirty}
        saving={editor.saving}
        saveError={editor.saveError}
        onCancel={() => void router.push('/missions')}
        onSave={() => void editor.saveDraft()}
        onToggleEnabled={(enabled) => void adminApi.setEnabled('mission', id, enabled).then(() => revalidateAll())}
        onPublish={() =>
          void (async () => {
            if (editor.dirty && !(await editor.saveDraft())) return;
            setPublishOpen(true);
          })()
        }
        onUnpublish={() => setUnpublishOpen(true)}
        onPreview={() => setPreviewOpen(true)}
      />

      {publishOpen && editor.revision !== undefined && (
        <PublishGateDialog
          open
          entityType="mission"
          entityId={id}
          expectedRevision={editor.revision}
          allowDependentDrafts
          onClose={() => setPublishOpen(false)}
          onPublished={() => {
            setPublishOpen(false);
            void revalidateAll();
          }}
        />
      )}

      {unpublishOpen && (
        <ConfirmDialog
          open
          title="Unpublish this mission?"
          description="Learners lose access to the mission and its practice content until it is published again. Progress is retained."
          confirmLabel="Unpublish"
          destructive
          onConfirm={() =>
            void adminApi.unpublish('mission', id).then(() => {
              setUnpublishOpen(false);
              void revalidateAll();
            })
          }
          onClose={() => setUnpublishOpen(false)}
        />
      )}

      {previewOpen && <PreviewDialog open missionId={id} onClose={() => setPreviewOpen(false)} />}
    </AdminShell>
  );
}

function UnassignButton({
  entityType,
  itemId,
  onDone,
}: {
  entityType: 'question' | 'flashcard';
  itemId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <IconButton
      aria-label="Unassign from mission"
      size="sm"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void adminApi
          .practiceAssignments([{ entityType, id: itemId, missionId: null, index: 0 }])
          .then(onDone)
          .finally(() => setBusy(false));
      }}
    >
      ✕
    </IconButton>
  );
}

function SingleQuestionCheckpointEditor({
  checkpoint,
  onChange,
}: {
  checkpoint: Extract<Checkpoint, { kind: 'single_question' }>;
  onChange: (next: Checkpoint) => void;
}) {
  return (
    <div className={styles.sectionGrid}>
      {checkpoint.options.map((option, index) => (
        <div key={option.id} className={styles.checkpointOptionRow}>
          <input
            type="radio"
            name="checkpoint-correct"
            aria-label={`Option ${index + 1} is correct`}
            checked={option.isCorrect}
            onChange={() =>
              onChange({
                ...checkpoint,
                options: checkpoint.options.map((entry) => ({ ...entry, isCorrect: entry.id === option.id })),
              })
            }
          />
          <TextInput
            aria-label={`Checkpoint option ${index + 1}`}
            value={option.text}
            onChange={(event) =>
              onChange({
                ...checkpoint,
                options: checkpoint.options.map((entry) =>
                  entry.id === option.id ? { ...entry, text: event.target.value } : entry,
                ),
              })
            }
          />
          <IconButton
            aria-label={`Remove checkpoint option ${index + 1}`}
            size="sm"
            onClick={() => onChange({ ...checkpoint, options: checkpoint.options.filter((entry) => entry.id !== option.id) })}
          >
            ✕
          </IconButton>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        iconLeft="+"
        onClick={() =>
          onChange({
            ...checkpoint,
            options: [...checkpoint.options, { id: `cp-${checkpoint.options.length + 1}-${Date.now()}`, text: '', isCorrect: false }],
          })
        }
      >
        Add option
      </Button>
      <TextArea
        label="Explanation"
        rows={2}
        value={checkpoint.explanation}
        onChange={(event) => onChange({ ...checkpoint, explanation: event.target.value })}
      />
    </div>
  );
}

function JsonCheckpointEditor({
  checkpoint,
  onChange,
}: {
  checkpoint: Checkpoint;
  onChange: (next: Checkpoint) => void;
}) {
  const [raw, setRaw] = useState(() => JSON.stringify(checkpoint, null, 2));
  const [parseError, setParseError] = useState<string | undefined>(undefined);
  return (
    <div>
      <TextArea
        label="Checkpoint JSON"
        rows={8}
        value={raw}
        hint="Advanced: edit the full checkpoint object as JSON."
        error={parseError}
        onChange={(event) => {
          setRaw(event.target.value);
          try {
            const parsed = JSON.parse(event.target.value) as Checkpoint;
            setParseError(undefined);
            onChange(parsed);
          } catch {
            setParseError('Not valid JSON yet.');
          }
        }}
      />
    </div>
  );
}

export type { AdminFlashcardDoc, AdminQuestionDoc };
