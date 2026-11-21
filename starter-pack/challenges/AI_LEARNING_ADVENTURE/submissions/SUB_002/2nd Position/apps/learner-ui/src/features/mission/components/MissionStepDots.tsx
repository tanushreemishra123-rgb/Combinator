import type { MissionStep } from '@ai-learning-adventure/types';
import {
  isStepUnlocked,
  MISSION_STEP_LABELS,
  MISSION_STEP_SEQUENCE,
} from '@ai-learning-adventure/learner';

export interface MissionStepDotsProps {
  step: MissionStep;
  furthestStep: MissionStep;
  visitedSteps: MissionStep[];
  onSelectStep: (step: MissionStep) => void;
}

export function MissionStepDots({
  step,
  furthestStep,
  visitedSteps,
  onSelectStep,
}: MissionStepDotsProps) {
  return (
    <ol className="mission-step-dots" aria-label="Mission steps">
      {MISSION_STEP_SEQUENCE.map((candidate, index) => {
        const isCurrent = candidate === step;
        const isVisited = visitedSteps.includes(candidate);
        const unlocked = isStepUnlocked(candidate, furthestStep);
        const stateClass = isCurrent
          ? 'mission-step-dots__dot--current'
          : isVisited
            ? 'mission-step-dots__dot--visited'
            : 'mission-step-dots__dot--unreached';
        const stateText = isCurrent
          ? ' (current step)'
          : isVisited
            ? ' (visited)'
            : unlocked
              ? ''
              : ' (not unlocked yet)';
        const label = `Step ${index + 1} of ${MISSION_STEP_SEQUENCE.length}: ${MISSION_STEP_LABELS[candidate] /* nosemgrep: gitlab.eslint.detect-object-injection */}${stateText}`;
        return (
          <li key={candidate} className="mission-step-dots__item">
            <button
              type="button"
              className={`mission-step-dots__dot ${stateClass}`}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={!unlocked || undefined}
              title={
                unlocked
                  ? MISSION_STEP_LABELS[candidate] /* nosemgrep: gitlab.eslint.detect-object-injection */
                  : `${MISSION_STEP_LABELS[candidate] /* nosemgrep: gitlab.eslint.detect-object-injection */} — finish the earlier steps to unlock`
              }
              onClick={() => onSelectStep(candidate)}
            >
              <span className="visually-hidden">{label}</span>
              <span aria-hidden="true">{index + 1}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
