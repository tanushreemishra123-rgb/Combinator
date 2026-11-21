import { PUZZLES } from '../puzzles';
import type { Difficulty } from '../puzzles/types';
import { useStore } from '../state/store';
import { DifficultyPill } from './common';

const SECTIONS: Array<{ level: Difficulty; title: string; blurb: string }> = [
  { level: 'beginner', title: 'Beginner', blurb: 'Learn why runs that “succeed” can still ship garbage — and how to catch it.' },
  { level: 'intermediate', title: 'Intermediate', blurb: 'Timeouts, humans in the loop, and tools that choke on bad data.' },
  { level: 'advanced', title: 'Advanced', blurb: 'Escalation ladders, model fallbacks, and resuming interrupted missions.' },
];

export function HomeScreen() {
  const openPuzzle = useStore((s) => s.openPuzzle);
  const progress = useStore((s) => s.progress);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setGuideOpen = useStore((s) => s.setGuideOpen);
  const solvedCount = PUZZLES.filter((p) => progress[p.id]?.solvedAt).length;

  return (
    <div className="home">
      <header className="home-hero">
        <div className="hero-titles">
          <h1>🧩 Workflow Puzzle Lab</h1>
          <p>
            Assemble AI workflows. Break them on purpose. Repair them with retries, fallbacks, validators, and human review — and learn
            why resilient AI applications are designed the way they are.
          </p>
        </div>
        <div className="hero-side">
          <span className="hero-progress">
            ⭐ {solvedCount}/{PUZZLES.length} puzzles solved
          </span>
          <button type="button" className="btn-guide" onClick={() => setGuideOpen(true)}>
            🧭 Reviewer guide
          </button>
          <button type="button" className="ghost" onClick={() => setSettingsOpen(true)}>
            ⚙️ Settings
          </button>
        </div>
      </header>

      <p className="reviewer-banner">
        <strong>Reviewing this submission?</strong> The 🧭 <button type="button" className="linkish" onClick={() => setGuideOpen(true)}>Reviewer guide</button>{' '}
        lists every capability with a one-click jump that opens the right puzzle with the right failure already armed —
        retries, fallbacks, validation, human review, safe stops, and checkpoint resume.
      </p>

      <div className="how-it-works">
        <div className="how-step"><span>1</span> Pick a puzzle & read its mission briefing</div>
        <div className="how-step"><span>2</span> Run the naive workflow — then flip on a failure scenario 💥</div>
        <div className="how-step"><span>3</span> Repair it with retries 🔁, fallbacks 🪂, validators 🛡️, and humans 🙋</div>
        <div className="how-step"><span>4</span> Read the trace & reliability report — earn every goal 🏆</div>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.level} className="difficulty-section">
          <div className="section-head">
            <h2>{section.title}</h2>
            <p className="muted">{section.blurb}</p>
          </div>
          <div className="puzzle-grid">
            {PUZZLES.filter((p) => p.difficulty === section.level).map((p) => {
              const prog = progress[p.id];
              const met = prog?.criteriaMet.length ?? 0;
              return (
                <button type="button" key={p.id} className={`puzzle-card ${prog?.solvedAt ? 'solved' : ''}`} onClick={() => openPuzzle(p.id)}>
                  <div className="puzzle-card-head">
                    <span className="puzzle-emoji">{p.emoji}</span>
                    <DifficultyPill level={p.difficulty} />
                  </div>
                  <h3>{p.title}</h3>
                  <p>{p.tagline}</p>
                  <div className="puzzle-card-foot">
                    <span className="goal-count">
                      {prog?.solvedAt ? '⭐ Solved' : `🏆 ${met}/${p.criteria.length} goals`}
                    </span>
                    <span className="play">Play →</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <footer className="home-foot">
        <p className="muted small">
          🧪 Runs locally in mock AI mode by default — deterministic, offline, no paid AI access required. An optional live Anthropic
          provider can be configured in Settings.
        </p>
      </footer>
    </div>
  );
}
