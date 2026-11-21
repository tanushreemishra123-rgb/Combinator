vi.mock('../export', () => ({ toWorkspaceJson: vi.fn(() => '{"mock":"workspace"}') }));

import type { AiSettings } from '../ai';
import { saveAiSettings } from '../ai';
import { toWorkspaceJson } from '../export';
import { fixtureSession } from '../test/fixtures';
import {
  exportWorkspaceFile,
  importWorkspaceFile,
  loadSessions,
  saveSessions,
  WORKSPACE_STORAGE_KEY,
} from './persistence';

const NOW = '2026-09-19T02:00:00.000Z';

/**
 * Swaps `globalThis.localStorage` for a broken stand-in for the duration of `run`, then restores
 * the original descriptor. Spying on `localStorage`'s own `getItem`/`setItem` does not reliably
 * survive `vi.restoreAllMocks()` across tests in this environment, so a full swap is used instead.
 */
function withBrokenLocalStorage<T>(stub: { getItem?: Storage['getItem']; setItem?: Storage['setItem'] }, run: () => T): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true });
  try {
    return run();
  } finally {
    if (original !== undefined) {
      Object.defineProperty(globalThis, 'localStorage', original);
    }
  }
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function validRawSession(id: string): Record<string, unknown> {
  return {
    id,
    name: `Session ${id}`,
    createdAt: NOW,
    updatedAt: NOW,
    customer: {},
    input: { rawText: 'Some requirements.' },
    scope: null,
    config: {},
    estimationConfig: {
      currency: 'USD',
      contingencyPct: 15,
      productivityFactor: 1,
      workingDaysPerWeek: 5,
      teamSize: 6,
      roundingUnit: 1000,
      baselineEnvironments: 3,
      extraEnvironmentPct: 5,
      rates: [],
      baseEffort: [],
      phaseOverheads: [],
      roleMix: [],
      confidenceSpreads: [],
    },
    outputs: { prd: {}, architecture: {}, dataIntegration: {}, aiStrategy: {}, estimate: {} },
  };
}

describe('loadSessions', () => {
  it('returns an empty workspace when nothing is stored', () => {
    expect(loadSessions(NOW)).toEqual({ sessions: [], issues: [] });
  });

  it('loads every valid session and reports an issue for each invalid one', () => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify([validRawSession('a'), { not: 'a session' }]));
    const result = loadSessions(NOW);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions.at(0)?.id).toBe('a');
    expect(result.issues).toHaveLength(1);
  });

  it('resets to an empty workspace instead of throwing on corrupt JSON', () => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, '{not valid json');
    const result = loadSessions(NOW);
    expect(result.sessions).toEqual([]);
    expect(result.issues).toHaveLength(1);
  });

  it('resets to an empty workspace when the stored payload is not an array', () => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    const result = loadSessions(NOW);
    expect(result.sessions).toEqual([]);
    expect(result.issues).toHaveLength(1);
  });

  it('reports an issue instead of throwing when storage is unavailable', () => {
    const result = withBrokenLocalStorage(
      {
        getItem: () => {
          throw new Error('storage disabled');
        },
      },
      () => loadSessions(NOW),
    );
    expect(result.sessions).toEqual([]);
    expect(result.issues).toHaveLength(1);
  });
});

describe('saveSessions', () => {
  it('writes the sessions and reports success', () => {
    const session = fixtureSession();
    const result = saveSessions([session]);
    expect(result).toEqual({ ok: true, issue: null });
    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '[]')).toHaveLength(1);
  });

  it('reports a friendly issue instead of throwing when storage quota is exceeded', () => {
    const result = withBrokenLocalStorage(
      {
        setItem: () => {
          throw new DOMException('quota exceeded', 'QuotaExceededError');
        },
      },
      () => saveSessions([fixtureSession()]),
    );
    expect(result.ok).toBe(false);
    expect(result.issue).not.toBeNull();
  });

  it('never writes an API key even when AI settings hold one, because sessions do not carry AI settings', () => {
    const sentinelValue = 'connection-value-used-only-by-this-test';
    const settings: AiSettings = { mode: 'live', providerId: 'groq', model: 'llama-3.1-70b', apiKey: sentinelValue };
    saveAiSettings(settings);
    saveSessions([fixtureSession()]);
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain(sentinelValue);
  });
});

describe('exportWorkspaceFile', () => {
  it('delegates to toWorkspaceJson from src/export', () => {
    const session = fixtureSession();
    const text = exportWorkspaceFile(session);
    expect(toWorkspaceJson).toHaveBeenCalledWith(session);
    expect(text).toBe('{"mock":"workspace"}');
  });
});

describe('importWorkspaceFile', () => {
  it('assigns a fresh id to a validly imported session', () => {
    const raw = validRawSession('original-id');
    const result = importWorkspaceFile(JSON.stringify(raw), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.id).not.toBe('original-id');
    expect(result.session.name).toBe('Session original-id');
  });

  it('reports an error for text that is not valid JSON', () => {
    const result = importWorkspaceFile('not json at all', NOW);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toEqual(['The file is not valid JSON.']);
  });

  it('reports user-friendly problems for JSON that does not match the session shape', () => {
    const result = importWorkspaceFile(JSON.stringify({ nope: true }), NOW);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
