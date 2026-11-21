import { useMemo, useState } from 'react';
import { getKit } from '../puzzles';
import { useStore } from '../state/store';
import { validateAgainst } from '../engine/validation';
import { Json } from './common';
import { Dialog } from './Dialog';

export function HumanReviewModal() {
  const gate = useStore((s) => s.humanGate);
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const submitHuman = useStore((s) => s.submitHuman);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const prompt = gate?.prompt;

  const schema = useMemo(() => {
    if (!prompt?.schemaId || !puzzleId) return null;
    return getKit(puzzleId).schema(prompt.schemaId);
  }, [prompt?.schemaId, puzzleId]);

  const parsedDraft = useMemo(() => {
    if (!editing) return { ok: true as const, value: undefined, issues: [] as string[] };
    try {
      const value = JSON.parse(draft);
      if (schema) {
        const verdict = validateAgainst(schema.schema, value);
        return { ok: verdict.ok, value, issues: verdict.issues };
      }
      return { ok: true as const, value, issues: [] };
    } catch {
      return { ok: false as const, value: undefined, issues: ['Not valid JSON yet — fix the syntax to continue.'] };
    }
  }, [editing, draft, schema]);

  if (!gate || !prompt) return null;

  const startEditing = () => {
    setDraft(JSON.stringify(prompt.payload, null, 2));
    setEditing(true);
    setRejecting(false);
  };

  const reset = () => {
    setEditing(false);
    setRejecting(false);
    setDraft('');
    setNote('');
  };

  return (
    <Dialog titleId="human-title" className="human-modal" dismissible={false} onClose={() => undefined}>
      <h3 id="human-title">
        {prompt.mode === 'fix' ? '🚨' : '🙋'} {prompt.title}
      </h3>
        <p className="muted">{prompt.instructions}</p>
        <p className="muted small">Paused at: <strong>{prompt.stepLabel}</strong> — the workflow waits for your decision and records it in the trace.</p>

        {prompt.issues && prompt.issues.length > 0 && (
          <div className="issue-box">
            <strong>Validation issues</strong>
            <ul>
              {prompt.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}

        {!editing && (
          <div className="payload-review">
            <span className="field-label">Payload under review</span>
            <Json value={prompt.payload} maxHeight={260} />
          </div>
        )}

        {editing && (
          <div className="payload-edit">
            <span className="field-label">Edit the payload (JSON)</span>
            <textarea value={draft} rows={12} spellCheck={false} onChange={(e) => setDraft(e.target.value)} />
            {schema && (
              <p className="muted small">Must satisfy: {schema.name} — {schema.rules.join(' · ')}</p>
            )}
            {!parsedDraft.ok && (
              <ul className="issue-list">
                {parsedDraft.issues.map((i) => (
                  <li key={i}>🚫 {i}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <label className="field">
          <span className="field-label">Note (recorded with your decision)</span>
          <input type="text" value={note} placeholder="optional — why you decided this" onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="modal-actions">
          {prompt.mode === 'approval' && !editing && (
            <button
              type="button"
              className="btn-approve"
              onClick={() => {
                submitHuman({ action: 'approve', note: note || undefined });
                reset();
              }}
            >
              ✅ Approve & continue
            </button>
          )}
          {prompt.allowEdit && !editing && (
            <button type="button" onClick={startEditing}>
              ✏️ Edit payload
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                className="btn-approve"
                disabled={!parsedDraft.ok}
                onClick={() => {
                  submitHuman({ action: 'edit', payload: parsedDraft.value, note: note || undefined });
                  reset();
                }}
              >
                ✅ Save edit & continue
              </button>
              <button type="button" onClick={() => setEditing(false)}>
                Cancel edit
              </button>
            </>
          )}
          {!rejecting ? (
            <button type="button" className="btn-reject" onClick={() => setRejecting(true)}>
              🛑 Reject…
            </button>
          ) : (
            <button
              type="button"
              className="btn-reject confirm"
              onClick={() => {
                submitHuman({ action: 'reject', note: note || undefined });
                reset();
              }}
            >
              🛑 Confirm reject — stop the workflow safely
            </button>
          )}
        </div>
    </Dialog>
  );
}
