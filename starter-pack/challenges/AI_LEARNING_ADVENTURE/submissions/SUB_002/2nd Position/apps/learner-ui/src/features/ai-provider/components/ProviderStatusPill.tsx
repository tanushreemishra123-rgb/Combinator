import type { AiProviderConnectionStatus } from '@ai-learning-adventure/types';

const STATUS_LABELS: Record<AiProviderConnectionStatus, string> = {
  unknown: 'Not tested',
  not_configured: 'Not configured',
  testing: 'Testing',
  connected: 'Connected',
  mock: 'Mock mode',
  error: 'Error',
};

export function ProviderStatusPill({ status }: { status: AiProviderConnectionStatus }) {
  return (
    <span className={`ai-provider-status ai-provider-status--${status}`}>
      {STATUS_LABELS[status] /* nosemgrep: gitlab.eslint.detect-object-injection */}
    </span>
  );
}
