import type { ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { useStartMission } from '../../../hooks/useStartMission.ts';
import type { UseLearningRecommendationResult } from '../hooks/useLearningRecommendation.ts';
import type { WeakTopicSignal } from '../../../store/progressProjectionSlice.ts';
import { RecommendationCard } from './RecommendationCard.tsx';
import { ReviewRecommendationBanner } from './ReviewRecommendationBanner.tsx';
import { JourneyCompleteCard } from './JourneyCompleteCard.tsx';

export interface NextStepsProps {
  progress: ProgressSnapshotDto;
  recommendation: UseLearningRecommendationResult;
  weakTopics: WeakTopicSignal[];
}

export function NextSteps({ progress, recommendation, weakTopics }: NextStepsProps) {
  const { navigate } = useAppNavigation();
  const { openMission } = useStartMission(progress);

  return (
    <section className="next-steps" aria-label="Next steps">
      <h2 className="progress-panel__heading">Next steps</h2>

      {recommendation.reviewRecommendation !== undefined && (
        <ReviewRecommendationBanner
          recommendation={recommendation.reviewRecommendation}
          onReview={() =>
            navigate({
              kind: 'flashcards',
              mode: 'review',
              topic: recommendation.reviewRecommendation?.topic,
            })
          }
        />
      )}

      {recommendation.missionRecommendation !== undefined && (
        <RecommendationCard
          mission={recommendation.missionRecommendation.mission}
          reason={recommendation.missionRecommendation.reason}
          rationale={recommendation.aiRationale}
          onStart={() =>
            recommendation.missionRecommendation !== undefined &&
            openMission(recommendation.missionRecommendation.mission)
          }
          onChooseAnother={() => navigate({ kind: 'missions', display: 'map' })}
        />
      )}

      {recommendation.journeyComplete && (
        <JourneyCompleteCard onReview={() => navigate({ kind: 'review' })} />
      )}

      <div className="next-steps__weak-topics">
        <h3 className="next-steps__weak-heading">Weak topics</h3>
        {weakTopics.length === 0 ? (
          <p className="next-steps__weak-empty">Nothing to review yet — great work.</p>
        ) : (
          <ul className="weak-topic-chips" aria-label="Weak topics">
            {weakTopics.map((signal) => (
              <li key={signal.topic}>
                <button
                  type="button"
                  className="weak-topic-chips__chip"
                  onClick={() => navigate({ kind: 'flashcards', mode: 'review', topic: signal.topic })}
                >
                  {signal.topic} <span className="weak-topic-chips__count">{signal.weight}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
