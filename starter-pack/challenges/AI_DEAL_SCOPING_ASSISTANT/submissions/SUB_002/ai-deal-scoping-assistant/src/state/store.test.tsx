import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import type { ScopeModel, ScopingSession } from '../domain';
import { aiEnabledScenario } from '../seed';
import { fixtureSession } from '../test/fixtures';
import { WORKSPACE_STORAGE_KEY } from './persistence';
import { AppProvider, useActions, useActiveSession, useAppState, useBusy } from './store';

/** Narrows the active session once so workflow assertions read without optional chaining. */
function requireSession(session: ScopingSession | null): ScopingSession {
  if (session === null) {
    throw new Error('an active session was expected');
  }
  return session;
}

function requireScope(session: ScopingSession | null): ScopeModel {
  const { scope } = requireSession(session);
  if (scope === null) {
    throw new Error('an analysed scope was expected');
  }
  return scope;
}

function renderApp() {
  return renderHook(
    () => ({ state: useAppState(), active: useActiveSession(), busy: useBusy(), actions: useActions() }),
    { wrapper: AppProvider },
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('AppProvider / hooks', () => {
  it('starts empty and hydrates whatever was already saved in this browser', async () => {
    const saved = fixtureSession();
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify([{ ...saved }]));

    const { result } = renderApp();

    await waitFor(() => {
      expect(result.current.state.sessions).toHaveLength(1);
    });
    expect(result.current.state.sessions.at(0)?.id).toBe(saved.id);
    expect(result.current.busy).toBeNull();
    expect(result.current.active).toBeNull();
  });

  it('survives a StrictMode double effect pass on mount instead of wiping storage', () => {
    const saved = fixtureSession();
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify([{ ...saved }]));

    function strictWrapper({ children }: { children: ReactNode }) {
      return (
        <StrictMode>
          <AppProvider>{children}</AppProvider>
        </StrictMode>
      );
    }

    const { result } = renderHook(() => ({ state: useAppState(), active: useActiveSession() }), { wrapper: strictWrapper });

    expect(result.current.state.sessions).toHaveLength(1);
    expect(result.current.state.sessions.at(0)?.id).toBe(saved.id);
    const stored = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
  });

  it('createNewSession adds a session, makes it active, and persists it', async () => {
    const { result } = renderApp();
    await waitFor(() => expect(result.current.state.notices).toBeDefined());

    act(() => {
      result.current.actions.createNewSession('My session');
    });

    await waitFor(() => {
      expect(result.current.state.sessions).toHaveLength(1);
    });
    expect(result.current.active?.name).toBe('My session');
    expect(result.current.state.activeSessionId).toBe(result.current.active?.id);

    await waitFor(() => {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw ?? '[]')).toHaveLength(1);
    });
  });

  it('deleteSession removes the session and clears the active id', async () => {
    const { result } = renderApp();

    act(() => {
      result.current.actions.createNewSession('To delete');
    });
    await waitFor(() => expect(result.current.state.sessions).toHaveLength(1));
    const sessionId = result.current.state.sessions.at(0)?.id ?? '';

    act(() => {
      result.current.actions.deleteSession(sessionId);
    });

    expect(result.current.state.sessions).toHaveLength(0);
    expect(result.current.active).toBeNull();
  });

  it('renameSession updates only the targeted session', async () => {
    const { result } = renderApp();
    act(() => {
      result.current.actions.createNewSession('Original name');
    });
    await waitFor(() => expect(result.current.state.sessions).toHaveLength(1));
    const sessionId = result.current.state.sessions.at(0)?.id ?? '';

    act(() => {
      result.current.actions.renameSession(sessionId, 'Renamed');
    });

    expect(result.current.state.sessions.at(0)?.name).toBe('Renamed');
  });

  it('deleteAllData clears every session and resets AI settings', async () => {
    const { result } = renderApp();
    act(() => {
      result.current.actions.createNewSession('Will be wiped');
    });
    await waitFor(() => expect(result.current.state.sessions).toHaveLength(1));

    act(() => {
      result.current.actions.deleteAllData();
    });

    expect(result.current.state.sessions).toEqual([]);
    expect(result.current.state.aiSettings.mode).toBe('mock');
  });

  it('runConnectionTest reports mock mode cannot be tested, toggling busy around the call', async () => {
    const { result } = renderApp();
    expect(result.current.state.aiSettings.mode).toBe('mock');

    let outcome: { ok: boolean; message: string } | undefined;
    await act(async () => {
      outcome = await result.current.actions.runConnectionTest();
    });

    expect(outcome?.ok).toBe(false);
    expect(result.current.busy).toBeNull();
    expect(result.current.state.notices.some((notice) => notice.title === 'Connection failed')).toBe(true);
  });

  it('importSession assigns a fresh id distinct from the exported one and makes it active', async () => {
    const { result } = renderApp();
    act(() => {
      result.current.actions.createNewSession('Source session');
    });
    await waitFor(() => expect(result.current.state.sessions).toHaveLength(1));
    const originalId = result.current.state.sessions.at(0)?.id ?? '';
    const exported = JSON.stringify(result.current.state.sessions.at(0));

    act(() => {
      result.current.actions.deleteAllData();
    });
    expect(result.current.state.sessions).toEqual([]);

    await act(async () => {
      await result.current.actions.importSession(new File([exported], 'workspace.json', { type: 'application/json' }));
    });

    expect(result.current.state.sessions).toHaveLength(1);
    expect(result.current.state.sessions.at(0)?.id).not.toBe(originalId);
    expect(result.current.active?.id).toBe(result.current.state.sessions.at(0)?.id);
  });

  it('useActions returns the same bound functions across renders that do not change dispatch', async () => {
    const { result, rerender } = renderApp();
    const first = result.current.actions;
    rerender();
    expect(result.current.actions).toBe(first);
  });
});

describe('useActions - the full workflow through the real store', () => {
  it('binds every use case of the BoundUseCases contract', () => {
    const { result } = renderApp();
    const names = [
      'createNewSession', 'createSessionFromScenario', 'renameSession', 'selectSession', 'deleteSession', 'deleteAllData', 'importSession', 'exportWorkspace',
      'setRequirementsText', 'setCustomerContext', 'addUploadedFile', 'runAnalysis',
      'editScopeItem', 'addScopeItem', 'removeScopeItem', 'setItemReview', 'approveAllPending', 'resolveScopeItem', 'reopenScopeItem', 'approveScope',
      'updateSolutionConfig', 'updateEstimationConfig', 'setRoleRate', 'applyCommercialPreset', 'setDriverComplexity',
      'previewChange', 'applyChange', 'generateStage', 'generateAll', 'regenerateStale', 'setStageReviewed',
      'runQuality', 'refreshExecutiveSummary', 'exportPackage', 'updateAiSettings', 'runConnectionTest', 'dismissNotice', 'clearNotices',
    ];
    const bound = new Map(Object.entries(result.current.actions));
    expect(names.filter((name) => typeof bound.get(name) !== 'function')).toEqual([]);
    expect(bound.size).toBe(names.length);
  });

  it('analyses a seed scenario, approves it, generates every deliverable and recalculates after a contingency change', async () => {
    const { result } = renderApp();
    act(() => {
      result.current.actions.createSessionFromScenario(aiEnabledScenario.id);
    });
    await waitFor(() => expect(result.current.active).not.toBeNull());

    await act(async () => {
      await result.current.actions.runAnalysis();
    });
    expect(requireScope(result.current.active).items.length).toBeGreaterThan(5);

    await act(async () => {
      await result.current.actions.approveAllPending();
    });
    act(() => {
      result.current.actions.approveScope();
    });
    const approvedScope = requireScope(result.current.active);
    expect(approvedScope.approvedVersion).toBe(approvedScope.version);

    await act(async () => {
      await result.current.actions.generateAll();
    });
    const { outputs } = requireSession(result.current.active);
    expect([outputs.prd.status, outputs.architecture.status, outputs.dataIntegration.status, outputs.aiStrategy.status, outputs.estimate.status]).toEqual(
      Array.from({ length: 5 }, () => 'current'),
    );

    await act(async () => {
      await result.current.actions.updateEstimationConfig({ contingencyPct: 30 });
    });
    const recalculated = requireSession(result.current.active);
    expect(recalculated.changeLog).toHaveLength(1);
    expect(recalculated.outputs.estimate.status).toBe('current');
    expect(recalculated.outputs.architecture).toBe(outputs.architecture);
    expect(result.current.busy).toBeNull();
    expect(result.current.state.notices.some((notice) => notice.tone === 'error')).toBe(false);
  });
});
