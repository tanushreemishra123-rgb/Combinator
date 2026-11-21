import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { LEVEL_TRACK_LABELS } from '@ai-learning-adventure/learner';
import { useAppNavigation } from '../hooks/useAppNavigation.ts';
import { useAppSelector } from '../store/index.ts';
import { selectMissionDisplay } from '../store/preferencesSlice.ts';
import { useGlobalProgress } from '../features/progress/hooks/useGlobalProgress.ts';
import type { LearnerView } from '../store/navigationSlice.ts';

export interface GlobalHeaderProps {
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

function screenTitle(view: LearnerView, catalog: CatalogDto): string {
  switch (view.kind) {
    case 'home':
      return 'AI Learning Adventure';
    case 'missions':
      return 'Choose a mission';
    case 'mission':
      return catalog.missions.find((mission) => mission.id === view.missionId)?.title ?? 'Mission';
    case 'quiz':
      return 'Quiz';
    case 'flashcards':
      return 'Flashcards';
    case 'review':
      return 'Review';
    case 'progress':
      return 'Progress';
    case 'ai-only':
      return 'AI Only Mode';
    case 'settings':
      return 'Settings';
  }
}

export function GlobalHeader({ catalog, progress }: GlobalHeaderProps) {
  const { view, navigate } = useAppNavigation();
  const missionDisplay = useAppSelector(selectMissionDisplay);
  const { completionPercent, completedLabel, currentLevel, badgeCount } = useGlobalProgress(
    catalog,
    progress,
  );
  const isHome = view.kind === 'home';

  return (
    <header className="app-shell__header global-header">
      <div className="global-header__identity">
        <span className={`global-header__title${isHome ? ' global-header__title--home' : ''}`}>
          {screenTitle(view, catalog)}
        </span>
      </div>
      <div className="global-header__cluster">
        <div
          className="global-progress"
          role="progressbar"
          aria-valuenow={completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={completedLabel}
          title={completedLabel}
        >
          <div className="global-progress__track">
            <div
              className="global-progress__fill"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="global-progress__percent" aria-hidden="true">
            {completionPercent}%
          </span>
        </div>
        <span className="global-header__level" title="Current level track">
          {LEVEL_TRACK_LABELS[currentLevel] /* nosemgrep: gitlab.eslint.detect-object-injection */}
        </span>
        <button
          type="button"
          className="global-header__badges"
          aria-label={`Badges earned: ${badgeCount}. Open the progress dashboard.`}
          onClick={() => navigate({ kind: 'progress' })}
        >
          <span aria-hidden="true">★</span> {badgeCount}
        </button>
        <button
          id="global-missions"
          type="button"
          className="global-header__missions"
          aria-label="Explore missions"
          aria-current={view.kind === 'missions' ? 'page' : undefined}
          title="Explore missions"
          onClick={() => navigate({ kind: 'missions', display: missionDisplay })}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          <span className="global-header__missions-label">Missions</span>
        </button>
        <button
          id="global-ai-only"
          type="button"
          className="global-header__ai-only"
          aria-label="AI Only Mode"
          aria-current={view.kind === 'ai-only' ? 'page' : undefined}
          title="AI Only Mode"
          onClick={() => navigate({ kind: 'ai-only' })}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M12 2.5 14.2 9.8 21.5 12l-7.3 2.2L12 21.5 9.8 14.2 2.5 12l7.3-2.2L12 2.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          <span className="global-header__ai-only-label">AI Only</span>
        </button>
        {isHome && (
          <button
            id="global-settings"
            type="button"
            className="global-header__settings"
            aria-label="Settings"
            onClick={() => navigate({ kind: 'settings' })}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Zm8 3.7-2.1-1.2.1-1.3-2.1-2.1-1.3.1L13.4 5h-2.8L9.4 7.5l-1.3-.1L6 9.5l.1 1.3L4 12l2.1 1.2-.1 1.3 2.1 2.1 1.3-.1 1.2 2.5h2.8l1.2-2.5 1.3.1 2.1-2.1-.1-1.3L20 12Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span className="global-header__settings-label">Settings</span>
          </button>
        )}
      </div>
    </header>
  );
}
