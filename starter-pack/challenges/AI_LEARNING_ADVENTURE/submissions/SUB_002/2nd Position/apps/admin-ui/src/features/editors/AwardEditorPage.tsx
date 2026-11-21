import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import type { AdminAwardDoc, AwardRule, MissionId } from '@ai-learning-adventure/types';
import { Button, Select, TextArea, TextInput } from '@/components/ui';
import { AdminShell } from '@/components/layout/AdminShell';
import { EditorFooter } from './EditorFooter';
import { useEditorDraft } from './useEditor';
import { PublishGateDialog } from '@/components/PublishGateDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { adminApi } from '@/lib/api';
import { useContentList, useRevalidateAll } from '@/lib/hooks';
import { LEVEL_TRACK_LABELS, LEVEL_TRACK_ORDER, itemTitle } from '@/lib/labels';
import styles from './AwardEditorPage.module.scss';

export function AwardEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const revalidateAll = useRevalidateAll();
  const editor = useEditorDraft<AdminAwardDoc>('award', id);
  const missions = useContentList('mission');
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);

  const doc = editor.doc;

  const missionOptions = useMemo(
    () => [
      { label: 'None', value: '' },
      ...missions.items.map((mission) => ({ label: itemTitle('mission', mission.doc), value: mission.id })),
    ],
    [missions.items],
  );

  if (editor.isLoading) {
    return (
      <AdminShell title="Badge / Milestone">
        <p>Loading…</p>
      </AdminShell>
    );
  }

  if (editor.loadError !== undefined || doc === undefined) {
    return (
      <AdminShell title="Badge / Milestone">
        <p role="alert">{editor.loadError ?? 'Award not found.'}</p>
        <Button onClick={() => void router.push('/badges')}>Back to badges</Button>
      </AdminShell>
    );
  }

  function updateAward(next: AdminAwardDoc) {
    if (next.kind === 'badge') {
      editor.update({
        ...next,
        rule: {
          type: 'mission_completed',
          missionId: (next.missionId ?? '') as never,
        },
      });
    } else {
      editor.update(next);
    }
  }

  function changeKind(kind: AdminAwardDoc['kind']) {
    if (doc === undefined) return;
    if (kind === 'badge') {
      updateAward({
        ...doc,
        kind,
        rule: { type: 'mission_completed', missionId: (doc.missionId ?? '') as never },
      });
    } else {
      updateAward({ ...doc, kind, missionId: undefined, rule: { type: 'percent_complete', minPercent: 100 } });
    }
  }

  function changeRule(rule: AwardRule) {
    if (doc === undefined) return;
    updateAward({ ...doc, rule });
  }

  const rule = doc.rule;

  return (
    <AdminShell title={doc.name.length > 0 ? doc.name : 'New badge / milestone'} description="Award editor">
      <div className={styles.form}>
        <Select
          label="Kind"
          value={doc.kind}
          options={[
            { label: 'Badge', value: 'badge' },
            { label: 'Milestone', value: 'milestone' },
          ]}
          onChange={(value) => changeKind(value as AdminAwardDoc['kind'])}
        />
        <div id="field-name">
          <TextInput label="Name" value={doc.name} onChange={(event) => updateAward({ ...doc, name: event.target.value })} />
        </div>
        <div id="field-icon">
          <TextInput
            label="Icon key"
            value={doc.icon}
            hint="Icon identifier rendered by the learner badge collection."
            onChange={(event) => updateAward({ ...doc, icon: event.target.value })}
          />
        </div>
        <div id="field-description">
          <TextArea
            label="Description"
            rows={2}
            value={doc.description}
            onChange={(event) => updateAward({ ...doc, description: event.target.value })}
          />
        </div>

        {doc.kind === 'badge' && (
          <div id="field-missionId">
            <Select
              label="Linked mission"
              value={doc.missionId ?? ''}
              options={missionOptions}
              onChange={(value) =>
                updateAward({
                  ...doc,
                  missionId: value === '' ? undefined : value,
                  rule: { type: 'mission_completed', missionId: (value === '' ? '' : value) as never },
                })
              }
            />
          </div>
        )}

        {doc.kind === 'milestone' && (
          <div id="field-rule" className={styles.rule}>
            <Select
              label="Rule"
              value={rule.type}
              options={[
                { label: 'Mission completed', value: 'mission_completed' },
                { label: 'Track completed', value: 'track_completed' },
                { label: 'Score threshold', value: 'score_threshold' },
                { label: 'Streak', value: 'streak' },
                { label: 'Percent complete', value: 'percent_complete' },
              ]}
              onChange={(value) => {
                switch (value) {
                  case 'mission_completed':
                    changeRule({ type: 'mission_completed', missionId: (missions.items[0]?.id ?? '') as never });
                    break;
                  case 'track_completed':
                    changeRule({ type: 'track_completed', levelTrack: 'beginner' });
                    break;
                  case 'score_threshold':
                    changeRule({ type: 'score_threshold', minScorePercent: 90 });
                    break;
                  case 'streak':
                    changeRule({ type: 'streak', length: 3 });
                    break;
                  case 'percent_complete':
                    changeRule({ type: 'percent_complete', minPercent: 100 });
                    break;
                }
              }}
            />
            {rule.type === 'mission_completed' && (
              <Select
                label="Mission"
                value={rule.missionId as string}
                options={missions.items.map((mission) => ({ label: itemTitle('mission', mission.doc), value: mission.id }))}
                onChange={(value) => changeRule({ ...rule, missionId: value as never })}
              />
            )}
            {rule.type === 'track_completed' && (
              <Select
                label="Track"
                value={rule.levelTrack}
                options={LEVEL_TRACK_ORDER.map((track) => ({ label: LEVEL_TRACK_LABELS[track] /* nosemgrep: gitlab.eslint.detect-object-injection */, value: track }))}
                onChange={(value) => changeRule({ ...rule, levelTrack: value as never })}
              />
            )}
            {rule.type === 'score_threshold' && (
              <>
                <TextInput
                  label="Minimum score (%)"
                  type="number"
                  value={String(rule.minScorePercent || '')}
                  onChange={(event) => {
                    const val = event.target.value;
                    const parsed = val === '' ? 0 : Number(val);
                    if (!Number.isNaN(parsed)) {
                      changeRule({ ...rule, minScorePercent: parsed });
                    }
                  }}
                />
                <Select
                  label="Mission (optional)"
                  value={rule.missionId ?? ''}
                  options={missionOptions}
                  onChange={(value) =>
                    changeRule(
                      value === ''
                        ? { type: 'score_threshold', minScorePercent: rule.minScorePercent }
                        : { ...rule, missionId: value as unknown as MissionId },
                    )
                  }
                />
              </>
            )}
            {rule.type === 'streak' && (
              <TextInput
                label="Streak length"
                type="number"
                value={String(rule.length || '')}
                onChange={(event) => {
                  const val = event.target.value;
                  const parsed = val === '' ? 0 : Number(val);
                  if (!Number.isNaN(parsed)) changeRule({ ...rule, length: parsed });
                }}
              />
            )}
            {rule.type === 'percent_complete' && (
              <TextInput
                label="Minimum percent"
                type="number"
                value={String(rule.minPercent || '')}
                onChange={(event) => {
                  const val = event.target.value;
                  const parsed = val === '' ? 0 : Number(val);
                  if (!Number.isNaN(parsed)) {
                    changeRule({ ...rule, minPercent: parsed });
                  }
                }}
              />
            )}
          </div>
        )}
      </div>

      <EditorFooter
        status={editor.status}
        enabled={editor.enabled}
        dirty={editor.dirty}
        saving={editor.saving}
        saveError={editor.saveError}
        onCancel={() => void router.push('/badges')}
        onSave={() => {
          if (doc?.kind === 'badge') {
            updateAward(doc);
          }
          void editor.saveDraft();
        }}
        onToggleEnabled={(enabled) => void adminApi.setEnabled('award', id, enabled).then(() => revalidateAll())}
        onPublish={() =>
          void (async () => {
            if (doc?.kind === 'badge') {
              updateAward(doc);
            }
            if (editor.dirty && !(await editor.saveDraft())) return;
            setPublishOpen(true);
          })()
        }
        onUnpublish={() => setUnpublishOpen(true)}
      />

      {publishOpen && editor.revision !== undefined && (
        <PublishGateDialog
          open
          entityType="award"
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
          title="Unpublish this award?"
          description="It is removed from the learner badge collection until published again."
          confirmLabel="Unpublish"
          onConfirm={() =>
            void adminApi.unpublish('award', id).then(() => {
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
