import { useRef } from 'react';

export interface TutorComposerProps {
  draft: string;
  busy: boolean;
  disabled?: boolean;
  canClear?: boolean;
  scopeLabel: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  onStop: () => void;
  onClear?: () => void;
}

export function TutorComposer({
  draft,
  busy,
  disabled = false,
  canClear = true,
  scopeLabel,
  onDraftChange,
  onSend,
  onStop,
  onClear,
}: TutorComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <div className="ai-only-composer">
      <label htmlFor="ai-only-composer-input">Ask about {scopeLabel}</label>
      <div className="ai-only-composer__field">
        <textarea
          ref={textareaRef}
          id="ai-only-composer-input"
          rows={2}
          value={draft}
          maxLength={4000}
          placeholder="Ask a question, test an idea, or request a different explanation…"
          disabled={disabled}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!busy && draft.trim().length > 0) onSend();
            }
          }}
        />
        <div className="ai-only-composer__actions">
          {busy && <button type="button" className="button button--ghost button--small" onClick={onStop}>Stop</button>}
          {onClear !== undefined && (
            <button
              type="button"
              className="button button--ghost button--small ai-only-composer__clear"
              disabled={disabled || busy || !canClear}
              onClick={onClear}
            >
              Clear
            </button>
          )}
          <button type="button" className="button button--primary ai-only-composer__send" disabled={disabled || busy || draft.trim().length === 0} onClick={onSend}>
            Send <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>
      <p>Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}
