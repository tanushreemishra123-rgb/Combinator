import { z } from 'zod';
import type { Puzzle } from './types';
import { failWith, interrupt, mkAi, mkInput, mkOutput, mkRetrieval, mkTool, mkTransform, mkValidator, ok } from './blocks';
import { uid } from '../engine/util';

const TELEMETRY = {
  probe: 'Meridian-3',
  sol: 214,
  batteryPct: 71,
  anomalies: ['dust storm grounded the drone flight on sol 212', 'spectrometer heater drew 12% extra power'],
  discoveries: ['layered clay deposits on the crater rim', 'subsurface ice echo at 1.8 m depth'],
};

const ARCHIVE_DOCS = [
  { id: 'log-sol-210', title: 'Mission log, sol 210', snippet: 'Meridian-3 completed the crater-rim traverse; wheels nominal.' },
  { id: 'log-sol-212', title: 'Mission log, sol 212', snippet: 'Dust storm grounded the survey drone; recharging suspended for 14 hours.' },
  { id: 'ops-note-88', title: 'Ops note 88', snippet: 'Spectrometer heater workaround approved; monitor power draw.' },
];

const MISSION_LOG = {
  title: 'Meridian-3 — Sol 214 Mission Log',
  status: 'nominal with caveats',
  highlights: [
    'Layered clay deposits identified on the crater rim',
    'Subsurface ice echo detected at 1.8 m depth',
  ],
  concerns: ['Dust storm delayed drone operations', 'Spectrometer heater power draw +12%'],
  batteryPct: 71,
};

const schema = z.object({
  transmitted: z.literal(true),
  logId: z.string().min(6),
  log: z.object({
    title: z.string().min(10),
    status: z.string(),
    highlights: z.array(z.string()).min(1),
    concerns: z.array(z.string()),
    batteryPct: z.number(),
  }),
  relay: z.string(),
});

export const resumeMission: Puzzle = {
  id: 'resume-mission',
  order: 8,
  title: 'Resume the Interrupted Mission',
  emoji: '🛰️',
  difficulty: 'advanced',
  tagline: 'A solar flare killed the run mid-flight. Pick up from the last good step.',
  objective:
    'Compile and transmit a mission log for the Meridian-3 probe. Mid-run, a solar flare knocks the pipeline out — but a checkpoint preserves every completed step. Resume from the last successful step instead of re-running the whole mission, then get the log transmitted.',
  learning: [
    'Checkpoints turn a crash into a pause',
    'Resuming must not re-run completed side effects — restored steps are marked, not executed',
    'An interruption is a distinct outcome: not failed, not completed — recoverable',
  ],
  expected: {
    description: 'A transmission receipt: `transmitted: true`, a log id, the mission log itself, and the relay used.',
    schemaId: 'transmission-receipt',
  },
  samples: [
    {
      id: 'sol-214',
      label: 'Sol 214 telemetry packet',
      value: TELEMETRY,
      preview: `Probe ${TELEMETRY.probe}, sol ${TELEMETRY.sol}: ${TELEMETRY.discoveries.join('; ')}`,
    },
  ],
  providers: [{ id: 'beacon-2', name: 'Beacon-2', blurb: 'The mission-log composer aboard the relay station.', tier: 'primary' }],
  tasks: [
    {
      id: 'compose-log',
      name: 'Compose the mission log',
      description: 'Merge telemetry and archive context into a structured mission log.',
      expectsJson: true,
      mock: ({ scenarios, resumed }) => {
        if (scenarios.has('solar-flare') && !resumed) {
          return interrupt('Solar flare! Power lost mid-composition. A checkpoint preserved every completed step.');
        }
        return ok(MISSION_LOG);
      },
      livePrompt: (ctx) =>
        `Compose a mission log. Respond with ONLY JSON: {"title": string, "status": string, "highlights": string[], "concerns": string[], "batteryPct": number}.\n\n${JSON.stringify(ctx.last, null, 2)}`,
    },
  ],
  tools: [
    {
      id: 'transmit-log',
      name: 'Deep-space relay (simulated)',
      description: 'Transmits the mission log to mission control. Simulated — nothing leaves this machine.',
      mock: ({ attempt, scenarios, ctx }) => {
        if (scenarios.has('relay-static') && attempt === 1) {
          return failWith('tool-error', 'Relay static: transmission garbled (simulated). Safe to retry.', true);
        }
        return ok({ transmitted: true, logId: 'log-sol214-a41', log: ctx.last, relay: 'DSN Canberra (simulated)' });
      },
    },
  ],
  sources: [
    {
      id: 'mission-archive',
      name: 'Mission archive',
      description: 'Recent mission logs and ops notes for context.',
      search: (_query, topK) => ARCHIVE_DOCS.slice(0, topK),
    },
  ],
  schemas: [
    {
      id: 'transmission-receipt',
      name: 'Transmission receipt schema',
      rules: ['transmitted: true', 'logId present', 'log: the structured mission log', 'relay named'],
      schema,
    },
    {
      id: 'mission-log',
      name: 'Mission log schema',
      rules: ['title: at least 10 characters', 'status: string', 'highlights: at least 1', 'concerns: array', 'batteryPct: number'],
      schema: z.object({
        title: z.string().min(10),
        status: z.string(),
        highlights: z.array(z.string()).min(1),
        concerns: z.array(z.string()),
        batteryPct: z.number(),
      }),
    },
  ],
  conditions: [],
  transforms: [
    {
      id: 'compile-nav',
      name: 'Compile briefing packet',
      description: 'Merges the telemetry with the retrieved archive context.',
      apply: (ctx) => {
        const telemetry = ctx.input as typeof TELEMETRY;
        const retrieval = Object.entries(ctx.kinds).find(([, kind]) => kind === 'retrieval');
        const docs = retrieval ? (ctx.outputs[retrieval[0]] as { docs: typeof ARCHIVE_DOCS }).docs : [];
        return {
          telemetry,
          context: docs.map((d) => `${d.title}: ${d.snippet}`),
        };
      },
    },
  ],
  defaults: [],
  palette: [
    {
      id: 'upgrade-retry',
      type: 'upgrade-retry',
      name: 'Retry ×2',
      emoji: '🔁',
      blurb: 'Drop onto the relay step: rides out transmission static.',
    },
    {
      id: 'add-validator',
      type: 'step',
      name: 'Validator',
      emoji: '🛡️',
      blurb: 'Checks the composed mission log before it is transmitted.',
      maxInstances: 1,
      make: () => mkValidator(uid(), 'Validate mission log', 'mission-log', { retryPrevious: 1, finalAction: 'safe-stop' }),
    },
  ],
  initialWorkflow: [
    mkInput(),
    mkRetrieval('step-archive', 'Pull mission archive', 'mission-archive', 3),
    mkTransform('step-compile', 'Compile briefing packet', 'compile-nav'),
    mkAi('step-compose', 'Compose mission log', 'compose-log', 'beacon-2'),
    mkTool('step-transmit', 'Transmit to mission control', 'transmit-log'),
    mkOutput(),
  ],
  failureScenarios: [
    {
      id: 'solar-flare',
      name: 'Solar flare',
      emoji: '☀️',
      description: 'Power dies during log composition. The run is interrupted — but a checkpoint saves every completed step. (One-shot: the resumed run is safe.)',
      attacks: 'the whole pipeline, mid-run',
      counteredBy: [], // cannot be prevented in-flow — only a checkpoint resume recovers it
    },
    {
      id: 'relay-static',
      name: 'Relay static',
      emoji: '📡',
      description: 'The first transmission attempt is garbled. A retry gets it through.',
      attacks: 'the transmission step with a transient error',
      counteredBy: ['retry'],
    },
  ],
  criteria: [
    {
      id: 'clean-mission',
      label: 'Transmit on a quiet day',
      detail: 'With no scenarios, the log composes and transmits with a valid receipt.',
      test: (r) => r.scenarios.length === 0 && r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'feel-the-flare',
      label: 'Get interrupted (on purpose)',
      detail: 'With "Solar flare" on, the run must end interrupted — and the trace must show a saved checkpoint.',
      test: (r) => r.scenarios.includes('solar-flare') && r.status === 'interrupted' && r.checkpoint !== undefined,
    },
    {
      id: 'resume-flight',
      label: 'Resume from the last good step',
      detail: 'Resume the interrupted run: completed steps are restored, not re-run, and the log still transmits.',
      test: (r) => r.resumed && r.status === 'completed' && r.finalOutputValid === true && r.stepsRestored >= 3,
    },
  ],
  hints: [
    'Enable "Solar flare" and run. The pipeline dies at composition — but look at the trace: a checkpoint saved input, archive, and briefing steps.',
    'A "Resume from checkpoint" button appears in the run panel after an interruption. Use it — restored steps show a 💾 badge instead of re-running.',
    'Add "Relay static" plus a Retry ×2 on the transmit step for the full drill: resume, retry, transmit.',
  ],
  solution: [
    mkInput(),
    mkRetrieval('step-archive', 'Pull mission archive', 'mission-archive', 3),
    mkTransform('step-compile', 'Compile briefing packet', 'compile-nav'),
    mkAi('step-compose', 'Compose mission log', 'compose-log', 'beacon-2'),
    mkValidator('step-validate', 'Validate mission log', 'mission-log', { retryPrevious: 1, finalAction: 'safe-stop' }),
    mkTool('step-transmit', 'Transmit to mission control', 'transmit-log', { upgrades: { retry: { attempts: 2 } } }),
    mkOutput(),
  ],
  solutionScenarioSets: [[], ['relay-static']],
};
