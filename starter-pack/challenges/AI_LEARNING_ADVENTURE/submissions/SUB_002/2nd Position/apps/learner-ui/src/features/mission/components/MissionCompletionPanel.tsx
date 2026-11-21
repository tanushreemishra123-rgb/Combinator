import type { CatalogDto, MissionDetail, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { buildMissionContext } from '@ai-learning-adventure/learner';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { selectMissionDisplay } from '../../../store/preferencesSlice.ts';
import { clearQuiz } from '../../../store/quizSessionSlice.ts';
import { useStartMission } from '../../../hooks/useStartMission.ts';
import { useLearningRecommendation } from '../../progress/hooks/useLearningRecommendation.ts';
import { RecommendationCard } from '../../progress/components/RecommendationCard.tsx';
import { JourneyCompleteCard } from '../../progress/components/JourneyCompleteCard.tsx';
import { DeferredAiAction } from './DeferredAiAction.tsx';
import type { UseMissionPlayerResult } from '../hooks/useMissionPlayer.ts';
import type { UseMissionCompletionResult } from '../hooks/useMissionCompletion.ts';
import { useMissionSummary } from '../../ai-feedback/hooks/useMissionSummary.ts';
import { SummaryCard } from '../../ai-feedback/components/SummaryCard.tsx';

export interface MissionCompletionPanelProps {
  catalog: CatalogDto;
  mission: MissionDetail;
  progress: ProgressSnapshotDto;
  player: UseMissionPlayerResult;
  completion: UseMissionCompletionResult;
}

export function MissionCompletionPanel({
  catalog,
  mission,
  progress,
  player,
  completion,
}: MissionCompletionPanelProps) {
  const dispatch = useAppDispatch();
  const { navigate } = useAppNavigation();
  const display = useAppSelector(selectMissionDisplay);
  const { openMission } = useStartMission(progress);
  const recommendation = useLearningRecommendation(catalog, progress, mission.id);
  const summary = useMissionSummary({ mission });

  function retryQuiz(): void {
    dispatch(clearQuiz());
    player.startQuiz();
  }

  if (!completion.isComplete) {
    return (
      <section className="mission-completion" aria-label="Result">
        <h2 id="mission-step-heading" className="mission-completion__heading" tabIndex={-1}>
          Almost there
        </h2>
        <ul className="mission-completion__checklist">
          <li>
            {completion.checkpointSatisfied ? '✓' : '○'} Checkpoint submitted
            {!completion.checkpointSatisfied && (
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => player.goToVisitedStep('checkpoint')}
              >
                Go to checkpoint
              </button>
            )}
          </li>
          <li>
            {completion.quizSatisfied ? '✓' : '○'} Quiz passed
            {!completion.quizSatisfied && (
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={retryQuiz}
              >
                Go to quiz
              </button>
            )}
          </li>
        </ul>
      </section>
    );
  }

  return (
    <section className="mission-completion mission-completion--done" aria-label="Result">
      <div className="mission-completion__confetti" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <h2 id="mission-step-heading" className="mission-completion__heading" tabIndex={-1}>
        Mission complete!
      </h2>
      {completion.earnedAwards.length > 0 && (
        <ul className="mission-completion__awards" aria-label="Badges earned">
          {completion.earnedAwards.map((award) => (
            <li key={award.id} className="mission-completion__award">
              <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" focusable="false">
                <circle cx="12" cy="9" r="6" fill="currentColor" opacity="0.25" />
                <circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M8.5 14 7 21l5-2.5L17 21l-1.5-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="mission-completion__award-name">{award.name}</span>
            </li>
          ))}
        </ul>
      )}
      {completion.bestScore !== undefined && (
        <p className="mission-completion__score">
          Best quiz score: {completion.bestScore}%
          {completion.latestAttempt !== undefined &&
            completion.latestAttempt.scorePercent !== completion.bestScore &&
            ` · latest ${completion.latestAttempt.scorePercent}%`}
        </p>
      )}
      <div className="mission-completion__ai">
         <DeferredAiAction
           label="Ask the tutor about this mission"
           missionId={mission.id}
           context={buildMissionContext(mission)}
         />
         <SummaryCard
           title={summary.title}
           items={summary.items}
           isMock={summary.isMock}
           busy={summary.busy}
           providerError={summary.providerError}
           copied={summary.copied}
           addedToReview={summary.addedToReview}
           onRequest={() => void summary.request()}
           onCopy={() => void summary.copy()}
           onAddToReview={summary.addToReview}
         />
      </div>
      <div className="mission-completion__next">
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
      <div className="mission-completion__actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => navigate({ kind: 'flashcards', mode: 'mission', missionId: mission.id })}
        >
          Review flashcards
        </button>
        <button type="button" className="button button--secondary" onClick={retryQuiz}>
          Retry quiz
        </button>
      </div>
    </section>
  );
}
