import { useStore } from '../state/store';

/**
 * The five-beat learning path for every puzzle. Each phase is driven by a real
 * milestone the player has reached, not by a step counter.
 */
const PHASES = ['Understand', 'Run baseline', 'Break it', 'Repair', 'Prove resilience'] as const;

export function PhaseStrip() {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const progress = useStore((s) => (puzzleId ? s.progress[puzzleId] : null));

  if (!puzzleId || !progress) return null;

  const done = [
    true,
    Boolean(progress.ranBaseline),
    Boolean(progress.sawFailure),
    Boolean(progress.survivedChaos),
    Boolean(progress.solvedAt),
  ];
  // The first unfinished phase is the one to nudge the player toward.
  const currentIndex = done.findIndex((v) => !v);

  return (
    <ol className="phase-strip" aria-label="Puzzle learning path">
      {PHASES.map((label, i) => (
        <li
          key={label}
          className={done[i] ? 'done' : i === currentIndex ? 'current' : ''}
          aria-current={i === currentIndex ? 'step' : undefined}
        >
          <span className="phase-dot">{done[i] ? '✓' : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
