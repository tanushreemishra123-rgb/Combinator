import type { LevelTrack } from '@ai-learning-adventure/types';
import { LEVEL_TRACK_LABELS, LEVEL_TRACK_SEQUENCE } from '@ai-learning-adventure/learner';
import type {
  AiOnlyMissionChoice,
  UseAiOnlySessionResult,
} from '../hooks/useAiOnlySession.ts';

export interface AiOnlyScopeRailProps {
  session: Pick<
    UseAiOnlySessionResult,
    'scope' | 'missionChoices' | 'setScope'
  >;
  collapsed?: boolean;
  onCollapse?: () => void;
  onSelect?: () => void;
}

function missionsByTrack(
  missions: AiOnlyMissionChoice[],
  track: LevelTrack,
): AiOnlyMissionChoice[] {
  return missions.filter((mission) => mission.levelTrack === track);
}

export function AiOnlyScopeRail({
  session,
  collapsed = false,
  onCollapse,
  onSelect,
}: AiOnlyScopeRailProps) {
  if (collapsed) {
    return (
      <aside className="ai-only-rail ai-only-rail--collapsed">
        <button
          type="button"
          className="ai-only-rail__expand"
          aria-label="Show missions"
          onClick={onCollapse}
        >
          <span aria-hidden="true">›</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="ai-only-rail" aria-label="Learning content scope">
      <div className="ai-only-rail__header">
        <div>
          <p className="ai-eyebrow">Ground the conversation</p>
          <h2>Mission library</h2>
        </div>
        {onCollapse !== undefined && (
          <button
            type="button"
            className="button button--ghost button--small ai-only-rail__collapse"
            aria-label="Hide missions"
            onClick={onCollapse}
          >
            <span aria-hidden="true">‹</span>
          </button>
        )}
      </div>
      <nav aria-label="AI learning scopes" className="ai-only-rail__nav">
        <button
          type="button"
          className="ai-only-rail__scope"
          aria-current={session.scope.kind === 'general' ? 'page' : undefined}
          onClick={() => {
            session.setScope({ kind: 'general' });
            onSelect?.();
          }}
        >
          <span className="ai-only-rail__scope-mark" aria-hidden="true">✦</span>
          <span><strong>All missions</strong><small>Explore the published collection</small></span>
        </button>

        <p className="ai-only-rail__label">Missions</p>
        {LEVEL_TRACK_SEQUENCE.map((track) => {
          const missions = missionsByTrack(session.missionChoices, track);
          if (missions.length === 0) return null;
          return (
            <div key={track} className="ai-only-rail__group">
              <p>{LEVEL_TRACK_LABELS[track] /* nosemgrep: gitlab.eslint.detect-object-injection */}</p>
              {missions.map((mission) => (
                <button
                  key={mission.id}
                  type="button"
                  className="ai-only-rail__item"
                  disabled={mission.locked}
                  title={
                    mission.locked && mission.prerequisiteTitle !== undefined
                      ? `Complete "${mission.prerequisiteTitle}" first`
                      : undefined
                  }
                  aria-current={
                    session.scope.kind === 'mission' && session.scope.missionId === mission.id
                      ? 'page'
                      : undefined
                  }
                  onClick={() => {
                    session.setScope({ kind: 'mission', missionId: mission.id });
                    onSelect?.();
                  }}
                >
                  {mission.title}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
