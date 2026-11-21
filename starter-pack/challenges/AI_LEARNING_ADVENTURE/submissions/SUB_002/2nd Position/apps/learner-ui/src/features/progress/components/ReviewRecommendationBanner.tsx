import type { ReviewRecommendation } from '@ai-learning-adventure/types';
import { DeferredAiAction } from '../../mission/components/DeferredAiAction.tsx';

export interface ReviewRecommendationBannerProps {
  recommendation: ReviewRecommendation;
  onReview: () => void;
}

export function ReviewRecommendationBanner({
  recommendation,
  onReview,
}: ReviewRecommendationBannerProps) {
  return (
    <div className="review-banner" role="note">
      <div className="review-banner__body">
        <h3 className="review-banner__title">Review {recommendation.topic}</h3>
        <p className="review-banner__reason">{recommendation.reason}</p>
      </div>
      <div className="review-banner__actions">
        <button type="button" className="button button--primary" onClick={onReview}>
          Review this topic
        </button>
        <DeferredAiAction
          label="Ask the tutor"
          className="review-banner__tutor"
          context={{
            progress: {
              completionPercent: 0,
              currentLevel: 'beginner',
              weakTopics: [{ topic: recommendation.topic, weight: 1, sources: [] }],
            },
          }}
        />
      </div>
    </div>
  );
}
