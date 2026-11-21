import { useEffect } from 'react';
import type { MissionDetail } from '@ai-learning-adventure/types';
import { useFocusReturn } from '../../../hooks/ui/useFocusReturn.ts';
import type { UseAiOnlyQuickActionsResult } from '../hooks/useAiOnlyQuickActions.ts';
import { QuestionSelectDropdown } from './QuestionSelectDropdown.tsx';

export interface AiOnlyPickerProps {
  quickActions: UseAiOnlyQuickActionsResult;
  missions: MissionDetail[];
}

const PICKER_TITLES = {
  hint: 'Choose a question for your hint',
  summary: 'Choose a mission to summarize',
  review: 'Share an answer for coaching',
} as const;

export function AiOnlyPicker({ quickActions, missions }: AiOnlyPickerProps) {
  const picker = quickActions.picker;
  const open = picker !== undefined;
  const triggerId = picker !== undefined ? `ai-only-action-${picker.kind}` : undefined;
  const { overlayRef } = useFocusReturn<HTMLDivElement>({
    open,
    triggerId,
    trapFocus: true,
  });

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') quickActions.closePicker();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, quickActions]);

  if (picker === undefined) return null;
  const mission = missions.find((candidate) => candidate.id === picker.missionId);
  const questions = mission?.questions ?? [];
  const submitLabel =
    picker.kind === 'hint'
      ? 'Get hint'
      : picker.kind === 'summary'
        ? 'Create summary'
        : 'Get feedback';

  return (
    <div className="ai-only-picker-backdrop" onMouseDown={quickActions.closePicker}>
      <div
        ref={overlayRef}
        className="ai-only-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-only-picker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ai-only-picker__header">
          <div>
            <p className="ai-eyebrow">Quick action</p>
            <h2 id="ai-only-picker-title">{PICKER_TITLES[picker.kind] /* nosemgrep: gitlab.eslint.detect-object-injection */}</h2>
          </div>
          <button type="button" className="button button--ghost button--small" onClick={quickActions.closePicker}>
            Close
          </button>
        </div>
        <label>
          Mission
          <select
            value={picker.missionId ?? ''}
            onChange={(event) => {
              const nextMission = missions.find((candidate) => candidate.id === event.target.value);
              quickActions.updatePicker({
                missionId: nextMission?.id,
                questionId: picker.kind === 'summary' ? undefined : nextMission?.questions[0]?.id,
              });
            }}
          >
            <option value="" disabled>Choose a mission</option>
            {missions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.title}</option>
            ))}
          </select>
        </label>
        {picker.kind !== 'summary' && (
          <QuestionSelectDropdown
            id="ai-only-picker-question"
            label="Question"
            value={picker.questionId}
            questions={questions}
            placeholder="Choose a question"
            onChange={(nextQuestionId) => {
              quickActions.updatePicker({ questionId: nextQuestionId });
            }}
          />
        )}
        {picker.kind === 'review' && (
          <label>
            Your answer or reasoning
            <textarea
              aria-label="Your answer or reasoning"
              rows={5}
              value={picker.answer}
              maxLength={2000}
              onChange={(event) => quickActions.updatePicker({ answer: event.target.value })}
              placeholder="Write what you think and why…"
            />
            <span className="ai-only-picker__counter">{picker.answer.length} / 2000</span>
          </label>
        )}
        {picker.error !== undefined && <p className="ai-only-picker__error" role="alert">{picker.error}</p>}
        <div className="ai-only-picker__actions">
          <button type="button" className="button button--ghost" onClick={quickActions.closePicker}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={quickActions.busy}
            onClick={() => void quickActions.submitPicker()}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
