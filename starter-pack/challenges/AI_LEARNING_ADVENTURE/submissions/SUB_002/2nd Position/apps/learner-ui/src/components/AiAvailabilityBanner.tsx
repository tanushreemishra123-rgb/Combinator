import { useAppNavigation } from '../hooks/useAppNavigation.ts';
import { useAiAvailability } from '../features/ai-provider/hooks/useAiAvailability.ts';

export function AiAvailabilityBanner() {
  const availability = useAiAvailability();
  const { navigate } = useAppNavigation();
  if (!availability.showBanner) return null;
  return (
    <div className={`ai-availability-banner ai-availability-banner--${availability.status}`} role="status" tabIndex={0}>
      <span><strong>{availability.bannerMessage}</strong></span>
      <div className="ai-availability-banner__actions">
        <button id="ai-banner-setup" type="button" onClick={() => navigate({ kind: 'settings' })}>Set up AI</button>
        <button type="button" onClick={availability.dismissForSession}>Dismiss</button>
      </div>
    </div>
  );
}
