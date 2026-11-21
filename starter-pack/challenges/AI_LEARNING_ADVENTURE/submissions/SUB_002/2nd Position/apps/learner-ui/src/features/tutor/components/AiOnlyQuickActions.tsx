import type {
  AiOnlyQuickActionId,
  UseAiOnlyQuickActionsResult,
} from '../hooks/useAiOnlyQuickActions.ts';

export interface AiOnlyQuickActionsProps {
  quickActions: UseAiOnlyQuickActionsResult;
  welcome?: boolean;
}

const ACTION_NOTES: Record<AiOnlyQuickActionId, string> = {
  explain: 'Plain language',
  example: 'Make it concrete',
  hint: 'Nudge, not answer',
  summary: 'Key takeaways',
  recommend: 'Use my progress',
  review: 'Coach my response',
};

export function AiOnlyQuickActions({ quickActions, welcome = false }: AiOnlyQuickActionsProps) {
  return (
    <div
      className={`ai-only-quick-actions${welcome ? ' ai-only-quick-actions--welcome' : ''}`}
      aria-label="AI Only Mode quick actions"
    >
      {quickActions.actions.map((action) => (
        <button
          key={action.id}
          id={`ai-only-action-${action.id}`}
          type="button"
          className="ai-only-action-chip"
          aria-label={action.label}
          disabled={quickActions.busy}
          onClick={() => quickActions.run(action.id)}
        >
          <strong>{action.label}</strong>
          {welcome && <span>{ACTION_NOTES[action.id] /* nosemgrep: gitlab.eslint.detect-object-injection */}</span>}
        </button>
      ))}
    </div>
  );
}
