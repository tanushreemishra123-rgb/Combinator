import type { AiProviderSafeError } from '@ai-learning-adventure/types';
import type { ReactNode } from 'react';
import { AiMockNotice } from '../../ai-provider/components/AiMockNotice.tsx';
import { AiRequestErrorCard } from '../../ai-provider/components/AiRequestErrorCard.tsx';

export interface AiResultCardProps {
  title: string;
  text?: string;
  isMock?: boolean;
  busy?: boolean;
  children?: ReactNode;
  actions?: ReactNode;
  providerError?: AiProviderSafeError;
}

export function AiResultCard({ title, text, isMock = false, busy = false, children, actions, providerError }: AiResultCardProps) {
  return (
    <section className={`ai-result-card${isMock ? ' ai-result-card--mock' : ''}`} aria-label={title} aria-busy={busy}>
      {providerError !== undefined && <AiRequestErrorCard error={providerError} />}
      <div className="ai-result-card__header">
        <h3>{title}</h3>
        {isMock && <AiMockNotice compact />}
      </div>
      {text !== undefined && <p className="ai-result-card__text">{text}</p>}
      {children}
      {actions !== undefined && <div className="ai-result-card__actions">{actions}</div>}
      {isMock && <AiMockNotice showBadge={false} />}
      <p className="ai-disclaimer">AI can make mistakes — check the mission content.</p>
    </section>
  );
}
