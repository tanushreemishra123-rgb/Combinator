import { getKit } from '../puzzles';
import { EMPTY_STEPS, EMPTY_STRINGS, useStore } from '../state/store';
import { hashWorkflow } from '../engine/util';
import { Collapsible, Json } from './common';

/** `hidePrimaryRun` drops the big Run button when the mobile tab bar already offers one. */
export function RunPanel({ hidePrimaryRun = false }: { hidePrimaryRun?: boolean }) {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const running = useStore((s) => s.running);
  const scenariosOn = useStore((s) => (puzzleId ? (s.scenariosOn[puzzleId] ?? EMPTY_STRINGS) : EMPTY_STRINGS));
  const checkpoint = useStore((s) => (puzzleId ? s.checkpoints[puzzleId] : undefined));
  const workflow = useStore((s) => (s.screen.name === 'puzzle' ? s.progress[s.screen.puzzleId].workflow : EMPTY_STEPS));
  const settings = useStore((s) => s.settings);
  const toggleScenario = useStore((s) => s.toggleScenario);
  const run = useStore((s) => s.run);
  const abortRun = useStore((s) => s.abortRun);
  const updateSettings = useStore((s) => s.updateSettings);
  const humanGate = useStore((s) => s.humanGate);

  if (!puzzleId) return null;
  const kit = getKit(puzzleId);
  const puzzle = kit.puzzle;
  const sample = puzzle.samples[0];
  const resumable = checkpoint && checkpoint.workflowHash === hashWorkflow(workflow);
  const live = settings.liveEnabled && settings.apiKey.trim().length > 0;

  return (
    <div className="run-panel">
      <div className="run-controls">
        {!hidePrimaryRun && (
          <button type="button" className="btn-run" onClick={() => run(false)} disabled={running}>
            {running ? (humanGate ? '⏸️ Paused for human…' : '⏳ Running…') : '▶ Run workflow'}
          </button>
        )}
        {resumable && !running && (
          <button type="button" className="btn-resume" onClick={() => run(true)} title="Continue from the saved checkpoint — completed steps are restored, not re-run.">
            💾 Resume from last successful step
          </button>
        )}
        {running && !humanGate && (
          <button type="button" className="btn-abort" onClick={abortRun}>
            ⏹ Abort
          </button>
        )}
        <label className="pace-toggle" title="Demo pace animates each step; instant pace runs the whole workflow immediately.">
          <input
            type="checkbox"
            checked={settings.pace === 'instant'}
            onChange={(e) => updateSettings({ pace: e.target.checked ? 'instant' : 'demo' })}
          />
          ⚡ instant pace
        </label>
        <span className={`mode-chip ${live ? 'live' : 'mock'}`} title={live ? 'AI steps call the configured live provider.' : 'All model calls are deterministic local mocks — no network, no keys.'}>
          {live ? '⚡ LIVE AI' : '🧪 MOCK AI'}
        </span>
      </div>

      <div className="chaos-box">
        <h4>💥 Failure scenarios</h4>
        <p className="muted small">Deterministic chaos — every scenario reproduces the same way on every run.</p>
        {puzzle.failureScenarios.map((sc) => (
          <label key={sc.id} className={`chaos-toggle ${scenariosOn.includes(sc.id) ? 'on' : ''}`}>
            <input
              type="checkbox"
              checked={scenariosOn.includes(sc.id)}
              disabled={running}
              onChange={() => toggleScenario(sc.id)}
            />
            <span className="chaos-emoji">{sc.emoji}</span>
            <span className="chaos-text">
              <strong>{sc.name}</strong>
              <span>{sc.description}</span>
            </span>
          </label>
        ))}
      </div>

      <Collapsible summary={`📥 Sample input — ${sample.label}`}>
        <Json value={sample.value} maxHeight={200} />
      </Collapsible>

      {checkpoint && !resumable && (
        <p className="muted small">💾 A checkpoint exists, but the workflow changed since it was saved — run fresh to replace it.</p>
      )}
    </div>
  );
}
