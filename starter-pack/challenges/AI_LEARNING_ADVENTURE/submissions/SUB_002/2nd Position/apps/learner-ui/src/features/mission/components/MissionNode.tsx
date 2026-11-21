import {
  DIFFICULTY_LABELS,
  LEVEL_TRACK_LABELS,
  MISSION_STATUS_LABELS,
  missionActionLabel,
  type MissionBrowserItem,
} from '@ai-learning-adventure/learner';

export interface MissionNodeProps {
  item: MissionBrowserItem;
  isDimmed: boolean;
  isTabStop: boolean;
  onOpen: (item: MissionBrowserItem) => void;
  onKeyNavigate: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  registerRef: (element: HTMLButtonElement | null) => void;
}

export function MissionNode({
  item,
  isDimmed,
  isTabStop,
  onOpen,
  onKeyNavigate,
  registerRef,
}: MissionNodeProps) {
  const { mission, state, prerequisite } = item;
  const locked = state === 'locked';
  const stateLabel =
    state === 'locked' && prerequisite !== undefined
      ? `Locked until "${prerequisite.title}" is complete`
      : MISSION_STATUS_LABELS[item.status] /* nosemgrep: gitlab.eslint.detect-object-injection */;

  const ariaLabel = `Mission ${item.index + 1}: ${mission.title}. ${LEVEL_TRACK_LABELS[mission.levelTrack] /* nosemgrep: gitlab.eslint.detect-object-injection */} track, ${DIFFICULTY_LABELS[mission.difficulty]} difficulty. ${stateLabel}.`;

  return (
    <li
      className={[
        'mission-node',
        `mission-node--${state}`,
        isDimmed ? 'mission-node--dimmed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        ref={registerRef}
        id={`mission-node-${mission.id}`}
        className="mission-node__button"
        tabIndex={isTabStop ? 0 : -1}
        aria-disabled={locked || undefined}
        aria-label={ariaLabel}
        data-state={state}
        onClick={() => {
          if (!locked) onOpen(item);
        }}
        onKeyDown={onKeyNavigate}
      >
        <span className="mission-node__ring" aria-hidden="true">
          <span className="mission-node__number">{item.index + 1}</span>
          {state === 'completed' && (
            <svg className="mission-node__check" viewBox="0 0 16 16" focusable="false">
              <path
                d="M3 8.5 6.5 12 13 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {locked && (
            <svg className="mission-node__lock" viewBox="0 0 16 16" focusable="false">
              <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
              <path d="M5 7V5.5a3 3 0 0 1 6 0V7" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          )}
        </span>
        <span className="mission-node__title">{mission.title}</span>
        {item.earnedBadgeCount > 0 && (
          <svg className="mission-node__badge" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="8" cy="6" r="4.2" fill="currentColor" />
            <path d="M5.8 9.4 5 14l3-1.6L11 14l-.8-4.6" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="mission-node__preview" role="presentation">
        <p className="mission-node__preview-title">{mission.title}</p>
        <p className="mission-node__preview-meta">
          {DIFFICULTY_LABELS[mission.difficulty] /* nosemgrep: gitlab.eslint.detect-object-injection */} · {LEVEL_TRACK_LABELS[mission.levelTrack]} ·{' '}
          {MISSION_STATUS_LABELS[item.status] /* nosemgrep: gitlab.eslint.detect-object-injection */}
        </p>
        <p className="mission-node__preview-objective">{mission.objective}</p>
        {locked && prerequisite !== undefined && (
          <p className="mission-node__preview-lock">Complete “{prerequisite.title}” first.</p>
        )}
      </div>
    </li>
  );
}
