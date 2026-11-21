import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import type { AdminFlashcardDoc, Difficulty } from '@ai-learning-adventure/types';
import { Button, Select, TextArea, TextInput, Typography } from '@/components/ui';
import { AdminShell } from '@/components/layout/AdminShell';
import { EditorFooter } from './EditorFooter';
import { useEditorDraft } from './useEditor';
import { PublishGateDialog } from '@/components/PublishGateDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { adminApi } from '@/lib/api';
import { useContentList, useRevalidateAll } from '@/lib/hooks';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER, itemTitle } from '@/lib/labels';
import styles from './FlashcardEditorPage.module.scss';

export function FlashcardEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const revalidateAll = useRevalidateAll();
  const editor = useEditorDraft<AdminFlashcardDoc>('flashcard', id);
  const missions = useContentList('mission');
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [tagsInput, setTagsInput] = useState<string | null>(null);

  const doc = editor.doc;

  const missionOptions = useMemo(
    () => [
      { label: 'Unassigned', value: '' },
      ...missions.items.map((mission) => ({ label: itemTitle('mission', mission.doc), value: mission.id })),
    ],
    [missions.items],
  );

  if (editor.isLoading) {
    return (
      <AdminShell title="Flashcard">
        <p>Loading…</p>
      </AdminShell>
    );
  }

  if (editor.loadError !== undefined || doc === undefined) {
    return (
      <AdminShell title="Flashcard">
        <p role="alert">{editor.loadError ?? 'Flashcard not found.'}</p>
        <Button onClick={() => void router.push('/flashcards')}>Back to flashcards</Button>
      </AdminShell>
    );
  }

  const tagsValue = doc.conceptTags.join(', ');

  return (
    <AdminShell title={doc.concept.length > 0 ? doc.concept : 'New flashcard'} description="Flashcard editor">
      <div className={styles.layout}>
        <div className={styles.form}>
          <div id="field-missionId">
            <Select
              label="Mission"
              value={doc.missionId ?? ''}
              options={missionOptions}
              onChange={(value) => editor.update({ ...doc, missionId: value === '' ? null : value })}
              hint="Learners see this card in the mission deck."
            />
          </div>
          <div id="field-concept">
            <TextInput
              label="Concept"
              value={doc.concept}
              onChange={(event) => editor.update({ ...doc, concept: event.target.value })}
            />
          </div>
          <div id="field-definition">
            <TextArea
              label="Definition"
              value={doc.definition}
              rows={3}
              hint="Keep it brief — this is the back of the card."
              onChange={(event) => editor.update({ ...doc, definition: event.target.value })}
            />
          </div>
          <div id="field-example">
            <TextArea
              label="Example"
              value={doc.example}
              rows={2}
              onChange={(event) => editor.update({ ...doc, example: event.target.value })}
            />
          </div>
          <div id="field-commonMistake">
            <TextArea
              label="Common mistake"
              value={doc.commonMistake ?? ''}
              rows={2}
              hint="At least one of Common mistake or Learning tip is required."
              onChange={(event) =>
                editor.update({ ...doc, commonMistake: event.target.value.length > 0 ? event.target.value : undefined })
              }
            />
          </div>
          <div id="field-learningTip">
            <TextArea
              label="Learning tip"
              value={doc.learningTip ?? ''}
              rows={2}
              onChange={(event) =>
                editor.update({ ...doc, learningTip: event.target.value.length > 0 ? event.target.value : undefined })
              }
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
          <Typography variant="card-title">Learner card preview</Typography>
          <button
            type="button"
            className={flipped ? `${styles.card} ${styles.cardFlipped}` : styles.card}
            onClick={() => setFlipped((current) => !current)}
            aria-pressed={flipped}
          >
            <span className={styles.cardFace}>
              {flipped ? (
                <span className={styles.cardBack}>
                  <strong>{doc.concept || 'Concept'}</strong>
                  <span>{doc.definition || 'Definition appears here.'}</span>
                  {doc.example.length > 0 && <em>{doc.example}</em>}
                  {doc.commonMistake !== undefined && <span>Common mistake: {doc.commonMistake}</span>}
                  {doc.learningTip !== undefined && <span>Tip: {doc.learningTip}</span>}
                </span>
              ) : (
                <span className={styles.cardFront}>{doc.concept || 'Concept'}</span>
              )}
            </span>
          </button>
          <Button variant="ghost" size="sm" onClick={() => setFlipped((current) => !current)}>
            Flip card
          </Button>
        </div>
      </div>

      <EditorFooter
        status={editor.status}
        enabled={editor.enabled}
        dirty={editor.dirty}
        saving={editor.saving}
        saveError={editor.saveError}
        onCancel={() => void router.push('/flashcards')}
        onSave={() => void editor.saveDraft()}
        onToggleEnabled={(enabled) =>
          void adminApi.setEnabled('flashcard', id, enabled).then(() => revalidateAll())
        }
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
          entityType="flashcard"
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
          title="Unpublish this flashcard?"
          description="It leaves the learner deck until published again."
          confirmLabel="Unpublish"
          onConfirm={() =>
            void adminApi.unpublish('flashcard', id).then(() => {
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
