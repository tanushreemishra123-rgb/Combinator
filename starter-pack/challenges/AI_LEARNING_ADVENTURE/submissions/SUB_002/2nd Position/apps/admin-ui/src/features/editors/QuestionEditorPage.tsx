import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AdminQuestionDoc, Difficulty, QuestionOption, QuestionType } from '@ai-learning-adventure/types';
import { Button, Checkbox, IconButton, Select, TextArea, TextInput, Typography } from '@/components/ui';
import { AdminShell } from '@/components/layout/AdminShell';
import { EditorFooter } from './EditorFooter';
import { useEditorDraft } from './useEditor';
import { PublishGateDialog } from '@/components/PublishGateDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { adminApi } from '@/lib/api';
import { useContentList, useRevalidateAll } from '@/lib/hooks';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER, itemTitle } from '@/lib/labels';
import styles from './QuestionEditorPage.module.scss';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  scenario: 'Scenario',
};

interface OptionRowProps {
  option: QuestionOption;
  index: number;
  selectionMode: 'single' | 'multiple';
  onChange: (next: QuestionOption) => void;
  onToggleCorrect: () => void;
  onRemove: () => void;
}

function OptionRow({ option, index, selectionMode, onChange, onToggleCorrect, onRemove }: OptionRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: option.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={styles.optionRow}>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.dragHandle}
        aria-label={`Reorder option ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <input
        type={selectionMode === 'single' ? 'radio' : 'checkbox'}
        name="correct-option"
        checked={option.isCorrect}
        onChange={onToggleCorrect}
        aria-label={`Option ${index + 1} is correct`}
      />
      <div className={styles.optionFields}>
        <TextInput
          aria-label={`Option ${index + 1} text`}
          value={option.text}
          placeholder="Option text"
          onChange={(event) => onChange({ ...option, text: event.target.value })}
        />
        {!option.isCorrect && (
          <TextInput
            aria-label={`Option ${index + 1} incorrect reason`}
            value={option.incorrectReason ?? ''}
            placeholder="Why this is wrong (optional)"
            onChange={(event) =>
              onChange({
                ...option,
                incorrectReason: event.target.value.length > 0 ? event.target.value : undefined,
              })
            }
          />
        )}
      </div>
      <IconButton aria-label={`Remove option ${index + 1}`} size="sm" onClick={onRemove}>
        ✕
      </IconButton>
    </div>
  );
}

export function QuestionEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const revalidateAll = useRevalidateAll();
  const editor = useEditorDraft<AdminQuestionDoc>('question', id);
  const missions = useContentList('mission');
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState<string | null>(null);

  const doc = editor.doc;

  const missionOptions = useMemo(
    () => [
      { label: 'Unassigned', value: '' },
      ...missions.items.map((mission) => ({ label: itemTitle('mission', mission.doc), value: mission.id })),
    ],
    [missions.items],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (editor.isLoading) {
    return (
      <AdminShell title="Question">
        <p>Loading…</p>
      </AdminShell>
    );
  }

  if (editor.loadError !== undefined || doc === undefined) {
    return (
      <AdminShell title="Question">
        <p role="alert">{editor.loadError ?? 'Question not found.'}</p>
        <Button onClick={() => void router.push('/questions')}>Back to questions</Button>
      </AdminShell>
    );
  }

  function changeType(type: QuestionType) {
    if (doc === undefined) return;
    if (type === 'true_false') {
      editor.update({
        ...doc,
        type,
        selectionMode: 'single',
        allowsReasoning: false,
        options: [
          { id: 'true', text: 'True', isCorrect: doc.options[0]?.isCorrect ?? true },
          { id: 'false', text: 'False', isCorrect: !(doc.options[0]?.isCorrect ?? true) },
        ],
      });
      return;
    }
    editor.update({ ...doc, type });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (doc === undefined || over === null || active.id === over.id) return;
    const oldIndex = doc.options.findIndex((option) => option.id === active.id);
    const newIndex = doc.options.findIndex((option) => option.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    editor.update({ ...doc, options: arrayMove(doc.options, oldIndex, newIndex) });
  }

  function toggleCorrect(optionId: string) {
    if (doc === undefined) return;
    if (doc.selectionMode === 'single') {
      editor.update({
        ...doc,
        options: doc.options.map((option) => ({ ...option, isCorrect: option.id === optionId })),
      });
      return;
    }
    editor.update({
      ...doc,
      options: doc.options.map((option) =>
        option.id === optionId ? { ...option, isCorrect: !option.isCorrect } : option,
      ),
    });
  }

  const tagsValue = doc.conceptTags.join(', ');

  return (
    <AdminShell
      title={doc.stem.length > 0 ? doc.stem : 'New question'}
      description="Quiz question editor"
    >
      <div className={styles.layout}>
        <div className={styles.form}>
          <div id="field-missionId">
            <Select
              label="Mission"
              value={doc.missionId ?? ''}
              options={missionOptions}
              onChange={(value) => editor.update({ ...doc, missionId: value === '' ? null : value })}
            />
          </div>
          <Select
            label="Question type"
            value={doc.type}
            options={Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({ label, value }))}
            onChange={(value) => changeType(value as QuestionType)}
          />
          <div id="field-stem">
            <TextArea
              label="Question stem"
              rows={2}
              value={doc.stem}
              onChange={(event) => editor.update({ ...doc, stem: event.target.value })}
            />
          </div>
          {doc.type === 'scenario' && (
            <div id="field-scenario">
              <TextArea
                label="Scenario"
                rows={3}
                value={doc.scenario ?? ''}
                hint="The situation the learner must reason about."
                onChange={(event) =>
                  editor.update({ ...doc, scenario: event.target.value.length > 0 ? event.target.value : undefined })
                }
              />
            </div>
          )}

          {doc.type !== 'true_false' && (
            <section aria-label="Answer options">
              <Typography variant="label-caps">Options (drag to reorder)</Typography>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={doc.options.map((option) => option.id)} strategy={verticalListSortingStrategy}>
                  <div className={styles.options}>
                    {doc.options.map((option, index) => (
                      <OptionRow
                        key={option.id}
                        option={option}
                        index={index}
                        selectionMode={doc.selectionMode}
                        onChange={(next) =>
                          editor.update({
                            ...doc,
                            options: doc.options.map((entry) => (entry.id === option.id ? next : entry)),
                          })
                        }
                        onToggleCorrect={() => toggleCorrect(option.id)}
                        onRemove={() =>
                          editor.update({ ...doc, options: doc.options.filter((entry) => entry.id !== option.id) })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <Button
                variant="outline"
                size="sm"
                iconLeft="+"
                onClick={() =>
                  editor.update({
                    ...doc,
                    options: [...doc.options, { id: `option-${doc.options.length + 1}-${Date.now()}`, text: '', isCorrect: false }],
                  })
                }
              >
                Add option
              </Button>
            </section>
          )}

          {doc.type === 'true_false' && (
            <section aria-label="True or false answer">
              <Typography variant="label-caps">Correct answer</Typography>
              <div className={styles.options}>
                {doc.options.map((option) => (
                  <label key={option.id} className={styles.tfRow}>
                    <input
                      type="radio"
                      name="tf-correct"
                      checked={option.isCorrect}
                      onChange={() => toggleCorrect(option.id)}
                    />
                    {option.text}
                  </label>
                ))}
              </div>
            </section>
          )}

          {doc.type === 'multiple_choice' && (
            <Select
              label="Selection mode"
              value={doc.selectionMode}
              options={[
                { label: 'Single answer', value: 'single' },
                { label: 'Select all that apply', value: 'multiple' },
              ]}
              onChange={(value) => editor.update({ ...doc, selectionMode: value as 'single' | 'multiple' })}
            />
          )}
          {doc.type === 'scenario' && (
            <Checkbox
              label="Allow written reasoning"
              description="Learners may explain their choice in free text."
              checked={doc.allowsReasoning}
              onChange={(event) => editor.update({ ...doc, allowsReasoning: event.target.checked })}
            />
          )}

          <div id="field-correctExplanation">
            <TextArea
              label="Correct-answer explanation"
              rows={2}
              value={doc.correctExplanation}
              onChange={(event) => editor.update({ ...doc, correctExplanation: event.target.value })}
            />
          </div>
          <div id="field-incorrectExplanation">
            <TextArea
              label="Incorrect-answer explanation"
              rows={2}
              value={doc.incorrectExplanation}
              onChange={(event) => editor.update({ ...doc, incorrectExplanation: event.target.value })}
            />
          </div>
          <TextInput
            label="Concept tags"
            value={tagsInput !== null ? tagsInput : doc.conceptTags.join(', ')}
            hint="Comma-separated. Used for weak-topic review."
            onChange={(event) => {
              const val = event.target.value;
              setTagsInput(val);
              editor.update({
                ...doc,
                conceptTags: val
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0),
              });
            }}
          />
          <Select
            label="Difficulty"
            value={doc.difficulty}
            options={DIFFICULTY_ORDER.map((difficulty) => ({
              label: DIFFICULTY_LABELS[difficulty] /* nosemgrep: gitlab.eslint.detect-object-injection */,
              value: difficulty,
            }))}
            onChange={(value) => editor.update({ ...doc, difficulty: value as Difficulty })}
          />
        </div>

        <div className={styles.previewPane}>
          <Typography variant="card-title">Learner preview</Typography>
          <div className={styles.previewCard}>
            {doc.type === 'scenario' && doc.scenario !== undefined && (
              <p className={styles.previewScenario}>{doc.scenario}</p>
            )}
            <p className={styles.previewStem}>{doc.stem || 'Question stem…'}</p>
            {doc.selectionMode === 'multiple' && <p>Select all that apply</p>}
            <ul className={styles.previewOptions}>
              {doc.options.map((option) => (
                <li key={option.id} className={option.isCorrect ? styles.previewCorrect : undefined}>
                  {option.text || '…'}
                  {option.isCorrect && <span aria-hidden="true"> ✓</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <EditorFooter
        status={editor.status}
        enabled={editor.enabled}
        dirty={editor.dirty}
        saving={editor.saving}
        saveError={editor.saveError}
        onCancel={() => void router.push('/questions')}
        onSave={() => void editor.saveDraft()}
        onToggleEnabled={(enabled) => void adminApi.setEnabled('question', id, enabled).then(() => revalidateAll())}
        onPublish={() =>
          void (async () => {
            if (editor.dirty && !(await editor.saveDraft())) return;
            setPublishOpen(true);
          })()
        }
        onUnpublish={() => setUnpublishOpen(true)}
      />

      {publishOpen && editor.revision !== undefined && (
        <PublishGateDialog
          open
          entityType="question"
          entityId={id}
          expectedRevision={editor.revision}
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
          title="Unpublish this question?"
          description="It is removed from the learner quiz until published again."
          confirmLabel="Unpublish"
          onConfirm={() =>
            void adminApi.unpublish('question', id).then(() => {
              setUnpublishOpen(false);
              void revalidateAll();
            })
          }
          onClose={() => setUnpublishOpen(false)}
        />
      )}
    </AdminShell>
  );
}
