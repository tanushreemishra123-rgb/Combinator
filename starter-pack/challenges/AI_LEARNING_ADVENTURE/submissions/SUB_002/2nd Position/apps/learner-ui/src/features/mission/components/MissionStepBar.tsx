import type { MissionStep } from '@ai-learning-adventure/types';
import {
  MISSION_STEP_LABELS,
  MISSION_STEP_SEQUENCE,
  nextStep,
} from '@ai-learning-adventure/learner';

export interface MissionStepBarProps {
  step: MissionStep;
  canGoBack: boolean;
  canGoNext: boolean;
  isSaving: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function MissionStepBar({
  step,
  canGoBack,
  canGoNext,
  isSaving,
  onBack,
  onNext,
}: MissionStepBarProps) {
  const target = nextStep(step);
  const showNext = target !== undefined && step !== 'quiz' && step !== 'result';
  const position = MISSION_STEP_SEQUENCE.indexOf(step) + 1;

  return (
    <div className="mission-step-bar">
      <button
        type="button"
        className="button button--secondary button--small"
        disabled={!canGoBack}
        onClick={onBack}
      >
        Back
      </button>
      <p className="mission-step-bar__position" aria-live="off">
        Step {position} of {MISSION_STEP_SEQUENCE.length} · {MISSION_STEP_LABELS[step] /* nosemgrep: gitlab.eslint.detect-object-injection */}
        {isSaving && <span className="mission-step-bar__saving"> · Saving progress…</span>}
      </p>
      {showNext ? (
        <button
          type="button"
          className="button button--primary button--small"
          disabled={!canGoNext}
          onClick={onNext}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNext();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNext();
            }
          }}
        >
          Next: {MISSION_STEP_LABELS[target]}
        </button>
      ) : (
        <span className="mission-step-bar__spacer" aria-hidden="true" />
      )}
    </div>
  );
}
