import type { AiStep, FallbackUpgrade, ResilientStep, ToolStep, ValidatorStep, WorkflowStep } from '../engine/types';
import { flattenSteps } from '../engine/util';
import type { PuzzleKit } from '../puzzles/types';
import { getKit } from '../puzzles';
import { EMPTY_STEPS, useStore } from '../state/store';
import { Collapsible, Json, KIND_META } from './common';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function ResilienceControls({ step, kit }: { step: ResilientStep; kit: PuzzleKit }) {
  const patchStep = useStore((s) => s.patchStep);

  const fallbackOptions: Array<{ key: string; label: string; value: FallbackUpgrade }> = [];
  if (step.kind === 'ai') {
    for (const p of kit.puzzle.providers.filter((p) => p.tier === 'fallback')) {
      fallbackOptions.push({ key: `provider:${p.id}`, label: `Model: ${p.name}`, value: { type: 'provider', providerId: p.id } });
    }
  } else {
    for (const t of kit.puzzle.tools.filter((t) => t.id !== (step as ToolStep).toolId)) {
      fallbackOptions.push({ key: `tool:${t.id}`, label: `Tool: ${t.name}`, value: { type: 'tool', toolId: t.id } });
    }
  }
  for (const d of kit.puzzle.defaults) {
    fallbackOptions.push({ key: `default:${d.id}`, label: `Safe default: ${d.name}`, value: { type: 'default', defaultId: d.id } });
  }

  const currentKey = (() => {
    const fb = step.upgrades.fallback;
    if (!fb) return '';
    if (fb.type === 'provider') return `provider:${fb.providerId}`;
    if (fb.type === 'tool') return `tool:${fb.toolId}`;
    return `default:${fb.defaultId}`;
  })();

  return (
    <>
      <Field label="🔁 Retry (extra attempts after the first)">
        <select
          value={step.upgrades.retry?.attempts ?? 0}
          onChange={(e) => {
            const attempts = Number(e.target.value);
            const upgrades = { ...step.upgrades, retry: attempts > 0 ? { attempts } : undefined };
            patchStep(step.id, { upgrades });
          }}
        >
          <option value={0}>none — one attempt only</option>
          <option value={1}>1 extra attempt</option>
          <option value={2}>2 extra attempts</option>
          <option value={3}>3 extra attempts</option>
        </select>
      </Field>
      <Field label="🪂 Fallback (after every attempt fails)">
        <select
          value={currentKey}
          onChange={(e) => {
            const option = fallbackOptions.find((o) => o.key === e.target.value);
            const upgrades = { ...step.upgrades, fallback: option?.value };
            patchStep(step.id, { upgrades });
          }}
        >
          <option value="">none</option>
          {fallbackOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="🧯 When everything is exhausted">
        <select
          value={step.onExhausted}
          onChange={(e) => patchStep(step.id, { onExhausted: e.target.value as 'safe-stop' | 'fail' })}
        >
          <option value="fail">fail the run (unhandled error)</option>
          <option value="safe-stop">stop safely with a clear message</option>
        </select>
      </Field>
    </>
  );
}

function ValidatorControls({ step, kit }: { step: ValidatorStep; kit: PuzzleKit }) {
  const patchStep = useStore((s) => s.patchStep);
  const schema = kit.schema(step.schemaId);
  const hasRepair = Boolean(schema.repair);

  return (
    <>
      <div className="schema-rules">
        <span className="field-label">Checks ({schema.name})</span>
        <ul>
          {schema.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <span className="field-label ladder-label">On failure, escalate in order:</span>
      <Field label="1 · 🔁 Retry the previous step">
        <select value={step.retryPrevious} onChange={(e) => patchStep(step.id, { retryPrevious: Number(e.target.value) })}>
          <option value={0}>off</option>
          <option value={1}>once</option>
          <option value={2}>twice</option>
        </select>
      </Field>
      <Field label={`2 · 🔧 Repair automatically${hasRepair ? '' : ' (no repair recipe for this schema)'}`}>
        <input
          type="checkbox"
          checked={step.repair}
          disabled={!hasRepair}
          onChange={(e) => patchStep(step.id, { repair: e.target.checked })}
        />
      </Field>
      {kit.puzzle.defaults.length > 0 && (
        <Field label="3 · 📦 Use a safe default">
          <select
            value={step.useDefault && step.defaultId ? step.defaultId : ''}
            onChange={(e) =>
              patchStep(step.id, e.target.value ? { useDefault: true, defaultId: e.target.value } : { useDefault: false, defaultId: undefined })
            }
          >
            <option value="">off</option>
            {kit.puzzle.defaults.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="4 · 🙋 Escalate to a human">
        <input type="checkbox" checked={step.escalate} onChange={(e) => patchStep(step.id, { escalate: e.target.checked })} />
      </Field>
      <Field label="5 · Final action if nothing worked">
        <select value={step.finalAction} onChange={(e) => patchStep(step.id, { finalAction: e.target.value as 'safe-stop' | 'fail' })}>
          <option value="safe-stop">stop safely with the issues listed</option>
          <option value="fail">fail the run (unhandled error)</option>
        </select>
      </Field>
    </>
  );
}

function StepConfig({ step, kit }: { step: WorkflowStep; kit: PuzzleKit }) {
  const patchStep = useStore((s) => s.patchStep);

  switch (step.kind) {
    case 'input':
      return (
        <>
          <p className="muted">{kit.puzzle.samples[0].label} — committed with the puzzle, so every run is reproducible.</p>
          <Json value={kit.puzzle.samples[0].value} maxHeight={220} />
        </>
      );
    case 'output':
      return (
        <>
          <p className="muted">Expected result: {kit.puzzle.expected.description}</p>
          {kit.puzzle.expected.schemaId && (
            <div className="schema-rules">
              <span className="field-label">Validated against {kit.schema(kit.puzzle.expected.schemaId).name}</span>
              <ul>
                {kit.schema(kit.puzzle.expected.schemaId).rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      );
    case 'ai': {
      const ai = step as AiStep;
      const task = kit.task(ai.taskId);
      return (
        <>
          <p className="muted">{task.description}</p>
          <Field label="🧠 Model">
            <select value={ai.providerId} onChange={(e) => patchStep(step.id, { providerId: e.target.value })}>
              {kit.puzzle.providers
                .filter((p) => p.tier === 'primary' || p.id === ai.providerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.blurb}
                  </option>
                ))}
            </select>
          </Field>
          <ResilienceControls step={ai} kit={kit} />
        </>
      );
    }
    case 'tool': {
      const tool = step as ToolStep;
      return (
        <>
          <p className="muted">{kit.tool(tool.toolId).description}</p>
          <ResilienceControls step={tool} kit={kit} />
        </>
      );
    }
    case 'retrieval':
      return (
        <>
          <p className="muted">{kit.source(step.sourceId).description}</p>
          <Field label="Top K documents">
            <select value={step.topK} onChange={(e) => patchStep(step.id, { topK: Number(e.target.value) })}>
              {[1, 2, 3, 5].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
        </>
      );
    case 'condition':
      return <p className="muted">{kit.condition(step.conditionId).description} Drag blocks into its ✓ / ✗ branches on the canvas.</p>;
    case 'transform':
      return <p className="muted">{kit.transform(step.transformId).description}</p>;
    case 'validator':
      return <ValidatorControls step={step} kit={kit} />;
    case 'human':
      return (
        <>
          <p className="muted">{step.instructions}</p>
          <Field label="Allow the reviewer to edit the payload">
            <input type="checkbox" checked={step.allowEdit} onChange={(e) => patchStep(step.id, { allowEdit: e.target.checked })} />
          </Field>
          {step.schemaId && <p className="muted">Edits must satisfy: {kit.schema(step.schemaId).name}.</p>}
        </>
      );
    case 'safestop':
      return (
        <Field label="Message shown when the workflow stops here">
          <textarea value={step.message} rows={3} onChange={(e) => patchStep(step.id, { message: e.target.value })} />
        </Field>
      );
  }
}

export function Inspector() {
  const puzzleId = useStore((s) => (s.screen.name === 'puzzle' ? s.screen.puzzleId : null));
  const selectedStepId = useStore((s) => s.selectedStepId);
  const workflow = useStore((s) => (s.screen.name === 'puzzle' ? s.progress[s.screen.puzzleId].workflow : EMPTY_STEPS));
  const events = useStore((s) => s.liveEvents);

  if (!puzzleId) return null;
  const kit = getKit(puzzleId);
  const step = selectedStepId ? flattenSteps(workflow).find((s) => s.id === selectedStepId) : undefined;

  if (!step) {
    return (
      <div className="inspector">
        <h3>Block settings</h3>
        <p className="muted">Select a step on the canvas to configure it — models, retries, fallbacks, validation ladders, and more.</p>
      </div>
    );
  }

  const meta = KIND_META[step.kind];
  const lastInput = [...events].reverse().find((e) => e.t === 'step-started' && e.stepId === step.id);
  const lastOutput = [...events].reverse().find((e) => e.t === 'step-completed' && e.stepId === step.id);

  return (
    <div className="inspector">
      <h3>
        {meta.icon} {step.label}
      </h3>
      <p className="inspector-kind">{meta.name} — {meta.blurb}</p>
      <StepConfig step={step} kit={kit} />
      {(lastInput || lastOutput) && (
        <div className="last-run">
          <h4>Last run</h4>
          {lastInput && lastInput.t === 'step-started' && (
            <Collapsible summary="Step input">
              <Json value={lastInput.input} maxHeight={200} />
            </Collapsible>
          )}
          {lastOutput && lastOutput.t === 'step-completed' && (
            <Collapsible summary="Step output" defaultOpen>
              <Json value={lastOutput.output} maxHeight={200} />
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
