import type { MissionSummary } from '@ai-learning-adventure/types';
import { MISSION_STATUS_LABELS } from '@ai-learning-adventure/learner';
import type { DashboardMissionRow } from '../hooks/useProgressDashboard.ts';

export interface MissionProgressListProps {
  rows: DashboardMissionRow[];
  onOpenMission: (mission: MissionSummary) => void;
}

export function MissionProgressList({ rows, onOpenMission }: MissionProgressListProps) {
  return (
    <section className="mission-progress-list" aria-label="Mission progress">
      <h2 className="progress-panel__heading">Mission progress</h2>
      <table className="mission-progress-list__table">
        <thead>
          <tr>
            <th scope="col">Mission</th>
            <th scope="col">Status</th>
            <th scope="col">Best score</th>
            <th scope="col">Latest score</th>
            <th scope="col">Badge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.mission.id as string}
              className="mission-progress-list__row"
              onClick={() => onOpenMission(row.mission)}
            >
              <td>
                <button
                  type="button"
                  className="mission-progress-list__title"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenMission(row.mission);
                  }}
                >
                  {row.mission.title}
                </button>
              </td>
              <td>
                <span className={`mission-progress-list__status mission-progress-list__status--${row.status}`}>
                  {MISSION_STATUS_LABELS[row.status] /* nosemgrep: gitlab.eslint.detect-object-injection */}
                </span>
              </td>
              <td>{row.bestScore !== undefined ? `${row.bestScore}%` : '—'}</td>
              <td>{row.latestScore !== undefined ? `${row.latestScore}%` : '—'}</td>
              <td>
                {row.earnedBadge !== undefined ? (
                  <span className="mission-progress-list__badge" title={row.earnedBadge.name}>
                    <span aria-hidden="true">★</span> {row.earnedBadge.name}
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
