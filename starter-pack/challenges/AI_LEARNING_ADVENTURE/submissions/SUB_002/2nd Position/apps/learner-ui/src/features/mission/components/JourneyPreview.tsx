import type { LevelTrack } from '@ai-learning-adventure/types';
import { LEVEL_TRACK_LABELS } from '@ai-learning-adventure/learner';

export interface JourneyPreviewProps {
  tracks: LevelTrack[];
  missionCountByTrack: Record<string, number>;
}

export function JourneyPreview({ tracks, missionCountByTrack }: JourneyPreviewProps) {
  return (
    <section className="journey-preview" aria-label="Journey preview">
      <h2 className="journey-preview__title">Your journey path</h2>
      <ol className="journey-preview__strip">
        {tracks.map((track, index) => (
          <li key={track} className={`journey-preview__stop journey-preview__stop--${track}`}>
            <span className="journey-preview__dot" aria-hidden="true">
              {index + 1}
            </span>
            <span className="journey-preview__track">{LEVEL_TRACK_LABELS[track] /* nosemgrep: gitlab.eslint.detect-object-injection */}</span>
            <span className="journey-preview__count">
              {missionCountByTrack[track] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? 0} mission{(missionCountByTrack[track] ?? 0) === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
