import { useStore } from '../state/store';
import { Collapsible, Json } from './common';

export function ReportPanel() {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const report = useStore((s) => (puzzleId ? s.reports[puzzleId] : undefined));
  const scored = useStore((s) => (puzzleId ? s.scored[puzzleId] : undefined));

  if (!puzzleId) return null;
  if (!report || !scored) {
    return <p className="muted pad">Finish a run to get its reliability report: what survived, what recovered, and what is still fragile.</p>;
  }

  const a = scored.assessment;
  const previous = scored.previousScore;
  const delta = previous !== undefined ? a.score - previous : 0;

  return (
    <div className="report">
      <div className="report-score">
        <div className={`score-dial ${delta > 0 ? 'improved' : ''}`}>
          <span className="score-number">{a.score}</span>
          <span className="score-max">/100</span>
        </div>
        <div className="score-verdict">
          <span className="verdict-emoji">{a.emoji}</span>
          <span className="verdict-text">{a.verdict}</span>
          {previous !== undefined && previous !== a.score && (
            <span className={`score-delta ${delta > 0 ? 'up' : 'down'}`}>
              {previous} → {a.score} ({delta > 0 ? '+' : ''}{delta}) since your last run
            </span>
          )}
          <span className="muted small">
            {report.mode === 'mock' ? '🧪 mock AI run' : '⚡ live AI run'} · {report.stepsExecuted} steps
            {report.stepsRestored > 0 ? ` · ${report.stepsRestored} restored` : ''} · {report.retriesUsed} retries ·{' '}
            {report.fallbacksActivated.length} fallbacks · {report.humanDecisions.length} human decisions
          </span>
        </div>
      </div>

      <div className="report-breakdown">
        {a.breakdown.map((b) => (
          <div key={b.label} className="breakdown-row">
            <div className="breakdown-head">
              <span>{b.label}</span>
              <span className="breakdown-points">
                {b.earned}/{b.max}
              </span>
            </div>
            <div className="bar" aria-hidden="true">
              <div className="bar-fill" style={{ width: `${(b.earned / b.max) * 100}%` }} />
            </div>
            <p className="muted small">{b.note}</p>
          </div>
        ))}
      </div>

      {a.strengths.length > 0 && (
        <div className="report-list good">
          <h4>💪 Recovery behaviour observed</h4>
          <ul>
            {a.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {a.weaknesses.length > 0 && (
        <div className="report-list bad">
          <h4>🕳️ Unresolved weaknesses</h4>
          <ul>
            {a.weaknesses.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {report.finalOutput !== undefined && (
        <Collapsible summary={`📤 Final output — ${report.finalOutputValid ? 'valid ✅' : 'INVALID ❌'}`} defaultOpen={report.finalOutputValid === false}>
          <Json value={report.finalOutput} maxHeight={240} />
          {report.finalOutputValid === false && report.finalOutputIssues && (
            <ul className="issue-list">
              {report.finalOutputIssues.map((i) => (
                <li key={i}>🚨 {i}</li>
              ))}
            </ul>
          )}
        </Collapsible>
      )}

      {report.safeStopReason && <p className="safestop-note">🛑 {report.safeStopReason}</p>}
    </div>
  );
}
