import type { CatalogDto, LevelTrack, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { LEVEL_TRACK_LABELS, nextIncompleteMissionForTrack } from '@ai-learning-adventure/learner';
import { useAppDispatch } from '../../../store/index.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { useStartMission } from '../../../hooks/useStartMission.ts';
import { focusTrackFilter } from '../../../store/preferencesSlice.ts';
import { useProgressDashboard } from '../hooks/useProgressDashboard.ts';
import { ProgressSummary } from './ProgressSummary.tsx';
import { MissionProgressList } from './MissionProgressList.tsx';
import { ScoreHistory } from './ScoreHistory.tsx';
import { JourneyLadder } from './JourneyLadder.tsx';
import { BadgeCollection } from './BadgeCollection.tsx';
import { MilestoneList } from './MilestoneList.tsx';
import { NextSteps } from './NextSteps.tsx';

export interface ProgressViewProps {
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

export function ProgressView({ catalog, progress }: ProgressViewProps) {
  const dispatch = useAppDispatch();
  const { navigate } = useAppNavigation();
  const dashboard = useProgressDashboard(catalog, progress);
  const { openMission } = useStartMission(progress);

  function continueTrack(levelTrack: LevelTrack): void {
    const mission = nextIncompleteMissionForTrack(catalog, progress, levelTrack);
    if (mission !== undefined) openMission(mission);
  }

  function inspectTrack(levelTrack: LevelTrack): void {
    dispatch(focusTrackFilter(levelTrack));
    navigate({ kind: 'missions', display: 'list' });
  }

  const currentLevelLabel = LEVEL_TRACK_LABELS[dashboard.currentLevel] /* nosemgrep: gitlab.eslint.detect-object-injection */;

  return (
    <section className="progress-view" aria-label="Progress">
      <h1 className="progress-view__title" tabIndex={-1}>
        Progress
      </h1>

      <ProgressSummary summary={dashboard.summary} currentLevelLabel={currentLevelLabel} />

      <div className="progress-view__grid">
        <NextSteps
          progress={progress}
          recommendation={dashboard.recommendation}
          weakTopics={dashboard.weakTopics}
        />
        <MissionProgressList rows={dashboard.missionRows} onOpenMission={openMission} />
        <div className="progress-view__column">
          <JourneyLadder
            ladder={dashboard.ladder}
            onContinueTrack={continueTrack}
            onInspectTrack={inspectTrack}
          />
          <ScoreHistory points={dashboard.scorePoints} />
        </div>
        <div className="progress-view__column">
          <BadgeCollection badges={dashboard.awards.badges} catalog={catalog} />
          <MilestoneList milestones={dashboard.awards.milestones} />
        </div>
      </div>
    </section>
  );
}
