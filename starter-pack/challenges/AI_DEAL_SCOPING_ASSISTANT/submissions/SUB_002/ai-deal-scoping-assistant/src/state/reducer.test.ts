import { defaultAiSettings } from '../ai';
import { fixtureSession } from '../test/fixtures';
import { appReducer } from './reducer';
import type { AppState, Notice } from './types';

function baseState(): AppState {
  return { sessions: [], activeSessionId: null, aiSettings: defaultAiSettings(), busy: null, notices: [] };
}

describe('appReducer', () => {
  it('HYDRATE_SESSIONS replaces the session list', () => {
    const session = fixtureSession();
    const next = appReducer(baseState(), { type: 'HYDRATE_SESSIONS', sessions: [session] });
    expect(next.sessions).toEqual([session]);
  });

  it('UPSERT_SESSION appends a session that is not yet in state', () => {
    const session = fixtureSession();
    const next = appReducer(baseState(), { type: 'UPSERT_SESSION', session });
    expect(next.sessions).toEqual([session]);
  });

  it('UPSERT_SESSION replaces an existing session by id without disturbing the others', () => {
    const first = fixtureSession();
    const second = { ...fixtureSession(), id: 'session-two', name: 'Second' };
    const state = { ...baseState(), sessions: [first, second] };
    const updatedFirst = { ...first, name: 'Renamed' };
    const next = appReducer(state, { type: 'UPSERT_SESSION', session: updatedFirst });
    expect(next.sessions).toEqual([updatedFirst, second]);
    expect(next.sessions.at(1)).toBe(second);
  });

  it('REMOVE_SESSION removes the session and clears the active id when it was active', () => {
    const session = fixtureSession();
    const state = { ...baseState(), sessions: [session], activeSessionId: session.id };
    const next = appReducer(state, { type: 'REMOVE_SESSION', sessionId: session.id });
    expect(next.sessions).toEqual([]);
    expect(next.activeSessionId).toBeNull();
  });

  it('REMOVE_SESSION leaves the active id untouched when a different session is removed', () => {
    const active = fixtureSession();
    const other = { ...fixtureSession(), id: 'other' };
    const state = { ...baseState(), sessions: [active, other], activeSessionId: active.id };
    const next = appReducer(state, { type: 'REMOVE_SESSION', sessionId: other.id });
    expect(next.activeSessionId).toBe(active.id);
  });

  it('CLEAR_SESSIONS empties the session list and the active id', () => {
    const session = fixtureSession();
    const state = { ...baseState(), sessions: [session], activeSessionId: session.id };
    const next = appReducer(state, { type: 'CLEAR_SESSIONS' });
    expect(next.sessions).toEqual([]);
    expect(next.activeSessionId).toBeNull();
  });

  it('SET_ACTIVE_SESSION sets the active id, including back to null', () => {
    const withActive = appReducer(baseState(), { type: 'SET_ACTIVE_SESSION', sessionId: 'x' });
    expect(withActive.activeSessionId).toBe('x');
    const cleared = appReducer(withActive, { type: 'SET_ACTIVE_SESSION', sessionId: null });
    expect(cleared.activeSessionId).toBeNull();
  });

  it('HYDRATE_AI_SETTINGS and UPDATE_AI_SETTINGS both replace aiSettings', () => {
    const settings = { mode: 'live' as const, providerId: 'groq' as const, model: 'llama', apiKey: 'x' };
    const hydrated = appReducer(baseState(), { type: 'HYDRATE_AI_SETTINGS', settings });
    expect(hydrated.aiSettings).toEqual(settings);
    const updated = appReducer(hydrated, { type: 'UPDATE_AI_SETTINGS', settings: { ...settings, model: 'other' } });
    expect(updated.aiSettings.model).toBe('other');
  });

  it('START_BUSY sets the busy state and END_BUSY clears it', () => {
    const busy = appReducer(baseState(), { type: 'START_BUSY', label: 'Working...', stageId: 'prd' });
    expect(busy.busy).toEqual({ label: 'Working...', stageId: 'prd' });
    const idle = appReducer(busy, { type: 'END_BUSY' });
    expect(idle.busy).toBeNull();
  });

  it('ADD_NOTICE appends and DISMISS_NOTICE removes only the targeted notice', () => {
    const notice: Notice = { id: 'n1', tone: 'info', title: 'Hello', message: 'World' };
    const other: Notice = { id: 'n2', tone: 'error', title: 'Oops', message: 'Failed' };
    const withOne = appReducer(baseState(), { type: 'ADD_NOTICE', notice });
    const withTwo = appReducer(withOne, { type: 'ADD_NOTICE', notice: other });
    expect(withTwo.notices).toEqual([notice, other]);
    const dismissed = appReducer(withTwo, { type: 'DISMISS_NOTICE', noticeId: 'n1' });
    expect(dismissed.notices).toEqual([other]);
  });

  it('CLEAR_NOTICES empties the notice list', () => {
    const notice: Notice = { id: 'n1', tone: 'info', title: 'Hello', message: 'World' };
    const state = { ...baseState(), notices: [notice] };
    const next = appReducer(state, { type: 'CLEAR_NOTICES' });
    expect(next.notices).toEqual([]);
  });

  it('returns a session list by reference when nothing in it changes', () => {
    const session = fixtureSession();
    const state = { ...baseState(), sessions: [session] };
    const next = appReducer(state, { type: 'SET_ACTIVE_SESSION', sessionId: session.id });
    expect(next.sessions).toBe(state.sessions);
  });
});
