import type { PaletteEntry } from '../puzzles/types';
import { getKit } from '../puzzles';
import { EMPTY_STEPS, useStore } from '../state/store';
import { flattenSteps } from '../engine/util';
import { isResilient } from '../engine/types';
import { beginDrag, endDrag } from './dnd';

function PaletteItem({ entry }: { entry: PaletteEntry }) {
  const insertAt = useStore((s) => s.insertAt);
  const addRetry = useStore((s) => s.addRetry);
  const addFallback = useStore((s) => s.addFallback);
  const showToast = useStore((s) => s.showToast);
  const running = useStore((s) => s.running);
  const workflow = useStore((s) => (s.screen.name === 'puzzle' ? s.progress[s.screen.puzzleId].workflow : EMPTY_STEPS));

  const probeKind = entry.type === 'step' && entry.make ? entry.make().kind : null;
  const used = probeKind ? flattenSteps(workflow).filter((s) => s.kind === probeKind).length : 0;
  const max = entry.type === 'step' ? entry.maxInstances : undefined;
  const exhausted = entry.type === 'step' && max !== undefined && used >= max;

  const quickAdd = () => {
    if (running || exhausted) return;
    if (entry.type === 'step' && entry.make) {
      // Click-to-add: insert just before the Output step.
      insertAt({ path: { kind: 'main' }, index: workflow.length - 1 }, entry.make());
      return;
    }
    // Upgrades: attach to the first compatible step without one.
    const flat = flattenSteps(workflow);
    if (entry.type === 'upgrade-retry') {
      const target = flat.find((s) => isResilient(s) && !s.upgrades.retry);
      if (target) addRetry(target.id, 2);
      else showToast('Every compatible step already has a retry. Drag the chip to choose a specific step.');
    } else if (entry.type === 'upgrade-fallback' && entry.fallback) {
      const wantsTool = entry.fallback.type === 'tool';
      const target = flat.find(
        (s) => isResilient(s) && !s.upgrades.fallback && (wantsTool ? s.kind === 'tool' : s.kind === 'ai' || entry.fallback!.type === 'default'),
      );
      if (target) addFallback(target.id, entry.fallback);
      else showToast('No compatible step is missing a fallback. Drag the chip to choose a specific step.');
    }
  };

  return (
    <div
      className={`palette-item ${entry.type !== 'step' ? 'palette-upgrade' : ''} ${exhausted ? 'exhausted' : ''}`}
      draggable={!running && !exhausted}
      onDragStart={(e) =>
        beginDrag(e, entry.type === 'step' ? { type: 'palette', entryId: entry.id } : { type: 'upgrade', entryId: entry.id })
      }
      onDragEnd={endDrag}
      title={entry.blurb}
    >
      <span className="palette-emoji">{entry.emoji}</span>
      <div className="palette-text">
        <span className="palette-name">
          {entry.name}
          {max !== undefined && (
            <span className="palette-count">
              {' '}
              {used}/{max}
            </span>
          )}
        </span>
        <span className="palette-blurb">{entry.blurb}</span>
      </div>
      <button
        type="button"
        className="palette-add"
        onClick={quickAdd}
        disabled={running || exhausted}
        title="Quick add"
        aria-label={`Add ${entry.name} to the workflow`}
      >
        +
      </button>
    </div>
  );
}

export function Palette() {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  if (!puzzleId) return null;
  const palette = getKit(puzzleId).puzzle.palette;
  return (
    <div className="palette">
      <h3>Block shelf</h3>
      {palette.length === 0 ? (
        <p className="muted">This puzzle ships with all its blocks on the canvas — configure them instead.</p>
      ) : (
        palette.map((entry) => <PaletteItem key={entry.id} entry={entry} />)
      )}
      <p className="palette-tip">Drag onto the canvas, or press + to quick-add. Upgrade chips (🔁 🪂) drop onto AI/Tool steps.</p>
    </div>
  );
}
