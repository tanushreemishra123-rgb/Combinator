import { useAppNavigation } from '../hooks/useAppNavigation.ts';

export function ScreenNavigation() {
  const { view, home, back, canGoBack } = useAppNavigation();

  return (
    <nav className="screen-navigation" aria-label="Screen navigation">
      <button
        type="button"
        className="screen-navigation__button"
        aria-label="Home"
        aria-current={view.kind === 'home' ? 'page' : undefined}
        title="Home"
        onClick={home}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 10.8 12 3l9 7.8v9.7h-6v-6h-6v6H3v-9.7Z" />
        </svg>
      </button>
      <button
        type="button"
        className="screen-navigation__button"
        aria-label="Back"
        title="Back"
        disabled={!canGoBack}
        onClick={back}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m10.5 5-7 7 7 7M4 12h16" />
        </svg>
      </button>
    </nav>
  );
}
