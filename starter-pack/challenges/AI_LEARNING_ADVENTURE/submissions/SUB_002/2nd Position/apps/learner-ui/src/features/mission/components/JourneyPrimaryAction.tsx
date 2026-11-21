import type { UseJourneyEntryResult } from '../hooks/useJourneyEntry.ts';
import { StartOverControl } from './StartOverControl.tsx';

export interface JourneyPrimaryActionProps {
  journey: UseJourneyEntryResult;
  learnerId: string;
}

export function JourneyPrimaryAction({ journey, learnerId }: JourneyPrimaryActionProps) {
  const { mode, label, missionText, progressText, completionPercent, target, open } = journey;

  return (
    <div className="journey-action">
      <button
        type="button"
        className="button button--primary journey-action__cta"
        disabled={target === undefined}
        onClick={open}
      >
        <span className="journey-action__label">{label}</span>
        {mode === 'continue' && missionText !== undefined && (
          <span className="journey-action__mission">{missionText}</span>
        )}
      </button>
      {mode === 'continue' && progressText !== undefined && (
        <div className="journey-action__progress">
          <div
            className="journey-action__bar"
            role="progressbar"
            aria-label={progressText}
            aria-valuenow={completionPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="journey-action__bar-fill" style={{ width: `${completionPercent}%` }} />
          </div>
          <span className="journey-action__progress-text">{progressText}</span>
          <StartOverControl learnerId={learnerId} />
        </div>
      )}
    </div>
  );
}
