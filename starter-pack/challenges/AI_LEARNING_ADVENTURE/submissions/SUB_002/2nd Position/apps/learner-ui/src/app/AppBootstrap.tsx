import { useMemo } from 'react';
import { useBootstrapData } from '../hooks/useBootstrapData.ts';
import { AppShell } from './AppShell.tsx';
import { AiProviderRuntimeProvider } from '../features/ai-provider/AiProviderRuntime.tsx';
import { PreviewBootstrap } from '../preview/PreviewBootstrap.tsx';
import { readPreviewTokenFromLocation } from '../preview/previewMode.ts';

const LEARNER_ID_STORAGE_KEY = 'learner-ui.learner-id.v1';
const LEARNER_ID_STORAGE_VERSION = 1;

interface PersistedLearnerId {
  version: number;
  learnerId: string;
}

function readStoredLearnerId(): string | undefined {
  try {
    const raw = localStorage.getItem(LEARNER_ID_STORAGE_KEY);
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw) as Partial<PersistedLearnerId> | null;
    if (
      parsed === null ||
      parsed.version !== LEARNER_ID_STORAGE_VERSION ||
      typeof parsed.learnerId !== 'string' ||
      parsed.learnerId.length === 0
    ) {
      return undefined;
    }
    return parsed.learnerId;
  } catch {
    return undefined;
  }
}

function writeStoredLearnerId(learnerId: string): void {
  try {
    const persisted: PersistedLearnerId = {
      version: LEARNER_ID_STORAGE_VERSION,
      learnerId,
    };
    localStorage.setItem(LEARNER_ID_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    return;
  }
}

function getOrCreateLearnerId(): string {
  const existing = readStoredLearnerId();
  if (existing !== undefined) return existing;
  const created = crypto.randomUUID();
  writeStoredLearnerId(created);
  return created;
}

export function AppBootstrap() {
  const previewToken = useMemo(readPreviewTokenFromLocation, []);
  const learnerId = useMemo(getOrCreateLearnerId, []);
  const { catalog, progress, isReady, error, retry } = useBootstrapData(
    previewToken === undefined ? learnerId : undefined,
  );

  if (previewToken !== undefined) {
    return <PreviewBootstrap token={previewToken} />;
  }

  if (error !== undefined) {
    return (
      <div className="app-status" role="alert">
        <h1>Something went wrong</h1>
        <p>{error.message}</p>
        <button type="button" className="app-status__retry" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  if (!isReady || catalog === undefined || progress === undefined) {
    return (
      <div className="app-status" role="status">
        <p>Loading your learning adventure…</p>
      </div>
    );
  }

  return (
    <AiProviderRuntimeProvider>
      <AppShell learnerId={learnerId} catalog={catalog} progress={progress} />
    </AiProviderRuntimeProvider>
  );
}
