import { useStore } from '../state/store';
import { Dialog } from './Dialog';

/**
 * A reviewer-facing index of every scored capability, each with a one-click jump
 * that opens the right puzzle with the right failure scenario already armed.
 * The goal is that nothing in this submission has to be hunted for.
 */
interface GuideEntry {
  id: string;
  what: string;
  why: string;
  puzzleId: string;
  scenarios: string[];
  /** Extra manual step, when the demonstration needs one. */
  then?: string;
  /** Load the puzzle's verified solution first, so the capability actually fires. */
  useSolution?: boolean;
}

const ENTRIES: GuideEntry[] = [
  {
    id: 'silent-invalid',
    what: 'A run that "succeeds" but ships invalid data',
    why: 'The core lesson: finishing is not the same as being correct.',
    puzzleId: 'meeting-summarizer',
    scenarios: ['sloppy-json'],
    then: 'Run it as-is. Status says completed; the report scores Output integrity 0/20.',
  },
  {
    id: 'validation',
    what: 'Structured-output validation (Zod)',
    why: 'A validator block checks the live payload and changes control flow.',
    puzzleId: 'meeting-summarizer',
    scenarios: ['sloppy-json'],
    useSolution: true,
    then: 'Run. The validator catches unparseable JSON and retries the model.',
  },
  {
    id: 'repair',
    what: 'Automatic repair of invalid output',
    why: 'Retrying cannot fix a defect the model repeats every time; repair can.',
    puzzleId: 'meeting-summarizer',
    scenarios: ['missing-owner'],
    useSolution: true,
    then: 'Run. The trace shows the repair note and the before/after payload.',
  },
  {
    id: 'safe-stop',
    what: 'Refusing safely instead of hallucinating',
    why: 'Empty retrieval routes to a Safe Stop through a condition branch.',
    puzzleId: 'knowledge-assistant',
    scenarios: ['empty-library'],
    useSolution: true,
    then: 'Run. The workflow stops safely; no answer is produced.',
  },
  {
    id: 'condition',
    what: 'Conditional branching',
    why: 'A Condition block with two lanes, and steps skipped on the untaken path.',
    puzzleId: 'knowledge-assistant',
    scenarios: [],
    useSolution: true,
    then: 'Look at the canvas: the ✓/✗ lanes. Run to see which branch is taken and why.',
  },
  {
    id: 'tool-crash',
    what: 'A tool crashing on unvalidated model output',
    why: 'Why validation must sit before the step that consumes the data.',
    puzzleId: 'ticket-router',
    scenarios: ['category-drift'],
    then: 'Run the starting workflow. The router tool fails on an invented category.',
  },
  {
    id: 'confidence',
    what: 'Confidence threshold → human routing',
    why: 'Low-confidence output is gated to a person, not auto-routed.',
    puzzleId: 'ticket-router',
    scenarios: ['wobbly-classifier'],
    useSolution: true,
    then: 'Run. Confidence 0.35 fails the gate and pauses for review.',
  },
  {
    id: 'retry',
    what: 'Retry with a bounded attempt budget',
    why: 'Transient timeouts are absorbed; the trace shows every attempt.',
    puzzleId: 'research-timeout',
    scenarios: ['flaky-network'],
    useSolution: true,
    then: 'Run. Two timeouts, then success on attempt 3.',
  },
  {
    id: 'fallback-tool',
    what: 'Fallback to a different tool on total outage',
    why: 'Retries cannot fix a dead service; a degraded source can.',
    puzzleId: 'research-timeout',
    scenarios: ['journal-outage'],
    useSolution: true,
    then: 'Run. The stale archive cache steps in and is labeled as stale.',
  },
  {
    id: 'human',
    what: 'Human approval: approve, edit, or reject',
    why: 'Every decision, including the note, is recorded in the trace.',
    puzzleId: 'approval-gate',
    scenarios: ['overpromiser'],
    useSolution: true,
    then: 'Run. Try all three buttons across three runs — reject stops the send safely.',
  },
  {
    id: 'ladder',
    what: 'The full escalation ladder in one puzzle',
    why: 'Retry → repair → human, each fixing a defect the previous one cannot.',
    puzzleId: 'data-extractor',
    scenarios: ['fence-glitch', 'word-numbers', 'amnesia'],
    useSolution: true,
    then: 'Run. When the human-fix modal opens, paste s.ito@brightleaf.example.',
  },
  {
    id: 'fallback-model',
    what: 'Fallback to a different model',
    why: 'A smaller model that answers beats a better model that is down.',
    puzzleId: 'fallback-drill',
    scenarios: ['atlas-outage'],
    useSolution: true,
    then: 'Run. Three failed Atlas attempts, then Pocket-7B answers and still validates.',
  },
  {
    id: 'resume',
    what: 'Checkpoint and resume from the last successful step',
    why: 'An interruption becomes a pause, not a restart.',
    puzzleId: 'resume-mission',
    scenarios: ['solar-flare'],
    useSolution: true,
    then: 'Run (it is interrupted), then press 💾 Resume. Restored steps are not re-run.',
  },
];

export function ReviewerGuide() {
  const open = useStore((s) => s.guideOpen);
  const setGuideOpen = useStore((s) => s.setGuideOpen);
  const jumpTo = useStore((s) => s.jumpTo);

  if (!open) return null;

  return (
    <Dialog titleId="guide-title" className="guide-modal" onClose={() => setGuideOpen(false)}>
      <h3 id="guide-title">🧭 Reviewer guide</h3>
        <p className="muted">
          Every capability this submission claims, with a one-click jump that opens the right puzzle and arms the right
          failure scenario. Each jump loads a known-good workflow where one is needed, so you can press{' '}
          <strong>▶ Run workflow</strong> immediately.
        </p>
        <p className="muted small">
          Everything below runs offline in mock AI mode — no key, no account, no network.
        </p>

        <ol className="guide-list">
          {ENTRIES.map((e) => (
            <li key={e.id}>
              <div className="guide-text">
                <strong>{e.what}</strong>
                <span className="muted small">{e.why}</span>
                {e.then && <span className="guide-then">→ {e.then}</span>}
              </div>
              <button
                type="button"
                className="guide-jump"
                onClick={() => {
                  jumpTo(e.puzzleId, e.scenarios, e.useSolution ?? false);
                  setGuideOpen(false);
                }}
              >
                Show me
              </button>
            </li>
          ))}
        </ol>

        <div className="modal-actions">
          <button type="button" onClick={() => setGuideOpen(false)}>
            Close
          </button>
        </div>
    </Dialog>
  );
}
