import type { AwardDefinition } from '@ai-learning-adventure/types';
import type { MilestoneListItem } from '../hooks/useAwards.ts';

export interface MilestoneListProps {
  milestones: MilestoneListItem[];
}

function progressLabel(award: AwardDefinition, current: number, target: number): string {
  switch (award.rule.type) {
    case 'track_completed':
      return `${current} of ${target} missions`;
    case 'score_threshold':
      return `Best score ${current}% of ${target}%`;
    case 'streak':
      return `${current} of ${target} missions in a row`;
    case 'percent_complete':
      return `${current}% of ${target}% complete`;
    case 'mission_completed':
      return current >= target ? 'Complete' : 'Not complete yet';
  }
}

export function MilestoneList({ milestones }: MilestoneListProps) {
  if (milestones.length === 0) {
    return (
      <section className="milestone-list" aria-label="Milestones">
        <h2 className="progress-panel__heading">Milestones</h2>
        <p className="milestone-list__empty">Milestones appear here as your journey grows.</p>
      </section>
    );
  }

  return (
    <section className="milestone-list" aria-label="Milestones">
      <h2 className="progress-panel__heading">Milestones</h2>
      <ol className="milestone-list__timeline">
        {milestones.map(({ award, earned, earnedAt, progress }) => {
          const percent =
            progress !== undefined && progress.target > 0
              ? Math.min(100, Math.round((progress.current / progress.target) * 100))
              : 0;
          return (
            <li
              key={award.id as string}
              className={`milestone-item ${earned ? 'milestone-item--earned' : 'milestone-item--upcoming'}`}
            >
              <span className="milestone-item__marker" aria-hidden="true" />
              <div className="milestone-item__body">
                <span className="milestone-item__name">{award.name}</span>
                <span className="milestone-item__description">{award.description}</span>
                {earned && earnedAt !== undefined ? (
                  <span className="milestone-item__date">
                    Earned {new Date(earnedAt as string).toLocaleDateString()}
                  </span>
                ) : (
                  progress !== undefined && (
                    <>
                      <div
                        className="milestone-item__bar"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${award.name}: ${progressLabel(award, progress.current, progress.target)}`}
                      >
                        <div className="milestone-item__bar-fill" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="milestone-item__progress-label">
                        {progressLabel(award, progress.current, progress.target)}
                      </span>
                    </>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
