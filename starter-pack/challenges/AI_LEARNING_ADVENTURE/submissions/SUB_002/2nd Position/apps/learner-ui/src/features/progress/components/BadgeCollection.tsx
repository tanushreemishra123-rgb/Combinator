import type { CatalogDto } from '@ai-learning-adventure/types';
import { awardUnlockCondition } from '@ai-learning-adventure/learner';
import type { AwardListItem } from '../hooks/useAwards.ts';

export interface BadgeCollectionProps {
  badges: AwardListItem[];
  catalog: CatalogDto;
}

export function BadgeCollection({ badges, catalog }: BadgeCollectionProps) {
  if (badges.length === 0) {
    return (
      <section className="badge-collection" aria-label="Badge collection">
        <h2 className="progress-panel__heading">Badge collection</h2>
        <p className="badge-collection__empty">Badges appear here as you complete missions.</p>
      </section>
    );
  }

  return (
    <section
      id="badge-collection"
      tabIndex={-1}
      className="badge-collection"
      aria-label="Badge collection"
    >
      <h2 className="progress-panel__heading">Badge collection</h2>
      <ul className="badge-collection__grid">
        {badges.map(({ award, earned, earnedAt }) => {
          if (earned) {
            const missionTitle =
              award.missionId !== undefined
                ? catalog.missions.find((mission) => mission.id === award.missionId)?.title
                : undefined;
            return (
              <li key={award.id as string} className="badge-item badge-item--earned">
                <div className="badge-item__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="32" height="32" focusable="false">
                    <circle cx="12" cy="9" r="6" fill="currentColor" opacity="0.25" />
                    <circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M8.5 14 7 21l5-2.5L17 21l-1.5-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span className="badge-item__name">{award.name}</span>
                <span className="badge-item__meta">
                  Earned {new Date(earnedAt as string).toLocaleDateString()}
                  {missionTitle !== undefined ? ` · ${missionTitle}` : ''}
                </span>
              </li>
            );
          }
          const condition = awardUnlockCondition(award, catalog);
          return (
            <li
              key={award.id as string}
              className="badge-item badge-item--locked"
              tabIndex={0}
              aria-label={`Locked badge: ${award.name}. How to unlock: ${condition}.`}
            >
              <div className="badge-item__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="32" height="32" focusable="false">
                  <circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M8.5 14 7 21l5-2.5L17 21l-1.5-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="badge-item__name">{award.name}</span>
              <span className="badge-item__condition">{condition}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
