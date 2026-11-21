import { act, renderHook } from '@testing-library/react';
import { useHashRoute } from './useHashRoute';
import { WORKSPACE_IDS } from './workspaces';

function setHash(hash: string): void {
  window.history.replaceState(null, '', hash.length > 0 ? hash : window.location.pathname);
}

describe('useHashRoute', () => {
  afterEach(() => {
    setHash('');
  });

  it('falls back to the first known id when the hash is empty', () => {
    setHash('');
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.activeId).toBe(WORKSPACE_IDS.at(0));
  });

  it('falls back to the first known id when the hash names an unknown route', () => {
    setHash('#/not-a-real-workspace');
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.activeId).toBe(WORKSPACE_IDS.at(0));
  });

  it('reads a valid hash on mount', () => {
    setHash('#/architecture');
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.activeId).toBe('architecture');
  });

  it('accepts a caller-supplied id list and fallback', () => {
    setHash('#/unknown');
    const { result } = renderHook(() => useHashRoute(['alpha', 'beta'], 'beta'));
    expect(result.current.activeId).toBe('beta');
  });

  it('updates activeId when navigate() changes the hash', () => {
    setHash('#/requirements');
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.activeId).toBe('requirements');

    act(() => {
      result.current.navigate('estimate');
    });

    expect(result.current.activeId).toBe('estimate');
    expect(window.location.hash).toBe('#/estimate');
  });

  it('updates activeId when the hash changes externally (browser back/forward)', () => {
    setHash('#/requirements');
    const { result } = renderHook(() => useHashRoute());

    // Simulate what a real browser does on back/forward: the hash changes and a 'hashchange'
    // event fires (jsdom/happy-dom do not dispatch this automatically on a plain assignment).
    act(() => {
      window.location.hash = '#/prd';
      window.dispatchEvent(new Event('hashchange'));
    });

    expect(result.current.activeId).toBe('prd');
  });
});
