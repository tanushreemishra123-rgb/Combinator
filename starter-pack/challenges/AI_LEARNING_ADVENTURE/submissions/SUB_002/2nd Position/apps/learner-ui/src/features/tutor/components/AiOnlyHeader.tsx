import { useEffect, useState, type ReactNode } from 'react';
import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { LEVEL_TRACK_LABELS } from '@ai-learning-adventure/learner';
import type { UseAiOnlySessionResult } from '../hooks/useAiOnlySession.ts';

export interface AiOnlyHeaderProps {
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
  session: UseAiOnlySessionResult;
  navigation?: ReactNode;
  onOpenScope: () => void;
}

function scopeValue(session: UseAiOnlySessionResult): string {
  if (session.scope.kind === 'mission') return `mission:${session.scope.missionId}`;
  return 'general';
}

export function AiOnlyHeader({ catalog, progress, session, navigation, onOpenScope }: AiOnlyHeaderProps) {
  const [progressOpen, setProgressOpen] = useState(false);
  const completedMissions = catalog.missions.filter(
    (mission) => progress.missions[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.status === 'completed',
  );

  useEffect(() => {
    if (!progressOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProgressOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [progressOpen]);

  return (
    <header className="ai-only-header">
      <div className="ai-only-header__leading">
        {navigation}
        <div className="ai-only-header__identity">
          <span className="ai-only-header__spark" aria-hidden="true">✦</span>
          <div>
            <p className="ai-eyebrow">Conversation-first learning</p>
            <h1>AI Only Mode</h1>
          </div>
        </div>
      </div>
      <div className="ai-only-header__controls">
        <button
          id="ai-only-open-scope"
          type="button"
          className="button button--secondary button--small ai-only-header__mobile-scope"
          onClick={onOpenScope}
        >
          Missions
        </button>
        <label className="ai-only-scope-select">
          <span>Learning scope</span>
          <select
            value={scopeValue(session)}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'general') {
                session.setScope({ kind: 'general' });
                return;
              }
              if (value.startsWith('mission:')) {
                const missionId = session.missionChoices.find(
                  (mission) => `mission:${mission.id}` === value,
                )?.id;
                if (missionId !== undefined) {
                  session.setScope({ kind: 'mission', missionId });
                }
                return;
              }
            }}
          >
            <option value="general">All missions</option>
            <optgroup label="Missions">
              {session.missionChoices.map((mission) => (
                <option
                  key={mission.id}
                  value={`mission:${mission.id}`}
                  disabled={mission.locked}
                >
                  {mission.title}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="ai-only-progress-menu">
          <button
            type="button"
            className="ai-only-progress-pill"
            aria-label={`${session.projection.completionPercent}% complete, ${LEVEL_TRACK_LABELS[session.projection.currentLevel] /* nosemgrep: gitlab.eslint.detect-object-injection */}. Open progress details.`}
            aria-expanded={progressOpen}
            aria-controls="ai-only-progress-popover"
            onClick={() => setProgressOpen((current) => !current)}
          >
            <strong>{session.projection.completionPercent}%</strong>
            <span>{LEVEL_TRACK_LABELS[session.projection.currentLevel] /* nosemgrep: gitlab.eslint.detect-object-injection */}</span>
          </button>
          {progressOpen && (
            <section
              id="ai-only-progress-popover"
              className="ai-only-progress-popover"
              aria-label="Learning progress"
            >
              <div>
                <strong>{completedMissions.length} of {catalog.missions.length} missions</strong>
                <span> completed</span>
              </div>
              {completedMissions.length > 0 ? (
                <ul>
                  {completedMissions.map((mission) => <li key={mission.id}>{mission.title}</li>)}
                </ul>
              ) : (
                <p>Your first mission is ready when you are.</p>
              )}
              <h2>Topics to revisit</h2>
              {session.projection.weakTopics.length > 0 ? (
                <ul>
                  {session.projection.weakTopics.map((topic) => (
                    <li key={topic.topic}>{topic.topic}</li>
                  ))}
                </ul>
              ) : (
                <p>No weak topics yet.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </header>
  );
}
