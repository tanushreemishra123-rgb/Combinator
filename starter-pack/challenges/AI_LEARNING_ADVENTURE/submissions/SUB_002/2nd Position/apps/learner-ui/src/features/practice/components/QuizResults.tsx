import type {
  CatalogDto,
  MissionDetail,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';
import { useAppSelector } from '../../../store/index.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { selectMissionDisplay } from '../../../store/preferencesSlice.ts';
import { useStartMission } from '../../../hooks/useStartMission.ts';
import { DeferredAiAction } from '../../mission/components/DeferredAiAction.tsx';
import { buildMissionContext } from '@ai-learning-adventure/learner';
import { useLearningRecommendation } from '../../progress/hooks/useLearningRecommendation.ts';
import { RecommendationCard } from '../../progress/components/RecommendationCard.tsx';
import { ReviewRecommendationBanner } from '../../progress/components/ReviewRecommendationBanner.tsx';
import { JourneyCompleteCard } from '../../progress/components/JourneyCompleteCard.tsx';
import { useQuizResults } from '../hooks/useQuizResults.ts';
import type { UseQuizSessionResult } from '../hooks/useQuizSession.ts';

export interface QuizResultsProps {
  mission: MissionDetail;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
  session: UseQuizSessionResult;
}

export function QuizResults({ mission, catalog, progress, session }: QuizResultsProps) {
  const { navigate, back } = useAppNavigation();
  const display = useAppSelector(selectMissionDisplay);
  const results = useQuizResults(mission, catalog, progress, session.isSaving);
  const recommendation = useLearningRecommendation(catalog, progress, mission.id);
  const { openMission } = useStartMission(progress);
  const passed = results.result === 'passed';

  function openNextMission(): void {
    const next = recommendation.missionRecommendation;
    if (next === undefined) return;
    openMission(next.mission);
  }

  return (
    <section className="quiz-results" aria-label="Quiz results">
      <h1 className="quiz-results__title" tabIndex={-1}>
        {mission.title} quiz
      </h1>

      <div className="quiz-results__score">
        <div className={`score-dial ${passed ? 'score-dial--passed' : 'score-dial--review'}`}>
          <span className="score-dial__fraction">
            {results.correctCount}/{results.questionCount}
          </span>
          <span className="score-dial__percent">{results.scorePercent}%</span>
        </div>
        <p className={`result-pill ${passed ? 'result-pill--passed' : 'result-pill--review'}`}>
          {passed ? 'Passed' : 'Needs review'}
        </p>
        {results.bestScore !== undefined && (
          <p className="quiz-results__best">
            Best score: {results.bestScore}%
            {results.latestScore !== undefined && results.latestScore !== results.bestScore
              ? ` · latest ${results.latestScore}%`
              : ''}
          </p>
        )}
      </div>

      {session.saveError !== undefined && (
        <div className="quiz-results__save-error" role="alert">
          <p>The result could not be saved yet.</p>
          <button type="button" className="button button--secondary button--small" onClick={session.retrySave}>
            Try again
          </button>
        </div>
      )}

      {results.weakTopics.length > 0 && (
        <div className="quiz-results__weak-topics">
          <h2 className="quiz-results__section-heading">Weak topics</h2>
          <ul className="weak-topic-chips" aria-label="Weak topics">
            {results.weakTopics.map((signal) => (
              <li key={signal.topic}>
                <button
                  type="button"
                  className="weak-topic-chips__chip"
                  onClick={() =>
                    navigate({ kind: 'flashcards', mode: 'review', topic: signal.topic })
                  }
                >
                  {signal.topic}{' '}
                  <span className="weak-topic-chips__count">{signal.weight}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="quiz-results__recommendation">
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
            onStart={openNextMission}
            onChooseAnother={() => navigate({ kind: 'missions', display })}
          />
        )}
        {recommendation.journeyComplete && (
          <JourneyCompleteCard onReview={() => navigate({ kind: 'review' })} />
        )}
      </div>

      {results.recapRows.length > 0 && (
        <div className="quiz-results__recap">
          <h2 className="quiz-results__section-heading">Question recap</h2>
          <ul className="quiz-recap" aria-label="Question recap">
            {results.recapRows.map((row, index) => {
              const selectedText = row.question.options
                .filter((option) => row.selectedOptionIds.includes(option.id))
                .map((option) => option.text)
                .join(', ');
              return (
                <li key={row.question.id as string} className="quiz-recap__item">
                  <details className="quiz-recap__details">
                    <summary className="quiz-recap__summary">
                      <span className="quiz-recap__number">{index + 1}.</span>
                      <span className="quiz-recap__stem">{row.question.stem}</span>
                      <span
                        className={`quiz-recap__verdict ${
                          row.isCorrect ? 'quiz-recap__verdict--correct' : 'quiz-recap__verdict--wrong'
                        }`}
                      >
                        {row.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </summary>
                    <div className="quiz-recap__body">
                      <p className="quiz-recap__answer">Your answer: {selectedText || '—'}</p>
                      {row.missedCorrectOptionIds.length > 0 && (
                        <p className="quiz-recap__missed">
                          Missed:{' '}
                          {row.question.options
                            .filter((option) => row.missedCorrectOptionIds.includes(option.id))
                            .map((option) => option.text)
                            .join(', ')}
                        </p>
                      )}
                      <p className="quiz-recap__explanation">{row.explanation}</p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {results.attemptHistory.length > 0 && (
        <div className="quiz-results__history">
          <details className="quiz-results__attempts">
            <summary className="quiz-results__attempts-summary">Attempts</summary>
            <ul className="attempt-history" aria-label="Attempt history">
              {results.attemptHistory.map((attempt) => (
                <li key={attempt.id} className="attempt-history__item">
                  <span className="attempt-history__date">
                    {new Date(attempt.completedAt).toLocaleDateString()}
                  </span>
                  <span className="attempt-history__score">{attempt.scorePercent}%</span>
                  <span
                    className={`attempt-history__result ${
                      attempt.result === 'passed'
                        ? 'attempt-history__result--passed'
                        : 'attempt-history__result--review'
                    }`}
                  >
                    {attempt.result === 'passed' ? 'Passed' : 'Needs review'}
                  </span>
                  {attempt.scorePercent === results.bestScore && (
                    <span className="attempt-history__best" aria-label="Best score">
                      ★
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <div className="quiz-results__ai">
        <DeferredAiAction
          label="Ask the tutor about this quiz"
          missionId={mission.id}
          context={buildMissionContext(mission)}
        />
      </div>

      <div className="quiz-results__actions">
        <button type="button" className="button button--primary" onClick={session.retryQuiz}>
          Retry quiz
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => navigate({ kind: 'flashcards', mode: 'mission', missionId: mission.id })}
        >
          Review flashcards
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={back}
        >
          Back to mission
        </button>
      </div>
    </section>
  );
}
