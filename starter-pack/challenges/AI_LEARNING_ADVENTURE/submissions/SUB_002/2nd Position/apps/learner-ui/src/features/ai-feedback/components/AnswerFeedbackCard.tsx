import type { AiProviderSafeError, WrittenFeedbackModel } from '@ai-learning-adventure/types';
import { AiResultCard } from './AiResultCard.tsx';

export interface AnswerFeedbackCardProps {
  text?: string;
  writtenFeedback?: WrittenFeedbackModel;
  isMock: boolean;
  busy: boolean;
  onExplain: () => void;
  onSimpler: () => void;
  onExample: () => void;
  written?: boolean;
  outcome?: 'correct' | 'incorrect';
  providerError?: AiProviderSafeError;
}

export function AnswerFeedbackCard({
  text,
  writtenFeedback,
  isMock,
  busy,
  onExplain,
  onSimpler,
  onExample,
  written = false,
  outcome,
  providerError,
}: AnswerFeedbackCardProps) {
  if (text === undefined && writtenFeedback === undefined && !busy) {
    return (
      <div className="ai-feedback-actions">
        <button type="button" className="button button--ghost button--small" onClick={onExplain}>
          {written ? 'Get AI feedback' : outcome === 'correct' ? 'Why is this right?' : 'Why was I wrong?'}
        </button>
      </div>
    );
  }
  return (
    <AiResultCard title={written ? 'AI coaching feedback' : 'AI explanation'} isMock={isMock} busy={busy} text={busy ? 'Thinking…' : undefined} providerError={providerError}>
      {writtenFeedback !== undefined ? (
        <div className="ai-written-feedback">
          <div><strong>What you got right</strong><p>{writtenFeedback.strengths}</p></div>
          <div><strong>What’s missing</strong><p>{writtenFeedback.missing}</p></div>
          <div><strong>One improvement</strong><p>{writtenFeedback.improvement}</p></div>
          <div><strong>Encouragement</strong><p>{writtenFeedback.encouragement}</p></div>
        </div>
      ) : text !== undefined ? (
        <p className="ai-result-card__text">{text}</p>
      ) : null}
      <div className="ai-result-card__actions">
        <button type="button" className="button button--ghost button--small" disabled={busy} onClick={onSimpler}>
          Explain more simply
        </button>
        <button type="button" className="button button--ghost button--small" disabled={busy} onClick={onExample}>
          Show me an example
        </button>
      </div>
    </AiResultCard>
  );
}
