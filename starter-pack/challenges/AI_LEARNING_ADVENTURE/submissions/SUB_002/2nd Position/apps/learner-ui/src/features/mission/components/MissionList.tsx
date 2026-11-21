import {
  DIFFICULTY_LABELS,
  LEVEL_TRACK_LABELS,
  MISSION_STATUS_LABELS,
  missionActionLabel,
  type MissionBrowserItem,
  type MissionSort,
} from '@ai-learning-adventure/learner';

export interface MissionListProps {
  items: MissionBrowserItem[];
  sort: MissionSort;
  hasActiveFilters: boolean;
  onOpen: (item: MissionBrowserItem) => void;
  onClearFilters: () => void;
}

interface SortableHeader {
  label: string;
  sortKey?: MissionSort;
}

const HEADERS: SortableHeader[] = [
  { label: '#' },
  { label: 'Title', sortKey: 'title' },
  { label: 'Track', sortKey: 'track_order' },
  { label: 'Difficulty', sortKey: 'difficulty' },
  { label: 'Status', sortKey: 'progress' },
  { label: 'Best score' },
  { label: 'Badge' },
  { label: 'Action' },
];

export function MissionList({ items, sort, hasActiveFilters, onOpen, onClearFilters }: MissionListProps) {
  if (items.length === 0) {
    return (
      <div className="mission-list__empty">
        <p>No missions match your filters.</p>
        {hasActiveFilters && (
          <button type="button" className="button button--secondary" onClick={onClearFilters}>
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <table className="mission-list">
      <caption className="visually-hidden">Missions with status and best scores</caption>
      <thead>
        <tr>
          {HEADERS.map((header) => (
            <th
              key={header.label}
              scope="col"
              aria-sort={
                header.sortKey !== undefined && header.sortKey === sort
                  ? 'ascending'
                  : undefined
              }
            >
              {header.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const { mission, state } = item;
          const locked = state === 'locked';
          return (
            <tr key={mission.id} className={`mission-list__row mission-list__row--${state}`}>
              <td data-label="#">{item.index + 1}</td>
              <td data-label="Title">
                <span className="mission-list__title">{mission.title}</span>
                <span className="mission-list__objective">{mission.objective}</span>
              </td>
              <td data-label="Track">{LEVEL_TRACK_LABELS[mission.levelTrack] /* nosemgrep: gitlab.eslint.detect-object-injection */}</td>
              <td data-label="Difficulty">{DIFFICULTY_LABELS[mission.difficulty] /* nosemgrep: gitlab.eslint.detect-object-injection */}</td>
              <td data-label="Status">
                <span className={`mission-status mission-status--${state}`}>
                  {MISSION_STATUS_LABELS[item.status] /* nosemgrep: gitlab.eslint.detect-object-injection */}
                </span>
              </td>
              <td data-label="Best score">
                {item.bestScore !== undefined ? `${item.bestScore}%` : '—'}
              </td>
              <td data-label="Badge">
                {item.earnedBadgeCount > 0 ? (
                  <span className="mission-list__badge" aria-label="Badge earned">
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <circle cx="8" cy="6" r="4.2" fill="currentColor" />
                      <path d="M5.8 9.4 5 14l3-1.6L11 14l-.8-4.6" fill="currentColor" />
                    </svg>
                  </span>
                ) : (
                  <span aria-hidden="true">—</span>
                )}
              </td>
              <td data-label="Action">
                <button
                  type="button"
                  className={`button button--small ${locked ? 'button--ghost' : 'button--secondary'}`}
                  disabled={locked}
                  title={
                    locked && item.prerequisite !== undefined
                      ? `Complete "${item.prerequisite.title}" first`
                      : undefined
                  }
                  onClick={() => onOpen(item)}
                >
                  {missionActionLabel(state)}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
