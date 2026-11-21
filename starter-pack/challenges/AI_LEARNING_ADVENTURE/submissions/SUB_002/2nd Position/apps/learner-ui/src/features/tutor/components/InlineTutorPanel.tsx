import { useEffect, useRef, useState } from 'react';
import type { AiContextPacket } from '@ai-learning-adventure/types';
import { useFocusReturn } from '../../../hooks/ui/useFocusReturn.ts';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import {
  closeTutor,
  selectInlineTutorMissionId,
  selectInlineTutorOpen,
  selectInlineTutorTriggerId,
  selectTutorContext,
} from '../../../store/aiSlice.ts';
import {
  selectExplainLikeNew,
  selectExplanationLevelOverride,
  setExplainLikeNew,
  setExplanationLevel,
} from '../../../store/preferencesSlice.ts';
import { useTutor } from '../hooks/useTutor.ts';
import { explanationLevelForTrack } from '@ai-learning-adventure/learner';
import { useAiAvailability } from '../../ai-provider/hooks/useAiAvailability.ts';
import { AiMockNotice } from '../../ai-provider/components/AiMockNotice.tsx';
import { AiRequestErrorCard } from '../../ai-provider/components/AiRequestErrorCard.tsx';

function ContextChip({ context }: { context: AiContextPacket }) {
  if (context.checkpoint !== undefined) {
    return <span className="ai-context-chip">Checkpoint · {context.mission?.title ?? 'Learning content'}</span>;
  }
  if (context.question !== undefined) {
    return <span className="ai-context-chip">Quiz question</span>;
  }
  if (context.flashcard !== undefined) {
    return <span className="ai-context-chip">Flashcard: {context.flashcard.concept}</span>;
  }
  if (context.progress !== undefined && context.mission === undefined) {
    return <span className="ai-context-chip">Weak topics</span>;
  }
  const stepLabel = context.step !== undefined ? ` · ${context.step}` : '';
  return <span className="ai-context-chip">{context.mission?.title ?? 'Learning content'}{stepLabel}</span>;
}

export function InlineTutorPanel() {
  const availability = useAiAvailability();
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectInlineTutorOpen);
  const context = useAppSelector(selectTutorContext);
  const missionId = useAppSelector(selectInlineTutorMissionId);
  const triggerId = useAppSelector(selectInlineTutorTriggerId);
  const explainLikeNew = useAppSelector(selectExplainLikeNew);
  const explanationLevelOverride = useAppSelector(selectExplanationLevelOverride);
  const explanationPreference = explainLikeNew
    ? 'simple'
    : explanationLevelOverride ?? explanationLevelForTrack(context?.mission?.levelTrack ?? 'beginner');
  const tutor = useTutor({ missionId, context });
  const [draft, setDraft] = useState('');
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { overlayRef } = useFocusReturn<HTMLDivElement>({
    open,
    triggerId,
    trapFocus: true,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [tutor.messages]);

  useEffect(() => {
    if (open) composerRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape' && open) dispatch(closeTutor());
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dispatch, open]);

  if (!open) return null;

  async function send(): Promise<void> {
    const message = draft.trim();
    if (message.length === 0) return;
    setDraft('');
    await tutor.send(message);
  }

  return (
    <div className="ai-panel-backdrop">
      <div
        ref={overlayRef}
        className="ai-tutor-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-tutor-panel-title"
      >
        <header className="ai-tutor-panel__header">
          <div>
            <p className="ai-eyebrow">Inline learning support</p>
            <h2 id="ai-tutor-panel-title">AI Tutor</h2>
            <ContextChip context={context ?? {}} />
          </div>
          <button type="button" className="button button--ghost button--small" onClick={() => dispatch(closeTutor())}>
            Close
          </button>
        </header>
        {!availability.isLive && <p className="ai-availability-notice">{availability.inlineMessage}</p>}

        <label className="ai-tutor-panel__toggle">
          <input
            type="checkbox"
            checked={explainLikeNew}
            onChange={(event) => dispatch(setExplainLikeNew(event.target.checked))}
          />
          Explain like I’m new to this
        </label>
        <fieldset className="ai-level-control">
          <legend>Explanation level</legend>
          {(['simple', 'standard', 'deeper'] as const).map((level) => (
            <label key={level}>
              <input
                type="radio"
                name="ai-explanation-level"
                value={level}
                checked={explanationPreference === level}
                onChange={() => {
                  dispatch(setExplainLikeNew(false));
                  dispatch(setExplanationLevel(level));
                }}
              />
              {level[0]?.toUpperCase()}{level.slice(1)}
            </label>
          ))}
        </fieldset>

        <div className="ai-tutor-panel__messages" aria-live="polite" aria-atomic="false">
          {tutor.messages.length === 0 && (
            <p className="ai-tutor-panel__empty">
              Ask about the current learning content. I can explain, give an example, or help you find a safe next step.
            </p>
          )}
          {tutor.messages.map((message) => (
            <article key={message.id} className={`ai-message ai-message--${message.role}${message.isMock ? ' ai-message--mock' : ''}`}>
              <p className="ai-message__role">{message.role === 'assistant' ? 'AI Tutor' : 'You'}</p>
              {message.providerError !== undefined && <AiRequestErrorCard error={message.providerError} />}
              <p className="ai-message__text">{message.text || 'Thinking…'}</p>
              {message.isMock && <AiMockNotice />}
              {message.safety?.redirected && (
                <p className="ai-message__meta">I’m keeping this conversation focused on the available learning content.</p>
              )}
              {message.safety?.uncertain && (
                <p className="ai-message__meta">I’m not certain about everything here. Check the mission source above.</p>
              )}
              {message.status === 'stopped' && <p className="ai-message__meta">Response stopped.</p>}
            </article>
          ))}
          <div ref={messagesEndRef} className="ai-tutor-panel__messages-end" aria-hidden="true" />
        </div>

        <div className="ai-quick-actions" aria-label="Tutor quick actions">
          {tutor.quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="button button--ghost button--small"
              disabled={tutor.busy}
              onClick={() => void tutor.send(action.message, action.id === 'summary' ? 'summary' : action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="ai-tutor-panel__composer">
          <label htmlFor="ai-tutor-composer">Ask the tutor</label>
          <textarea
            ref={composerRef}
            id="ai-tutor-composer"
            rows={3}
            value={draft}
            placeholder="Ask about this learning content…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="ai-tutor-panel__composer-actions">
            {tutor.busy ? (
              <button type="button" className="button button--ghost" onClick={tutor.stop}>
                Stop
              </button>
            ) : (
              <span />
            )}
            <div className="ai-tutor-panel__action-group">
              <button
                type="button"
                className="button button--ghost"
                disabled={tutor.busy || tutor.messages.length === 0}
                onClick={tutor.clear}
              >
                Clear
              </button>
              <button
                type="button"
                className="button button--primary"
                disabled={tutor.busy || draft.trim().length === 0}
                onClick={() => void send()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
        <p className="ai-disclaimer">AI can make mistakes — check key facts against the mission content.</p>
      </div>
    </div>
  );
}
