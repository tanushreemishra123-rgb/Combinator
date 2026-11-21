import { useEffect, useState } from 'react';

/**
 * Narrow screens get a single-pane layout with a bottom tab bar rather than the
 * three-column workspace. Driven by matchMedia so the layout swaps on rotation
 * and on window resize, not just at first paint.
 */
const QUERY = '(max-width: 860px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
