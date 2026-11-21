import { useMemo } from 'react';
import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { hasTouchedAnyMission } from '@ai-learning-adventure/learner';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { useAppSelector } from '../../../store/index.ts';
import { selectMissionDisplay } from '../../../store/preferencesSlice.ts';
import { useStartMission } from '../../../hooks/useStartMission.ts';
import { useLearningRecommendation } from '../../progress/hooks/useLearningRecommendation.ts';
import { RecommendationCard } from '../../progress/components/RecommendationCard.tsx';
import { ReviewRecommendationBanner } from '../../progress/components/ReviewRecommendationBanner.tsx';
import { JourneyCompleteCard } from '../../progress/components/JourneyCompleteCard.tsx';
import { useJourneyEntry } from '../hooks/useJourneyEntry.ts';
import { JourneyPrimaryAction } from './JourneyPrimaryAction.tsx';

export interface HomeViewProps {
  learnerId: string;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

export function HomeView({ learnerId, catalog, progress }: HomeViewProps) {
  const { navigate } = useAppNavigation();
  const display = useAppSelector(selectMissionDisplay);
  const journey = useJourneyEntry(catalog, progress);
  const { openMission } = useStartMission(progress);
  const recommendation = useLearningRecommendation(catalog, progress);
  const touched = hasTouchedAnyMission(catalog, progress);

  const totalMinutes = useMemo(
    () => catalog.missions.reduce((sum, mission) => sum + mission.estimatedMinutes, 0),
    [catalog],
  );

  return (
    <section className="home-view" aria-label="Home">
      <div className="home-hero">
        <div className="home-hero__content">
          <p className="home-hero__eyebrow">AI Quest</p>
          <h1 className="home-hero__title">Learn AI fundamentals on a guided adventure</h1>
          <p className="home-hero__promise">
            {catalog.missions.length} short missions · about {totalMinutes} minutes · no signup
          </p>
          <p className="home-hero__welcome">Learn through quick lessons, practice, and an AI tutor.</p>
          <JourneyPrimaryAction journey={journey} learnerId={learnerId} />
          <p className="home-hero__privacy">No account needed. Your progress stays on this device.</p>
        </div>
        <div className="home-hero__art" aria-hidden="true">
          <svg viewBox="0 0 220 220" role="img" focusable="false">
            <path
              d="M30 190 C 70 190, 60 140, 100 135 S 150 90, 140 60 S 185 25, 195 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="1 14"
              className="home-hero__path"
            />
            <circle cx="30" cy="190" r="16" className="home-hero__node home-hero__node--start" />
            <circle cx="100" cy="135" r="14" className="home-hero__node home-hero__node--mid" />
            <circle cx="140" cy="60" r="14" className="home-hero__node home-hero__node--mid" />
            <circle cx="195" cy="20" r="18" className="home-hero__node home-hero__node--goal" />
          </svg>
        </div>
      </div>

      <nav className="home-shortcuts" aria-label="More ways to learn">
        <button
          type="button"
          className="home-shortcut home-shortcut--missions"
          aria-label="Explore missions"
          onClick={() => navigate({ kind: 'missions', display })}
        >
          <span className="home-shortcut__icon" aria-hidden="true">01</span>
          <span className="home-shortcut__copy">
            <strong>Explore missions</strong>
            <small>Choose your next challenge</small>
          </span>
          <span className="home-shortcut__arrow" aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="home-shortcut home-shortcut--review"
          aria-label="Review"
          onClick={() => navigate({ kind: 'review' })}
        >
          <span className="home-shortcut__icon" aria-hidden="true">02</span>
          <span className="home-shortcut__copy">
            <strong>Review</strong>
            <small>Strengthen weak topics</small>
          </span>
          <span className="home-shortcut__arrow" aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="home-shortcut home-shortcut--ai"
          aria-label="AI Only Mode"
          onClick={() => navigate({ kind: 'ai-only' })}
        >
          <span className="home-shortcut__icon" aria-hidden="true">AI</span>
          <span className="home-shortcut__copy">
            <strong>AI Only Mode</strong>
            <small>Learn through conversation</small>
          </span>
          <span className="home-shortcut__arrow" aria-hidden="true">→</span>
        </button>
      </nav>

      {touched && (
        <div className="home-recommendation">
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
              onChooseAnother={() => navigate({ kind: 'missions', display })}
            />
          )}
          {recommendation.journeyComplete && (
            <JourneyCompleteCard onReview={() => navigate({ kind: 'review' })} />
          )}
        </div>
      )}

    </section>
  );
}
