import type { AiProviderSafeError } from '@ai-learning-adventure/types';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';

export function AiRequestErrorCard({
  error,
  onRetry,
}: {
  error: AiProviderSafeError;
  onRetry?: () => void;
}) {
  const { navigate } = useAppNavigation();
  return (
    <aside className="ai-request-error" role="alert">
      <strong>Live AI was unavailable.</strong>
      <p>{error.message}</p>
      <div className="ai-request-error__actions">
        {onRetry !== undefined && (
          <button type="button" className="button button--secondary button--small" onClick={onRetry}>
            Try again
          </button>
        )}
        <button type="button" className="button button--ghost button--small" onClick={() => navigate({ kind: 'settings' })}>
          Open AI settings
        </button>
      </div>
    </aside>
  );
}
