import { useEffect } from 'react';
import type { Flashcard } from '@ai-learning-adventure/types';
import { useFocusReturn } from '../../../hooks/ui/useFocusReturn.ts';

export interface KeyTermPopoverProps {
  term: string;
  flashcard?: Flashcard;
  onClose: () => void;
  onOpenDeck: () => void;
}

export function KeyTermPopover({ term, flashcard, onClose, onOpenDeck }: KeyTermPopoverProps) {
  const { overlayRef } = useFocusReturn<HTMLDivElement>({ open: true, trapFocus: true });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="key-term-overlay" role="presentation" onClick={onClose}>
      <div
        ref={overlayRef}
        className="key-term-popover"
        role="dialog"
        aria-modal="true"
        aria-label={`Flashcard for ${term}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="key-term-popover__header">
          <h3 className="key-term-popover__term">
            {flashcard?.concept ?? term}
          </h3>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {flashcard !== undefined ? (
          <div className="key-term-popover__body">
            <p>{flashcard.definition}</p>
            <p className="key-term-popover__example">Example: {flashcard.example}</p>
            {flashcard.commonMistake !== undefined && (
              <p className="key-term-popover__mistake">Watch out: {flashcard.commonMistake}</p>
            )}
            {flashcard.learningTip !== undefined && (
              <p className="key-term-popover__tip">Tip: {flashcard.learningTip}</p>
            )}
          </div>
        ) : (
          <p>The flashcard for this term is being prepared.</p>
        )}
        <button type="button" className="button button--secondary button--small" onClick={onOpenDeck}>
          Open the full deck
        </button>
      </div>
    </div>
  );
}
