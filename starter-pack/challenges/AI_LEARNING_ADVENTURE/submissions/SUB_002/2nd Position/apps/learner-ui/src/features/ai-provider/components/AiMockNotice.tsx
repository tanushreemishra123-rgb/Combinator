import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';

export function AiMockNotice({
  compact = false,
  showBadge = true,
}: {
  compact?: boolean;
  showBadge?: boolean;
}) {
  const { navigate } = useAppNavigation();
  return (
    <div className={`ai-mock-notice${compact ? ' ai-mock-notice--compact' : ''}`}>
      {showBadge && <span className="ai-sample-badge">Sample / mock AI response</span>}
      {!compact && (
        <span className="ai-mock-notice__caption">
          Configure AI for personalized answers.
          <button type="button" onClick={() => navigate({ kind: 'settings' })}>Set up AI</button>
        </span>
      )}
    </div>
  );
}
