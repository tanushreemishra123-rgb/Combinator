import { useState } from 'react';
import type { WorkflowStep } from '../engine/types';
import { isResilient } from '../engine/types';
import { getKit } from '../puzzles';
import { EMPTY_STEPS, useStore } from '../state/store';
import type { InsertTarget, SlotPath } from '../state/workflowOps';
import { KIND_META, STATUS_META, StatusChip } from './common';
import { beginDrag, draggedPayload, endDrag, readDrop } from './dnd';

function DropZone({ target, compact }: { target: InsertTarget; compact?: boolean }) {
  const [hot, setHot] = useState(false);
  const insertAt = useStore((s) => s.insertAt);
  const moveTo = useStore((s) => s.moveTo);
  const showToast = useStore((s) => s.showToast);
  const running = useStore((s) => s.running);
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));

  const accepts = () => {
    const drag = draggedPayload();
    return drag !== null && drag.type !== 'upgrade';
  };

  return (
    <div
      className={`drop-zone ${compact ? 'compact' : ''} ${hot ? 'hot' : ''}`}
      /* Mouse-only affordance — the keyboard/AT path is the palette's + button,
         so exposing this as a control would promise interaction it cannot give. */
      aria-hidden="true"
      onDragOver={(e) => {
        if (!accepts() || running) return;
        e.preventDefault();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHot(false);
        if (running || !puzzleId) return;
        const payload = readDrop(e);
        if (!payload) return;
        if (payload.type === 'move') {
          moveTo(payload.stepId, target);
        } else if (payload.type === 'palette') {
          const entry = getKit(puzzleId).puzzle.palette.find((p) => p.id === payload.entryId);
          if (!entry?.make) return;
          insertAt(target, entry.make());
        } else {
          showToast('Upgrades attach to AI and Tool steps — drop the chip onto a step card.');
        }
      }}
    >
      <span className="drop-hint">drop here</span>
    </div>
  );
}

/**
 * Retry, fallback and safe-stop render as blocks attached under their host step
 * rather than free-floating nodes. They are placed from the same shelf with the
 * same gesture; binding them to a step is what lets the engine know *which* call
 * to retry, which a standalone node would have to infer.
 */
function UpgradeBadges({ step }: { step: WorkflowStep }) {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  if (!isResilient(step) || !puzzleId) return null;
  const kit = getKit(puzzleId);
  const blocks: Array<{ icon: string; name: string; detail: string; tone: string }> = [];
  if (step.upgrades.retry) {
    blocks.push({
      icon: '🔁',
      name: `Retry ×${step.upgrades.retry.attempts}`,
      detail: `up to ${step.upgrades.retry.attempts} extra attempt${step.upgrades.retry.attempts === 1 ? '' : 's'} on a hard failure`,
      tone: 'retry',
    });
  }
  const fb = step.upgrades.fallback;
  if (fb) {
    const name =
      fb.type === 'provider'
        ? kit.provider(fb.providerId).name
        : fb.type === 'tool'
          ? kit.tool(fb.toolId).name
          : kit.defaultValue(fb.defaultId).name;
    blocks.push({
      icon: '🪂',
      name: `Fallback: ${name}`,
      detail: fb.type === 'default' ? 'returns a safe committed value' : 'takes over once retries are exhausted',
      tone: 'fallback',
    });
  }
  if (step.onExhausted === 'safe-stop') {
    blocks.push({ icon: '🛑', name: 'Safe stop', detail: 'halts the run instead of shipping bad data', tone: 'stop' });
  }
  if (blocks.length === 0) return null;
  return (
    <ul className="attached-blocks" aria-label={`Reliability blocks on ${step.label}`}>
      {blocks.map((b) => (
        <li key={b.name} className={`attached-block tone-${b.tone}`}>
          <span className="attached-icon" aria-hidden="true">
            {b.icon}
          </span>
          <span className="attached-text">
            <strong>{b.name}</strong>
            <span>{b.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function StepCard({ step }: { step: WorkflowStep }) {
  const [upgradeHot, setUpgradeHot] = useState(false);
  const selected = useStore((s) => s.selectedStepId === step.id);
  const status = useStore((s) => s.liveStatuses[step.id] ?? 'pending');
  const running = useStore((s) => s.running);
  const selectStep = useStore((s) => s.selectStep);
  const remove = useStore((s) => s.remove);
  const nudge = useStore((s) => s.nudge);
  const addRetry = useStore((s) => s.addRetry);
  const addFallback = useStore((s) => s.addFallback);
  const showToast = useStore((s) => s.showToast);
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));

  const meta = KIND_META[step.kind];
  const hasRun = status !== 'pending';

  const subtitle = (() => {
    if (!puzzleId) return '';
    const kit = getKit(puzzleId);
    switch (step.kind) {
      case 'ai':
        return `${kit.task(step.taskId).name} · ${kit.provider(step.providerId).name}`;
      case 'tool':
        return kit.tool(step.toolId).name;
      case 'retrieval':
        return `${kit.source(step.sourceId).name} · top ${step.topK}`;
      case 'condition':
        return kit.condition(step.conditionId).name;
      case 'transform':
        return kit.transform(step.transformId).name;
      case 'validator':
        return kit.schema(step.schemaId).name;
      case 'human':
        return step.title;
      case 'safestop':
        return `“${step.message.slice(0, 48)}${step.message.length > 48 ? '…' : ''}”`;
      default:
        return meta.blurb;
    }
  })();

  return (
    <div className="step-wrap">
      <div
        className={[
          'step-card',
          `tone-${meta.tone}`,
          `st-${status}`,
          selected ? 'selected' : '',
          upgradeHot ? 'upgrade-hot' : '',
          step.locked ? 'locked' : '',
        ].join(' ')}
        draggable={!step.locked && !running}
        onDragStart={(e) => {
          e.stopPropagation();
          beginDrag(e, { type: 'move', stepId: step.id });
        }}
        onDragEnd={endDrag}
        onDragOver={(e) => {
          const drag = draggedPayload();
          if (running || !drag || drag.type !== 'upgrade' || !isResilient(step)) return;
          e.preventDefault();
          e.stopPropagation();
          setUpgradeHot(true);
        }}
        onDragLeave={() => setUpgradeHot(false)}
        onDrop={(e) => {
          setUpgradeHot(false);
          const payload = readDrop(e);
          if (running || !payload || payload.type !== 'upgrade' || !puzzleId) return;
          e.preventDefault();
          e.stopPropagation();
          const entry = getKit(puzzleId).puzzle.palette.find((p) => p.id === payload.entryId);
          if (!entry) return;
          if (!isResilient(step)) {
            showToast('Upgrades attach to AI and Tool steps only.');
            return;
          }
          if (entry.type === 'upgrade-retry') addRetry(step.id, 2);
          else if (entry.type === 'upgrade-fallback' && entry.fallback) addFallback(step.id, entry.fallback);
        }}
        onClick={(e) => {
          e.stopPropagation();
          selectStep(step.id);
        }}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${step.label}, ${meta.name}${hasRun ? `, status ${STATUS_META[status].label}` : ''}. Enter to configure.${
          step.locked || running ? '' : ' Alt+Arrow to reorder, Delete to remove.'
        }`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            selectStep(step.id);
            return;
          }
          if (step.locked || running) return;
          // Alt+Arrow reorders; Delete/Backspace removes. Plain arrows stay
          // free for the browser's own focus movement.
          if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
            e.preventDefault();
            nudge(step.id, -1);
          } else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
            e.preventDefault();
            nudge(step.id, 1);
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            remove(step.id);
          }
        }}
      >
        <div className="step-head">
          <span className="step-icon">{meta.icon}</span>
          <div className="step-titles">
            <span className="step-label">{step.label}</span>
            <span className="step-sub">{subtitle}</span>
          </div>
          {hasRun && <StatusChip status={status} />}
        </div>
        <UpgradeBadges step={step} />
        {!step.locked && !running && (
          <div className="step-actions">
            <button type="button" title="Move up" onClick={(e) => { e.stopPropagation(); nudge(step.id, -1); }}>↑</button>
            <button type="button" title="Move down" onClick={(e) => { e.stopPropagation(); nudge(step.id, 1); }}>↓</button>
            <button type="button" title="Remove step" className="danger" onClick={(e) => { e.stopPropagation(); remove(step.id); }}>✕</button>
          </div>
        )}
      </div>

      {step.kind === 'condition' && (
        <div className="branches">
          {(['then', 'else'] as const).map((branch) => (
            <div key={branch} className={`branch branch-${branch}`}>
              <div className="branch-title">{branch === 'then' ? '✓ yes' : '✗ no'}</div>
              <Sequence steps={step.branches[branch]} path={{ kind: 'branch', conditionId: step.id, branch }} />
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

function Sequence({ steps, path }: { steps: WorkflowStep[]; path: SlotPath }) {
  return (
    <div className={`sequence ${path.kind === 'branch' ? 'nested' : ''}`}>
      <DropZone target={{ path, index: 0 }} compact={path.kind === 'branch'} />
      {steps.map((step, i) => (
        <div key={step.id} className="sequence-item">
          <StepCard step={step} />
          <DropZone target={{ path, index: i + 1 }} compact={path.kind === 'branch'} />
        </div>
      ))}
      {steps.length === 0 && path.kind === 'branch' && <div className="branch-empty">empty — flow continues</div>}
    </div>
  );
}

export function Canvas() {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const workflow = useStore((s) => (s.screen.name === 'puzzle' ? s.progress[s.screen.puzzleId].workflow : EMPTY_STEPS));
  const selectStep = useStore((s) => s.selectStep);
  if (!puzzleId) return null;
  return (
    <div className="canvas" onClick={() => selectStep(null)}>
      <div className="canvas-title">
        <h3>Workflow</h3>
        <span className="canvas-hint">drag blocks between steps · drop upgrade chips onto AI/Tool steps · click a step to configure it</span>
      </div>
      <Sequence steps={workflow} path={{ kind: 'main' }} />
    </div>
  );
}
