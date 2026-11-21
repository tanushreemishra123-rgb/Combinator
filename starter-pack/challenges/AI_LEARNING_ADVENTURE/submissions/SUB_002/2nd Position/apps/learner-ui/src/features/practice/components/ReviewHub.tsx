import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { useAppSelector } from '../../../store/index.ts';
import { selectMissionDisplay } from '../../../store/preferencesSlice.ts';
import { useReviewDeck } from '../hooks/useReviewDeck.ts';
import { useMissionSummary } from '../../ai-feedback/hooks/useMissionSummary.ts';
import { SummaryCard } from '../../ai-feedback/components/SummaryCard.tsx';

export interface ReviewHubProps {
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

export function ReviewHub({ catalog, progress }: ReviewHubProps) {
  const { navigate } = useAppNavigation();
  const display = useAppSelector(selectMissionDisplay);
  const review = useReviewDeck(catalog, progress);
  const summary = useMissionSummary({ weakTopics: review.topics });

  if (review.isLoading) {
    return (
      <div className="app-status" role="status">
        <p>Loading your review deck…</p>
      </div>
    );
  }

  if (!review.hasTopicSignals) {
    return (
      <section className="review-hub review-hub--empty" aria-label="Review">
        <h1 className="review-hub__title">Review</h1>
        <p className="review-hub__empty">
          Nothing to review yet — great work! Finish missions and answer quiz questions to build
          your review deck.
        </p>
        <button
          type="button"
          className="button button--primary"
          onClick={() => navigate({ kind: 'missions', display })}
        >
          Explore missions
        </button>
      </section>
    );
  }

  return (
    <section className="review-hub" aria-label="Review">
      <h1 className="review-hub__title">Review</h1>
      <div className="review-hub__topics">
        <h2 className="review-hub__heading">Your weak topics</h2>
        <ul className="weak-topic-chips" aria-label="Weak topics">
          {review.topics.map((signal) => (
            <li key={signal.topic}>
              <button
                type="button"
                className="weak-topic-chips__chip"
                onClick={() => navigate({ kind: 'flashcards', mode: 'review', topic: signal.topic })}
              >
                {signal.topic}{' '}
                <span className="weak-topic-chips__count">{signal.weight}</span>{' '}
                <span className="weak-topic-chips__sources">
                  {signal.sources.includes('quiz') ? 'quiz' : ''}
                  {signal.sources.includes('quiz') && signal.sources.includes('flashcards') ? ' + ' : ''}
                  {signal.sources.includes('flashcards') ? 'flashcards' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {review.cards.length === 0 ? (
        <p className="review-hub__known">
          All cards for these topics are already marked Got it. Keep practising and new cards will
          appear here.
        </p>
      ) : (
        <button
          type="button"
          className="button button--primary"
          onClick={() => navigate({ kind: 'flashcards', mode: 'review' })}
        >
          Start review
        </button>
      )}
      <div className="review-hub__ai">
        <SummaryCard
          title={summary.title ?? 'Weak-topic recap'}
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
    </section>
  );
}
