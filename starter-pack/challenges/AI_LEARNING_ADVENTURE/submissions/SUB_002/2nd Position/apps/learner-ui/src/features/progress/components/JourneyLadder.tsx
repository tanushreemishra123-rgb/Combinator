import type { LevelTrack } from '@ai-learning-adventure/types';
import type { LevelLadderRow } from '@ai-learning-adventure/learner';

export interface JourneyLadderProps {
  ladder: LevelLadderRow[];
  onContinueTrack: (levelTrack: LevelTrack) => void;
  onInspectTrack: (levelTrack: LevelTrack) => void;
}

const STATE_LABELS: Record<LevelLadderRow['state'], string> = {
  done: 'Done',
  current: 'Current',
  upcoming: 'Upcoming',
};

export function JourneyLadder({ ladder, onContinueTrack, onInspectTrack }: JourneyLadderProps) {
  return (
    <section className="journey-ladder" aria-label="Journey ladder">
      <h2 className="progress-panel__heading">Journey ladder</h2>
      <ol className="journey-ladder__list">
        {ladder.map((row) => (
          <li
            key={row.levelTrack}
            className={`journey-ladder__row journey-ladder__row--${row.state}`}
          >
            <div className="journey-ladder__info">
              <span className="journey-ladder__name">{row.label}</span>
              <span className="journey-ladder__count">
                {row.completedCount} of {row.totalCount} missions
              </span>
            </div>
            <span className={`journey-ladder__state journey-ladder__state--${row.state}`}>
              {STATE_LABELS[row.state] /* nosemgrep: gitlab.eslint.detect-object-injection */}
            </span>
            {row.state === 'current' && (
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => onContinueTrack(row.levelTrack)}
              >
                Continue
              </button>
            )}
            {row.state === 'upcoming' && (
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => onInspectTrack(row.levelTrack)}
              >
                View missions
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
