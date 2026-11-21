export interface JourneyCompleteCardProps {
  onReview: () => void;
}

export function JourneyCompleteCard({ onReview }: JourneyCompleteCardProps) {
  return (
    <div className="recommendation-card recommendation-card--complete">
      <div className="recommendation-card__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="m8 12.5 2.5 2.5L16 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="recommendation-card__body">
        <p className="recommendation-card__eyebrow">Journey complete</p>
        <h3 className="recommendation-card__title">You finished every mission!</h3>
        <p className="recommendation-card__reason">
          Keep your new skills sharp with a review of your weak topics.
        </p>
      </div>
      <div className="recommendation-card__actions">
        <button type="button" className="button button--primary" onClick={onReview}>
          Open review mode
        </button>
      </div>
    </div>
  );
}
