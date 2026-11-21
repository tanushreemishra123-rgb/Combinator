/**
 * Tiny hash router: reads `#/<id>` from the URL, validates it against a known set of ids (a `Set`,
 * never a dynamic lookup) and falls back to the first id when the hash is missing or unknown.
 * `navigate` updates the hash (and therefore the browser's back/forward history). The raw hash is
 * tracked with `useSyncExternalStore` - never `useState` seeded from a hook parameter - and the
 * active id is *derived* from that snapshot with `useMemo`, not stored as its own piece of state.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { WORKSPACE_IDS } from './workspaces';

export interface HashRoute {
  activeId: string;
  navigate: (id: string) => void;
}

function parseHash(hash: string): string {
  return hash.startsWith('#/') ? hash.slice(2) : hash.replace(/^#/, '');
}

function resolveId(rawHash: string, validIds: ReadonlySet<string>, fallbackId: string): string {
  const parsed = parseHash(rawHash);
  return validIds.has(parsed) ? parsed : fallbackId;
}

/** Listeners registered by every mounted `useHashRoute` instance, so a programmatic `navigate()`
 * can wake them all immediately instead of waiting for the browser's own 'hashchange' event, which
 * some browsers only queue asynchronously. */
const hashListeners = new Set<() => void>();

function notifyHashListeners(): void {
  for (const listener of hashListeners) {
    listener();
  }
}

function subscribeToHash(listener: () => void): () => void {
  hashListeners.add(listener);
  window.addEventListener('hashchange', listener);
  return () => {
    hashListeners.delete(listener);
    window.removeEventListener('hashchange', listener);
  };
}

function getHashSnapshot(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

function getServerHashSnapshot(): string {
  return '';
}

/**
 * @param validIds known route ids to accept; defaults to the six workspace ids.
 * @param fallbackId id used when the current hash is empty or not in `validIds`; defaults to the
 *   first of `validIds`.
 */
export function useHashRoute(
  validIds: readonly string[] = WORKSPACE_IDS,
  fallbackId: string = validIds.at(0) ?? '',
): HashRoute {
  const hash = useSyncExternalStore(subscribeToHash, getHashSnapshot, getServerHashSnapshot);
  const activeId = useMemo(() => resolveId(hash, new Set(validIds), fallbackId), [hash, validIds, fallbackId]);

  useEffect(() => {
    // Normalise an empty/unknown hash to the resolved id so the URL always reflects it. This only
    // ever rewrites the hash to the id already derived above, so it never changes `activeId` itself.
    const normalizedHash = `#/${activeId}`;
    if (normalizedHash !== window.location.hash) {
      window.history.replaceState(null, '', normalizedHash);
    }
  }, [activeId]);

  const navigate = useCallback(
    (id: string) => {
      const nextId = new Set(validIds).has(id) ? id : fallbackId;
      window.location.hash = `#/${nextId}`;
      // Some browsers only queue the 'hashchange' event asynchronously; notifying listeners here
      // too keeps navigation feeling instant instead of waiting a tick for that event to arrive.
      notifyHashListeners();
    },
    [validIds, fallbackId],
  );

  return { activeId, navigate };
}
