import type { MissionDetail, MissionStep } from '@ai-learning-adventure/types';
import { DIFFICULTY_LABELS, LEVEL_TRACK_LABELS } from '@ai-learning-adventure/learner';
import { MissionStepDots } from './MissionStepDots.tsx';

export interface MissionHeaderProps {
  mission: MissionDetail;
  missionNumber: number;
  step: MissionStep;
  furthestStep: MissionStep;
  visitedSteps: MissionStep[];
  onSelectStep: (step: MissionStep) => void;
}

export function MissionHeader({
  mission,
  missionNumber,
  step,
  furthestStep,
  visitedSteps,
  onSelectStep,
}: MissionHeaderProps) {
  return (
    <header className="mission-header">
      <div className="mission-header__top">
        <span className="mission-header__minutes">About {mission.estimatedMinutes} min</span>
      </div>
      <p className="mission-header__number">Mission {missionNumber}</p>
      <h1 className="mission-header__title">{mission.title}</h1>
      <div className="mission-header__chips">
        <span className="mission-chip mission-chip--difficulty">
          {DIFFICULTY_LABELS[mission.difficulty] /* nosemgrep: gitlab.eslint.detect-object-injection */}
        </span>
        <span className="mission-chip mission-chip--track">
          {LEVEL_TRACK_LABELS[mission.levelTrack] /* nosemgrep: gitlab.eslint.detect-object-injection */}
        </span>
      </div>
      <MissionStepDots
        step={step}
        furthestStep={furthestStep}
        visitedSteps={visitedSteps}
        onSelectStep={onSelectStep}
      />
      <div className="mission-objective">
        <p className="mission-objective__label">By the end of this mission you’ll be able to…</p>
        <p className="mission-objective__text">{mission.objective}</p>
      </div>
    </header>
  );
}
