import { getPuzzle } from '../puzzles';
import { useStore } from '../state/store';

export function GoalsPanel() {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const progress = useStore((s) => (puzzleId ? s.progress[puzzleId] : null));
  const revealHint = useStore((s) => s.revealHint);
  const revealSolution = useStore((s) => s.revealSolution);
  const running = useStore((s) => s.running);

  if (!puzzleId || !progress) return null;
  const puzzle = getPuzzle(puzzleId);
  const met = new Set(progress.criteriaMet);
  const allHints = progress.hintsRevealed >= puzzle.hints.length;

  return (
    <div className="goals">
      <div className="goals-objective">
        <h4>🎯 Objective</h4>
        <p>{puzzle.objective}</p>
        <p className="muted small">
          <strong>Expected result:</strong> {puzzle.expected.description}
        </p>
      </div>

      <div className="goals-criteria">
        <h4>
          🏆 Completion goals ({progress.criteriaMet.length}/{puzzle.criteria.length})
        </h4>
        {puzzle.criteria.map((c) => (
          <div key={c.id} className={`criterion ${met.has(c.id) ? 'met' : ''}`}>
            <span className="criterion-mark">{met.has(c.id) ? '✅' : '⬜'}</span>
            <div>
              <strong>{c.label}</strong>
              <p className="muted small">{c.detail}</p>
            </div>
          </div>
        ))}
        {progress.solvedAt && <p className="solved-note">🎉 Puzzle solved! Try the next one, or keep experimenting.</p>}
      </div>

      <div className="goals-learning">
        <h4>🧠 What this puzzle teaches</h4>
        <ul>
          {puzzle.learning.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      <div className="goals-hints">
        <h4>💡 Hints</h4>
        {puzzle.hints.slice(0, progress.hintsRevealed).map((h, i) => (
          <p key={i} className="hint">
            <strong>Hint {i + 1}.</strong> {h}
          </p>
        ))}
        <div className="hint-buttons">
          {!allHints && (
            <button type="button" onClick={revealHint}>
              Reveal hint {progress.hintsRevealed + 1} of {puzzle.hints.length}
            </button>
          )}
          {allHints && (
            <button type="button" onClick={revealSolution} disabled={running}>
              🗝️ Apply a known-good setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
