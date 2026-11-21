import { useEffect, useMemo, useState } from 'react';
import type { PreviewPayloadDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { useAppDispatch } from '../store/index.ts';
import { replaceView } from '../store/navigationSlice.ts';
import { AppShell } from '../app/AppShell.tsx';
import { AiProviderRuntimeProvider } from '../features/ai-provider/AiProviderRuntime.tsx';
import {
  getPreviewCatalog,
  getPreviewSnapshot,
  getPreviewToken,
  initPreviewMode,
  setPreviewPayload,
} from './previewMode.ts';

const PREVIEW_LEARNER_ID = 'preview-learner';

function resolvePreviewBaseUrl(): string {
  const meta = import.meta as ImportMeta & { env?: Readonly<Record<string, string | undefined>> };
  const configured = meta.env?.VITE_API_BASE_URL;
  if (configured === undefined || configured.length === 0) return '/api/v1';
  return configured.endsWith('/') ? configured.slice(0, -1) : configured;
}

export interface PreviewBootstrapProps {
  token: string;
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export function PreviewBootstrap({ token }: PreviewBootstrapProps) {
  const dispatch = useAppDispatch();
  const [state, setState] = useState<PreviewState>({ status: 'loading' });

  useEffect(() => {
    initPreviewMode(token);
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${resolvePreviewBaseUrl()}/preview/${encodeURIComponent(token)}`, {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => undefined)) as
            | { error?: { message?: string } }
            | undefined;
          throw new Error(body?.error?.message ?? `Preview request failed with status ${response.status}.`);
        }
        const wrapped = (await response.json()) as { data: PreviewPayloadDto };
        if (cancelled) return;
        setPreviewPayload(wrapped.data, PREVIEW_LEARNER_ID);
        const mission = wrapped.data.mission;
        dispatch(replaceView({ kind: 'mission', missionId: mission.id, step: 'lesson' }));
        setState({ status: 'ready' });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to load the preview.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, dispatch]);

  const catalog = useMemo(() => getPreviewCatalog(), [state]);
  const progress = useMemo(() => getPreviewSnapshot(), [state]);

  if (state.status === 'error') {
    return (
      <div className="app-status" role="alert">
        <h1>Preview unavailable</h1>
        <p>{state.message}</p>
      </div>
    );
  }

  if (state.status !== 'ready' || catalog === undefined || progress === undefined) {
    return (
      <div className="app-status" role="status">
        <p>Loading preview…</p>
      </div>
    );
  }

  return (
    <AiProviderRuntimeProvider>
      <PreviewBanner />
      <AppShell learnerId={PREVIEW_LEARNER_ID} catalog={catalog} progress={progress} />
    </AiProviderRuntimeProvider>
  );
}

function PreviewBanner() {
  return (
    <div role="status" style={{
      background: '#6d28d9',
      color: '#ffffff',
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
      textAlign: 'center',
    }}>
      Preview — draft content. Progress is not saved.
    </div>
  );
}

export function readPreviewToken(): string | undefined {
  return getPreviewToken();
}
