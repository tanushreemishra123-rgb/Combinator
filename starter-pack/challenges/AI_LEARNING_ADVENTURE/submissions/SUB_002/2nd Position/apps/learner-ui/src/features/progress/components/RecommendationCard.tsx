import type { MissionSummary } from '@ai-learning-adventure/types';
import { DIFFICULTY_LABELS, LEVEL_TRACK_LABELS } from '@ai-learning-adventure/learner';
import type { AiRationale } from '../hooks/useLearningRecommendation.ts';

export interface RecommendationCardProps {
  mission: MissionSummary;
  reason: string;
  rationale?: AiRationale;
  onStart: () => void;
  onChooseAnother?: () => void;
}

export function RecommendationCard({
  mission,
  reason,
  rationale,
  onStart,
  onChooseAnother,
}: RecommendationCardProps) {
  return (
    <div className="recommendation-card">
      <div className="recommendation-card__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="m9 8 7 4-7 4V8z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="recommendation-card__body">
        <p className="recommendation-card__eyebrow">Why this next</p>
        <h3 className="recommendation-card__title">{mission.title}</h3>
        <p className="recommendation-card__chips">
          <span className="recommendation-card__chip">{DIFFICULTY_LABELS[mission.difficulty] /* nosemgrep: gitlab.eslint.detect-object-injection */}</span>
          <span className="recommendation-card__chip">
            {LEVEL_TRACK_LABELS[mission.levelTrack] /* nosemgrep: gitlab.eslint.detect-object-injection */}
          </span>
        </p>
        <p className="recommendation-card__reason">{rationale?.text ?? reason}</p>
        {rationale?.label !== undefined && (
          <p className="recommendation-card__ai-label">{rationale.label}</p>
        )}
      </div>
      <div className="recommendation-card__actions">
        <button type="button" className="button button--primary" onClick={onStart}>
          Start mission
        </button>
        {onChooseAnother !== undefined && (
          <button type="button" className="button button--secondary" onClick={onChooseAnother}>
            Choose another
          </button>
        )}
      </div>
    </div>
  );
}
