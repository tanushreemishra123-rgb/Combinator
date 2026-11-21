/**
 * Behaviour tests for the bridge between the shell's hash router and the cross-workspace
 * navigation contract: navigate() must update both the active workspace and the URL hash, and the
 * focus id (e.g. a requirement chip's target) must be remembered until cleared or replaced.
 */
import { act, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { useWorkspaceNavigation } from '../ui/navigation';
import { NavigationProvider } from './NavigationProvider';

function wrapper({ children }: { children: ReactNode }): ReactElement {
  return <NavigationProvider>{children}</NavigationProvider>;
}

function resetHash(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

describe('NavigationProvider', () => {
  afterEach(resetHash);

  it('defaults to the first workspace and no focus id when the hash is empty', () => {
    resetHash();
    const { result } = renderHook(() => useWorkspaceNavigation(), { wrapper });
    expect(result.current.activeWorkspace).toBe('requirements');
    expect(result.current.focusId).toBeNull();
  });

  it('falls back to the first workspace for an unknown hash route', () => {
    window.history.replaceState(null, '', '#/not-a-real-workspace');
    const { result } = renderHook(() => useWorkspaceNavigation(), { wrapper });
    expect(result.current.activeWorkspace).toBe('requirements');
  });

  it('reads the workspace named by the current hash', () => {
    window.history.replaceState(null, '', '#/architecture');
    const { result } = renderHook(() => useWorkspaceNavigation(), { wrapper });
    expect(result.current.activeWorkspace).toBe('architecture');
  });

  it('navigate() updates both the active workspace and the URL hash', () => {
    resetHash();
    const { result } = renderHook(() => useWorkspaceNavigation(), { wrapper });

    act(() => {
      result.current.navigate('estimate');
    });

    expect(result.current.activeWorkspace).toBe('estimate');
    expect(window.location.hash).toBe('#/estimate');
    expect(result.current.focusId).toBeNull();
  });

  it('navigate() with a focus id remembers it until clearFocus() is called', () => {
    const { result } = renderHook(() => useWorkspaceNavigation(), { wrapper });

    act(() => {
      result.current.navigate('prd', 'FR_01');
    });
    expect(result.current.activeWorkspace).toBe('prd');
    expect(result.current.focusId).toBe('FR_01');

    act(() => {
      result.current.clearFocus();
    });
    expect(result.current.focusId).toBeNull();
  });

  it('navigating again without a focus id clears the previous one', () => {
    const { result } = renderHook(() => useWorkspaceNavigation(), { wrapper });

    act(() => {
      result.current.navigate('prd', 'FR_01');
    });
    act(() => {
      result.current.navigate('architecture');
    });

    expect(result.current.activeWorkspace).toBe('architecture');
    expect(result.current.focusId).toBeNull();
  });
});

describe('NavigationProvider - scroll reset on workspace change', () => {
  afterEach(resetHash);

  it('scrolls the window to the top when navigating to another workspace without a focus id', () => {
    resetHash();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { result } = renderHook(() => useWorkspaceNavigation(), { wrapper });

    act(() => {
      result.current.navigate('estimate');
    });

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  it('does not scroll to the top when the navigation carries a focus id', () => {
    resetHash();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { result } = renderHook(() => useWorkspaceNavigation(), { wrapper });

    act(() => {
      result.current.navigate('prd', 'FR_01');
    });

    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });

  it('does not scroll to the top when the workspace stays the same (only the focus id changes)', () => {
    resetHash();
    const { result } = renderHook(() => useWorkspaceNavigation(), { wrapper });

    act(() => {
      result.current.navigate('requirements', 'FR_01');
    });

    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    act(() => {
      result.current.clearFocus();
    });

    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });

  it('does not scroll to the top on initial mount', () => {
    resetHash();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderHook(() => useWorkspaceNavigation(), { wrapper });

    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
