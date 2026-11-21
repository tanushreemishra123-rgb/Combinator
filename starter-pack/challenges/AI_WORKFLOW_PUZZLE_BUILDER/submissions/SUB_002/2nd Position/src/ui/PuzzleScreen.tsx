import { getPuzzle } from '../puzzles';
import type { MobilePane } from '../state/store';
import { useStore } from '../state/store';
import { Canvas } from './Canvas';
import { DifficultyPill } from './common';
import { GoalsPanel } from './GoalsPanel';
import { Inspector } from './Inspector';
import { Palette } from './Palette';
import { PhaseStrip } from './PhaseStrip';
import { ReportPanel } from './ReportPanel';
import { RunPanel } from './RunPanel';
import { TracePanel } from './TracePanel';
import { useIsMobile } from './useIsMobile';

function PuzzleHeader() {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const goHome = useStore((s) => s.goHome);
  const resetPuzzle = useStore((s) => s.resetPuzzle);
  const running = useStore((s) => s.running);
  const solved = useStore((s) => (puzzleId ? Boolean(s.progress[puzzleId]?.solvedAt) : false));
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setGuideOpen = useStore((s) => s.setGuideOpen);

  if (!puzzleId) return null;
  const puzzle = getPuzzle(puzzleId);

  return (
    <header className="puzzle-header">
      <button type="button" className="ghost" onClick={goHome} disabled={running}>
        ←<span className="btn-text"> Puzzles</span>
      </button>
      <span className="puzzle-title">
        <span className="puzzle-emoji">{puzzle.emoji}</span>
        <strong>{puzzle.title}</strong>
        <span className="hide-mobile">
          <DifficultyPill level={puzzle.difficulty} />
        </span>
        {solved && <span className="pill pill-solved">⭐</span>}
      </span>
      <div className="puzzle-header-actions">
        <button type="button" className="ghost" onClick={() => setGuideOpen(true)} title="Reviewer guide — jump to any capability">
          🧭
        </button>
        <button type="button" className="ghost" onClick={resetPuzzle} disabled={running} title="Restore the puzzle's starting workflow">
          ↺<span className="btn-text"> Reset</span>
        </button>
        <button type="button" className="ghost" onClick={() => setSettingsOpen(true)} title="Settings">
          ⚙️
        </button>
      </div>
    </header>
  );
}

function DesktopWorkspace() {
  const activeTab = useStore((s) => s.activeTab);
  const setTab = useStore((s) => s.setTab);

  const TAB_ORDER = ['goals', 'trace', 'report'] as const;
  const onTabKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const i = TAB_ORDER.indexOf(activeTab as (typeof TAB_ORDER)[number]);
    const next = TAB_ORDER[(i + delta + TAB_ORDER.length) % TAB_ORDER.length];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const criteriaMet = useStore((s) => (puzzleId ? s.progress[puzzleId]?.criteriaMet.length : 0));
  if (!puzzleId) return null;
  const puzzle = getPuzzle(puzzleId);

  return (
    <div className="workspace">
      <aside className="left-col">
        <RunPanel />
        <Palette />
      </aside>

      <main className="center-col">
        <Canvas />
      </main>

      <aside className="right-col">
        <div className="tabs" role="tablist" aria-label="Puzzle panels" onKeyDown={onTabKey}>
          <button
            type="button"
            role="tab"
            id="tab-goals"
            aria-selected={activeTab === 'goals'}
            aria-controls="panel-goals"
            tabIndex={activeTab === 'goals' ? 0 : -1}
            className={activeTab === 'goals' ? 'active' : ''}
            onClick={() => setTab('goals')}
          >
            🎯 Mission
            {criteriaMet ? (
              <span className="tab-count">
                {criteriaMet}/{puzzle.criteria.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-trace"
            aria-selected={activeTab === 'trace'}
            aria-controls="panel-trace"
            tabIndex={activeTab === 'trace' ? 0 : -1}
            className={activeTab === 'trace' ? 'active' : ''}
            onClick={() => setTab('trace')}
          >
            🧾 Trace
          </button>
          <button
            type="button"
            role="tab"
            id="tab-report"
            aria-selected={activeTab === 'report'}
            aria-controls="panel-report"
            tabIndex={activeTab === 'report' ? 0 : -1}
            className={activeTab === 'report' ? 'active' : ''}
            onClick={() => setTab('report')}
          >
            📊 Reliability
          </button>
        </div>
        <div
          className="tab-body"
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'goals' && <GoalsPanel />}
          {activeTab === 'trace' && <TracePanel />}
          {activeTab === 'report' && <ReportPanel />}
        </div>
        <Inspector />
      </aside>
    </div>
  );
}

const TABS: Array<{ pane: MobilePane; icon: string; label: string }> = [
  { pane: 'mission', icon: '🎯', label: 'Mission' },
  { pane: 'build', icon: '🧩', label: 'Build' },
  { pane: 'trace', icon: '🧾', label: 'Trace' },
  { pane: 'score', icon: '📊', label: 'Score' },
];

function MobileWorkspace() {
  const pane = useStore((s) => s.mobilePane);
  const setPane = useStore((s) => s.setMobilePane);
  const running = useStore((s) => s.running);
  const humanGate = useStore((s) => s.humanGate);
  const run = useStore((s) => s.run);
  const selectedStepId = useStore((s) => s.selectedStepId);
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const criteriaMet = useStore((s) => (puzzleId ? s.progress[puzzleId]?.criteriaMet.length : 0));
  const traceCount = useStore((s) => s.liveEvents.length);

  if (!puzzleId) return null;
  const puzzle = getPuzzle(puzzleId);

  const badgeFor = (p: MobilePane): string => {
    if (p === 'mission') return `${criteriaMet}/${puzzle.criteria.length}`;
    if (p === 'trace' && traceCount > 0) return String(traceCount);
    return '';
  };

  return (
    <div className="mobile-workspace">
      <div className="mobile-pane">
        {pane === 'mission' && <GoalsPanel />}
        {pane === 'build' && (
          <>
            <RunPanel hidePrimaryRun />
            <Canvas />
            <Palette />
            {selectedStepId && <Inspector />}
          </>
        )}
        {pane === 'trace' && <TracePanel />}
        {pane === 'score' && <ReportPanel />}
      </div>

      <nav className="mobile-tabbar" aria-label="Sections">
        {TABS.slice(0, 2).map((t) => (
          <button key={t.pane} type="button" className={pane === t.pane ? 'active' : ''} onClick={() => setPane(t.pane)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
            {badgeFor(t.pane) && <span className="tab-badge">{badgeFor(t.pane)}</span>}
          </button>
        ))}

        <button type="button" className="tab-run" onClick={() => run(false)} disabled={running} aria-label="Run workflow">
          <span className="tab-run-icon">{running ? (humanGate ? '⏸️' : '⏳') : '▶'}</span>
          <span className="tab-label">{running ? (humanGate ? 'Paused' : 'Running') : 'Run'}</span>
        </button>

        {TABS.slice(2).map((t) => (
          <button key={t.pane} type="button" className={pane === t.pane ? 'active' : ''} onClick={() => setPane(t.pane)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
            {badgeFor(t.pane) && <span className="tab-badge">{badgeFor(t.pane)}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function PuzzleScreen() {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const isMobile = useIsMobile();
  if (!puzzleId) return null;

  return (
    <div className={`puzzle-screen ${isMobile ? 'is-mobile' : ''}`}>
      <PuzzleHeader />
      <PhaseStrip />
      {isMobile ? <MobileWorkspace /> : <DesktopWorkspace />}
    </div>
  );
}
