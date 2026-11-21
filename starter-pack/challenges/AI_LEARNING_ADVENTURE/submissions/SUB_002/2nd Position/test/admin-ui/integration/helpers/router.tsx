import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type RouteInput = string | { pathname?: string; query?: Record<string, string | string[] | undefined> };

export interface TestRouter {
  pathname: string;
  route: string;
  asPath: string;
  query: Record<string, string | string[]>;
  isReady: true;
  push: (href: RouteInput) => Promise<boolean>;
  replace: (href: RouteInput) => Promise<boolean>;
  back: () => void;
  prefetch: () => Promise<void>;
}

const RouterContext = createContext<TestRouter | undefined>(undefined);

function pathOf(input: RouteInput): string {
  if (typeof input === 'string') return input;
  const pathname = input.pathname ?? '/';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

function queryOf(asPath: string): Record<string, string | string[]> {
  const url = new URL(asPath, 'http://admin.integration');
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0]! : values; {/* nosemgrep: gitlab.eslint.detect-object-injection */}
  }
  const match = url.pathname.match(/^\/(?:missions|questions|flashcards|badges)\/([^/]+)$/);
  if (match?.[1] !== undefined) query.id = decodeURIComponent(match[1]);
  return query;
}

export function TestRouterProvider({
  initialPath,
  onNavigate,
  children,
}: {
  initialPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}) {
  const [entries, setEntries] = useState([initialPath]);
  const [index, setIndex] = useState(0);
  const asPath = entries[index] ?? initialPath; {/* nosemgrep: gitlab.eslint.detect-object-injection */}
  const pathname = new URL(asPath, 'http://admin.integration').pathname;

  const push = useCallback(
    async (input: RouteInput) => {
      const next = pathOf(input);
      setEntries((current) => [...current.slice(0, index + 1), next]);
      setIndex((current) => current + 1);
      onNavigate(next);
      return true;
    },
    [index, onNavigate],
  );

  const replace = useCallback(
    async (input: RouteInput) => {
      const next = pathOf(input);
      setEntries((current) => current.map((entry, entryIndex) => (entryIndex === index ? next : entry)));
      onNavigate(next);
      return true;
    },
    [index, onNavigate],
  );

  const back = useCallback(() => {
    setIndex((current) => {
      const next = Math.max(0, current - 1);
      onNavigate(entries[next] ?? initialPath);
      return next;
    });
  }, [entries, initialPath, onNavigate]);

  const router = useMemo<TestRouter>(
    () => ({
      pathname,
      route: pathname,
      asPath,
      query: queryOf(asPath),
      isReady: true,
      push,
      replace,
      back,
      prefetch: async () => undefined,
    }),
    [pathname, asPath, push, replace, back],
  );

  return <RouterContext.Provider value={router}>{children}</RouterContext.Provider>;
}

export function useTestRouter(): TestRouter {
  const router = useContext(RouterContext);
  if (router === undefined) throw new Error('useRouter must be used inside the admin integration router.');
  return router;
}
