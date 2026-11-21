import { AiResultCard } from './AiResultCard.tsx';
import type { AiProviderSafeError } from '@ai-learning-adventure/types';

export interface SummaryCardProps {
  title?: string;
  items: Array<{ text: string; concept?: string }>;
  isMock: boolean;
  busy: boolean;
  copied: boolean;
  addedToReview: boolean;
  onRequest: () => void;
  onCopy: () => void;
  onAddToReview: () => void;
  providerError?: AiProviderSafeError;
}

export function SummaryCard({
  title = 'Key takeaways',
  items,
  isMock,
  busy,
  copied,
  addedToReview,
  onRequest,
  onCopy,
  onAddToReview,
  providerError,
}: SummaryCardProps) {
  if (items.length === 0 && !busy) {
    return (
      <button type="button" className="button button--ghost button--small" onClick={onRequest}>
        Summarize
      </button>
    );
  }
  return (
    <AiResultCard title={title} isMock={isMock} busy={busy} text={busy ? 'Building a grounded recap…' : undefined} providerError={providerError}>
      {!busy && (
        <ul className="ai-summary-list">
          {items.map((item) => <li key={`${item.concept ?? 'item'}-${item.text}`}>{item.text}</li>)}
        </ul>
      )}
      {!busy && (
        <div className="ai-result-card__actions">
          <button type="button" className="button button--ghost button--small" onClick={onCopy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="button button--ghost button--small" disabled={addedToReview} onClick={onAddToReview}>
            {addedToReview ? 'Added to review' : 'Add to review'}
          </button>
        </div>
      )}
    </AiResultCard>
  );
}
