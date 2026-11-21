/**
 * Connects the shell's hash router (`useHashRoute`) to the cross-workspace navigation contract in
 * `src/ui/navigation` (`NavigationContext`). Workspaces call `navigate(workspaceId, focusId?)` and
 * never touch the router directly - this provider is the one place that turns that call into a URL
 * change and remembers which element the target workspace should reveal, until it is cleared.
 *
 * It also resets the window scroll position on every genuine workspace switch, so the next
 * workspace always opens at the top instead of keeping the previous one's scroll offset - unless a
 * `focusId` came along for the ride, in which case the target workspace scrolls that element into
 * view itself and this provider stays out of the way.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useHashRoute } from '../ui/shell';
import { isWorkspaceId, NavigationContext, WORKSPACE_IDS } from '../ui/navigation';
import type { WorkspaceId, WorkspaceNavigation } from '../ui/navigation';

export interface NavigationProviderProps {
  children: ReactNode;
}

const FALLBACK_WORKSPACE: WorkspaceId = WORKSPACE_IDS[0];

export function NavigationProvider({ children }: NavigationProviderProps): ReactElement {
  const hashRoute = useHashRoute(WORKSPACE_IDS, FALLBACK_WORKSPACE);
  const [focusId, setFocusId] = useState<string | null>(null);
  const routeNavigate = hashRoute.navigate;

  const activeWorkspace: WorkspaceId = isWorkspaceId(hashRoute.activeId) ? hashRoute.activeId : FALLBACK_WORKSPACE;

  const navigate = useCallback(
    (workspace: WorkspaceId, nextFocusId?: string) => {
      routeNavigate(workspace);
      setFocusId(nextFocusId ?? null);
    },
    [routeNavigate],
  );

  const previousWorkspace = useRef(activeWorkspace);
  useEffect(() => {
    if (previousWorkspace.current === activeWorkspace) {
      return;
    }
    previousWorkspace.current = activeWorkspace;
    if (focusId === null) {
      window.scrollTo(0, 0);
    }
  }, [activeWorkspace, focusId]);

  const clearFocus = useCallback(() => setFocusId(null), []);

  const value = useMemo<WorkspaceNavigation>(
    () => ({ activeWorkspace, focusId, navigate, clearFocus }),
    [activeWorkspace, focusId, navigate, clearFocus],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
