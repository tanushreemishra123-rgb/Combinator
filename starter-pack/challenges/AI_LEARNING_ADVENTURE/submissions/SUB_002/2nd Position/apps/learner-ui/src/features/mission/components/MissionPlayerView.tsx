import { useEffect, useRef } from 'react';
import type { CatalogDto, MissionDetail, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { useKeyboardShortcut } from '../../../hooks/ui/useKeyboardShortcut.ts';
import { useMissionPlayer, type MissionView, type UseMissionPlayerResult } from '../hooks/useMissionPlayer.ts';
import { useMissionCompletion } from '../hooks/useMissionCompletion.ts';
import { CheckpointStep } from './CheckpointStep.tsx';
import { ExampleStep } from './ExampleStep.tsx';
import { LessonStep } from './LessonStep.tsx';
import { MissionCompletionPanel } from './MissionCompletionPanel.tsx';
import { MissionHeader } from './MissionHeader.tsx';
import { MissionStepBar } from './MissionStepBar.tsx';
import { QuizHandoffStep } from './QuizHandoffStep.tsx';

export interface MissionPlayerViewProps {
  learnerId: string;
  view: MissionView;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

interface MissionPlayerBodyProps {
  catalog: CatalogDto;
  mission: MissionDetail;
  progress: ProgressSnapshotDto;
  player: UseMissionPlayerResult;
}

function MissionPlayerBody({ catalog, mission, progress, player }: MissionPlayerBodyProps) {
  const completion = useMissionCompletion(catalog, mission, progress);
  const missionNumber = catalog.missions.findIndex((candidate) => candidate.id === mission.id) + 1;

  return (
    <div className="mission-player">
      <MissionHeader
        mission={mission}
        missionNumber={missionNumber}
        step={player.step}
        furthestStep={player.furthestStep}
        visitedSteps={player.visitedSteps}
        onSelectStep={player.goToVisitedStep}
      />
      <div className="mission-player__content">
        {player.step === 'lesson' && <LessonStep mission={mission} />}
        {player.step === 'example' && <ExampleStep mission={mission} />}
        {player.step === 'checkpoint' && <CheckpointStep mission={mission} player={player} />}
        {player.step === 'quiz' && <QuizHandoffStep mission={mission} player={player} />}
        {player.step === 'result' && (
          <MissionCompletionPanel
            catalog={catalog}
            mission={mission}
            progress={progress}
            player={player}
            completion={completion}
          />
        )}
      </div>
      <MissionStepBar
        step={player.step}
        canGoBack={player.canGoBack}
        canGoNext={player.canGoNext}
        isSaving={player.isSaving}
        onBack={player.goBack}
        onNext={player.goNext}
      />
    </div>
  );
}

export function MissionPlayerView({ learnerId, view, catalog, progress }: MissionPlayerViewProps) {
  const { back } = useAppNavigation();
  const player = useMissionPlayer(learnerId, view, catalog, progress);

  const missionLoaded = player.mission !== undefined;
  useKeyboardShortcut({ key: 'ArrowLeft', enabled: missionLoaded }, player.goBack);
  useKeyboardShortcut({ key: 'ArrowRight', enabled: missionLoaded && player.canGoNext }, player.goNext);

  const isFirstStepRender = useRef(true);
  useEffect(() => {
    if (isFirstStepRender.current) {
      isFirstStepRender.current = false;
      return;
    }
    const heading = document.getElementById('mission-step-heading');
    heading?.focus({ preventScroll: true });
  }, [player.step]);

  const mission =
    player.mission !== undefined && player.mission.id === view.missionId
      ? player.mission
      : undefined;

  if (player.error !== undefined) {
    return (
      <div className="app-status" role="alert">
        <h1>This mission could not be loaded</h1>
        <p>{player.error.message}</p>
        <div>
          <button type="button" className="app-status__retry" onClick={player.refresh}>
            Try again
          </button>
          <button type="button" className="button button--ghost" onClick={back}>
            Back to map
          </button>
        </div>
      </div>
    );
  }

  if (mission === undefined) {
    return (
      <div className="app-status" role="status">
        <p>Loading mission…</p>
      </div>
    );
  }

  return (
    <MissionPlayerBody
      catalog={catalog}
      mission={mission}
      progress={progress}
      player={player}
    />
  );
}
