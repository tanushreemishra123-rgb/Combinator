import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminEntityType, AdminLifecycleStatus } from '@ai-learning-adventure/types';
import { AdminApiError, adminApi } from '@/lib/api';
import { useContentItem } from '@/lib/hooks';

export interface EditorDraftState<T> {
  doc: T | undefined;
  revision: number | undefined;
  status: 'draft' | 'published' | 'published_changed' | undefined;
  enabled: boolean | undefined;
  isLoading: boolean;
  loadError: string | undefined;
  dirty: boolean;
  saving: boolean;
  saveError: string | undefined;
  conflict: boolean;
  update: (next: T) => void;
  saveDraft: () => Promise<boolean>;
  reload: () => Promise<unknown>;
}

export function useEditorDraft<T>(type: AdminEntityType, id: string | undefined): EditorDraftState<T> {
  const { item, error, isLoading, refresh } = useContentItem(type, id);
  const [doc, setDoc] = useState<T | undefined>(undefined);
  const [revision, setRevision] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<AdminLifecycleStatus | undefined>(undefined);
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [conflict, setConflict] = useState(false);
  const loadedKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (item === undefined) return;
    setStatus(item.status);
    setEnabled(item.enabled);
    const key = `${item.id}:${item.revision}`;
    if (loadedKey.current === key) return;
    if (dirty) return;
    if (revision !== undefined && item.revision < revision) return;
    loadedKey.current = key;
    setDoc(item.doc as T);
    setRevision(item.revision);
    setConflict(false);
  }, [item, dirty, revision]);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (id === undefined || doc === undefined || revision === undefined) return false;
    setSaving(true);
    setSaveError(undefined);
    try {
      const result = await adminApi.save(type, id, doc, revision, false);
      setRevision(result.revision);
      setStatus(result.status);
      setEnabled(result.enabled);
      loadedKey.current = `${result.id}:${result.revision}`;
      setDirty(false);
      void refresh();
      return true;
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'revision_mismatch') {
        setConflict(true);
        setSaveError('This item was changed elsewhere. Reload to continue editing.');
      } else if (err instanceof AdminApiError && err.code === 'validation_failed') {
        setSaveError('Fix the blocking validation issues before saving.');
      } else {
        setSaveError(err instanceof Error ? err.message : 'Save failed.');
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [type, id, doc, revision, refresh]);

  const update = useCallback((next: T) => {
    setDoc(next);
    setDirty(true);
    setSaveError(undefined);
  }, []);

  return {
    doc,
    revision,
    status: status ?? item?.status,
    enabled: enabled ?? item?.enabled,
    isLoading,
    loadError: error instanceof Error ? error.message : undefined,
    dirty,
    saving,
    saveError,
    conflict,
    update,
    saveDraft,
    reload: refresh,
  };
}
