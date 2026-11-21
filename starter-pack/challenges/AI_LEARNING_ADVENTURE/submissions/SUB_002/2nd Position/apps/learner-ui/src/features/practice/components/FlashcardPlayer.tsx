import { useState } from 'react';
import type { Flashcard } from '@ai-learning-adventure/types';
import { useKeyboardShortcut } from '../../../hooks/ui/useKeyboardShortcut.ts';
import { DeferredAiAction } from '../../mission/components/DeferredAiAction.tsx';
import type { UseFlashcardDeckResult } from '../hooks/useFlashcardDeck.ts';

export interface FlashcardPlayerProps {
  title: string;
  deck: UseFlashcardDeckResult;
  onExit: () => void;
}

function FlashcardBack({ card }: { card: Flashcard }) {
  return (
    <dl className="flashcard__sections">
      <div className="flashcard__section">
        <dt>Definition</dt>
        <dd>{card.definition}</dd>
      </div>
      <div className="flashcard__section">
        <dt>Example</dt>
        <dd>{card.example}</dd>
      </div>
      {card.commonMistake !== undefined && (
        <div className="flashcard__section">
          <dt>Common mistake</dt>
          <dd>{card.commonMistake}</dd>
        </div>
      )}
      {card.learningTip !== undefined && (
        <div className="flashcard__section">
          <dt>Learning tip</dt>
          <dd>{card.learningTip}</dd>
        </div>
      )}
    </dl>
  );
}

export function FlashcardPlayer({ title, deck, onExit }: FlashcardPlayerProps) {
  const [finished, setFinished] = useState(false);

  useKeyboardShortcut({ key: ' ', enabled: deck.card !== undefined && !finished }, (event) => {
    if (event.target instanceof HTMLButtonElement) return;
    deck.flip();
  });
  useKeyboardShortcut({ key: 'ArrowLeft', enabled: deck.canGoPrevious && !finished }, () => {
    deck.previous();
  });
  useKeyboardShortcut({ key: 'ArrowRight', enabled: deck.canGoNext && !finished }, () => {
    deck.next();
  });

  if (finished) {
    return (
      <section className="deck-summary" aria-label="Deck summary">
        <h1 className="deck-summary__title" tabIndex={-1}>
          {title}
        </h1>
        <div className="deck-summary__stats">
          <p className="deck-summary__stat deck-summary__stat--known">
            <strong>{deck.summary?.gotItCount ?? 0}</strong> got it
          </p>
          <p className="deck-summary__stat deck-summary__stat--needs">
            <strong>{deck.summary?.needsWorkCount ?? 0}</strong> needs work
          </p>
          <p className="deck-summary__stat">
            <strong>{deck.summary?.remainingCount ?? 0}</strong> not rated
          </p>
        </div>
        {deck.saveError !== undefined && (
          <div className="deck-summary__save-error" role="alert">
            <p>A rating could not be saved.</p>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={deck.retrySave}
            >
              Try again
            </button>
          </div>
        )}
        <div className="deck-summary__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              deck.reviewNeedsWorkOnly();
              setFinished(false);
            }}
          >
            Review needs-work only
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              deck.restart();
              setFinished(false);
            }}
          >
            Restart deck
          </button>
          <button type="button" className="button button--ghost" onClick={onExit}>
            Back
          </button>
        </div>
      </section>
    );
  }

  const card = deck.card;

  if (card === undefined) {
    return (
      <div className="app-status" role="status">
        <p>Loading card…</p>
      </div>
    );
  }

  return (
    <section className="flashcard-deck" aria-label="Flashcard deck">
      <h1 className="flashcard-deck__title" tabIndex={-1}>
        {title}
      </h1>
      <p className="flashcard-deck__progress" role="status">
        Card {deck.cardNumber} of {deck.cardCount}
        {deck.reviewedCount > 0 ? ` · ${deck.reviewedCount} rated` : ''}
      </p>

      <div className={`flashcard ${deck.flipped ? 'flashcard--flipped' : ''}`}>
        <div
          className={`flashcard__inner ${deck.flipped ? 'flashcard__inner--flipped is-flipped' : ''}`}
          role="button"
          tabIndex={0}
          onClick={deck.flip}
          aria-pressed={deck.flipped}
          aria-label={
            deck.flipped
              ? `Card back for “${card.concept}”. Press to flip to the front.`
              : `Card front: “${card.concept}”. Press to flip to the back.`
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              deck.flip();
            }
          }}
        >
          <div className="flashcard__face flashcard__face--front" aria-hidden={deck.flipped}>
            <span className="flashcard__concept">{card.concept}</span>
          </div>
          <div className="flashcard__face flashcard__face--back" aria-hidden={!deck.flipped}>
            <FlashcardBack card={card} />
          </div>
        </div>
      </div>

      <div className="flashcard-deck__ratings">
        <button
          type="button"
          className={`flashcard-deck__rating flashcard-deck__rating--got ${
            deck.rating === 'got_it' ? 'flashcard-deck__rating--active' : ''
          }`}
          onClick={() => deck.rateCard('got_it')}
        >
          Got it
        </button>
        <button
          type="button"
          className={`flashcard-deck__rating flashcard-deck__rating--needs ${
            deck.rating === 'needs_work' ? 'flashcard-deck__rating--active' : ''
          }`}
          disabled={!deck.flipped && deck.mode !== 'review'}
          onClick={() => deck.rateCard('needs_work')}
        >
          Needs work
        </button>
        <div className="flashcard-deck__rating-status">
          {deck.isSaving && (
            <p className="flashcard-deck__saving" role="status">
              Saving rating…
            </p>
          )}
          {deck.saveError !== undefined && (
            <p className="flashcard-deck__save-error" role="alert">
              A rating could not be saved.{' '}
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={deck.retrySave}
              >
                Try again
              </button>
            </p>
          )}
        </div>
      </div>

      <div className="mission-step-footer">
        <button
          type="button"
          className="button button--ghost"
          disabled={!deck.canGoPrevious}
          onClick={deck.previous}
        >
          Prev
        </button>
        {deck.canGoNext ? (
          <button type="button" className="button button--primary" onClick={deck.next}>
            Next
          </button>
        ) : (
          <button type="button" className="button button--primary" onClick={() => setFinished(true)}>
            Finish deck
          </button>
        )}
      </div>

      <div className="flashcard-deck__footer">
        <DeferredAiAction
          label="Ask the tutor about this card"
          missionId={card.missionId}
          context={{ flashcard: card }}
        />
        <button type="button" className="button button--ghost button--small" onClick={deck.shuffle}>
          Shuffle
        </button>
        <button type="button" className="button button--ghost button--small" onClick={deck.restart}>
          Restart deck
        </button>
      </div>
    </section>
  );
}
