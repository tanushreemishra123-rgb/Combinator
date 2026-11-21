import { AiResultCard } from './AiResultCard.tsx';
import type { AiProviderSafeError } from '@ai-learning-adventure/types';

export interface HintPanelProps {
  hints: string[];
  isMock: boolean;
  busy: boolean;
  canRequestMore: boolean;
  onRequestHint: () => void;
  providerError?: AiProviderSafeError;
}

export function HintPanel({ hints, isMock, busy, canRequestMore, onRequestHint, providerError }: HintPanelProps) {
  if (hints.length === 0 && !busy) return null;
  return (
    <AiResultCard title={`Hint${hints.length > 0 ? ` ${hints.length} of 3` : ''}`} isMock={isMock} busy={busy} providerError={providerError}>
      {busy && <p className="ai-result-card__text">Thinking of a safe nudge…</p>}
      {hints.map((hint, index) => (
        <p key={`${index}-${hint}`} className="ai-hint-text">
          <strong>Hint {index + 1}:</strong> {hint}
        </p>
      ))}
      {canRequestMore && !busy && (
        <button type="button" className="button button--ghost button--small" onClick={onRequestHint}>
          Need another hint
        </button>
      )}
      {!canRequestMore && !busy && <p className="ai-result-card__meta">Submit your best guess — I’ll explain after.</p>}
    </AiResultCard>
  );
}
