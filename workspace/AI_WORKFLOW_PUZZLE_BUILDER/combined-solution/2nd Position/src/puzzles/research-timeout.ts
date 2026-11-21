import { z } from 'zod';
import type { Puzzle } from './types';
import { mkAi, mkInput, mkOutput, mkTool, mkTransform, mkValidator, ok, timeout } from './blocks';
import { uid } from '../engine/util';

const TOPIC = { topic: 'Impact of urban rooftop gardens on building energy use' };

const NEWS_FINDINGS = [
  'City pilot: 40 rooftop gardens cut summer cooling demand by 12% on average (Metro Times, simulated).',
  'Insurers begin offering premium discounts for green-roof buildings (Business Daily, simulated).',
];

const JOURNAL_FINDINGS = [
  'Peer-reviewed study: extensive green roofs reduce roof-surface temperature by 15–20 °C in heatwaves (J. Urban Climate, simulated).',
  'Meta-analysis: median 8% annual HVAC energy saving across 47 retrofitted buildings (Energy & Buildings, simulated).',
];

const ARCHIVE_FINDINGS = [
  'Cached copy (last week): green-roof retrofits show 6–10% HVAC savings across temperate cities (Archive mirror of J. Urban Climate).',
  'Cached copy (last week): rooftop soil depth is the main driver of insulation benefit (Archive mirror).',
];

const schema = z.object({
  brief: z.string().min(60),
  sourcesUsed: z.number().min(2, 'a research brief needs at least 2 sources'),
  findings: z.array(z.string()).min(3),
});

export const researchTimeout: Puzzle = {
  id: 'research-timeout',
  order: 4,
  title: 'Survive the Research Timeout',
  emoji: '⏱️',
  difficulty: 'intermediate',
  tagline: 'One source is flaky, one is down. Retry the flake, fall back for the outage.',
  objective:
    'Combine findings from a news scan and a journal index into one research brief. The journal API is unreliable: sometimes it recovers if you just try again, sometimes it is down hard and you need the cached archive instead. Keep the brief flowing either way.',
  learning: [
    'Retries absorb transient failures; fallbacks absorb hard outages',
    'A timeout is a normal event in distributed systems, not an emergency',
    'Degraded data (a cached copy) is often better than no data — if you label it',
  ],
  expected: {
    description: 'A research brief built from at least 2 sources with at least 3 combined findings.',
    schemaId: 'research-brief',
  },
  samples: [{ id: 'rooftop-topic', label: 'Rooftop gardens research topic', value: TOPIC, preview: TOPIC.topic }],
  providers: [{ id: 'quill-3', name: 'Quill-3', blurb: 'A mock writing model that composes briefs from findings.', tier: 'primary' }],
  tasks: [
    {
      id: 'compose-brief',
      name: 'Compose the research brief',
      description: 'Write a short brief from the merged findings. Produces JSON: brief, sourcesUsed, findings[].',
      expectsJson: true,
      mock: ({ ctx }) => {
        const merged = ctx.last as { sources: number; findings: string[] };
        return ok({
          brief:
            `Across ${merged.sources} sources, evidence consistently shows rooftop gardens reduce building cooling demand ` +
            `(≈8–12% HVAC savings) and cut roof-surface temperatures sharply during heat events. ` +
            `Municipal pilots and insurers are already responding with incentives.`,
          sourcesUsed: merged.sources,
          findings: merged.findings,
        });
      },
      livePrompt: (ctx) =>
        `Write a 3-sentence research brief from these findings. Respond with ONLY JSON: {"brief": string, "sourcesUsed": number, "findings": string[]}.\n\n${JSON.stringify(ctx.last, null, 2)}`,
    },
  ],
  tools: [
    {
      id: 'news-scan',
      name: 'News scan API',
      description: 'Simulated news search — reliable.',
      mock: () => ok({ source: 'News scan', findings: NEWS_FINDINGS }),
    },
    {
      id: 'journal-search',
      name: 'Journal index API',
      description: 'Simulated academic index — the unreliable one in this puzzle.',
      mock: ({ attempt, scenarios }) => {
        if (scenarios.has('journal-outage')) {
          return timeout('Journal index API', 8000);
        }
        if (scenarios.has('flaky-network') && attempt <= 2) {
          return timeout('Journal index API', 8000);
        }
        return ok({ source: 'Journal index', findings: JOURNAL_FINDINGS });
      },
    },
    {
      id: 'archive-cache',
      name: 'Archive cache (stale)',
      description: 'A local cache of last week’s journal results. Always available, clearly labeled as stale.',
      mock: () => ok({ source: 'Archive cache (stale — last week)', findings: ARCHIVE_FINDINGS }),
    },
  ],
  sources: [],
  schemas: [
    {
      id: 'research-brief',
      name: 'Research brief schema',
      rules: ['brief: string, at least 60 characters', 'sourcesUsed: at least 2', 'findings: at least 3 combined findings'],
      schema,
    },
  ],
  conditions: [],
  transforms: [
    {
      id: 'merge-findings',
      name: 'Merge source findings',
      description: 'Combines the findings of every completed tool step into one deck.',
      apply: (ctx) => {
        const findings: string[] = [];
        let sources = 0;
        for (const [stepId, kind] of Object.entries(ctx.kinds)) {
          if (kind !== 'tool') continue;
          const out = ctx.outputs[stepId] as { source?: string; findings?: string[] } | undefined;
          if (out && Array.isArray(out.findings)) {
            sources++;
            findings.push(...out.findings.map((f) => `[${out.source}] ${f}`));
          }
        }
        return { sources, findings };
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
      blurb: 'Drop onto a tool step: up to 2 extra attempts. Perfect for transient timeouts.',
    },
    {
      id: 'upgrade-fallback-archive',
      type: 'upgrade-fallback',
      name: 'Fallback: archive cache',
      emoji: '🪂',
      blurb: 'Drop onto the journal step: when every attempt fails, use last week’s cached results instead.',
      fallback: { type: 'tool', toolId: 'archive-cache' },
    },
    {
      id: 'add-validator',
      type: 'step',
      name: 'Validator',
      emoji: '🛡️',
      blurb: 'Checks the composed brief: enough sources, enough findings.',
      maxInstances: 1,
      make: () => mkValidator(uid(), 'Validate brief', 'research-brief', { retryPrevious: 1, finalAction: 'safe-stop' }),
    },
  ],
  initialWorkflow: [
    mkInput(),
    mkTool('step-news', 'Scan the news', 'news-scan'),
    mkTool('step-journal', 'Search journals', 'journal-search'),
    mkTransform('step-merge', 'Merge findings', 'merge-findings'),
    mkAi('step-compose', 'Compose brief', 'compose-brief', 'quill-3'),
    mkOutput(),
  ],
  failureScenarios: [
    {
      id: 'flaky-network',
      name: 'Flaky network',
      emoji: '📶',
      description: 'The journal API times out twice, then recovers. A retry or two rides it out.',
      attacks: 'the journal search with transient timeouts',
      counteredBy: ['retry', 'fallback'],
    },
    {
      id: 'journal-outage',
      name: 'Journal outage',
      emoji: '🔌',
      description: 'The journal API is down hard — every attempt times out. Only a fallback source helps.',
      attacks: 'the journal search with a total outage',
      counteredBy: ['fallback'],
    },
  ],
  criteria: [
    {
      id: 'clean-brief',
      label: 'Compose a clean brief',
      detail: 'With no scenarios, merge both sources into a valid brief.',
      test: (r) => r.scenarios.length === 0 && r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'ride-out-flake',
      label: 'Ride out the flaky network',
      detail: 'With "Flaky network" on, recover using at least one retry and still ship a valid brief.',
      test: (r) =>
        r.scenarios.includes('flaky-network') && r.status === 'completed' && r.finalOutputValid === true && r.retriesUsed >= 1,
    },
    {
      id: 'survive-outage',
      label: 'Survive the outage with a fallback',
      detail: 'With "Journal outage" on, the archive cache must step in — and the brief still validates.',
      test: (r) =>
        r.scenarios.includes('journal-outage') &&
        r.status === 'completed' &&
        r.finalOutputValid === true &&
        r.fallbacksActivated.length > 0,
    },
  ],
  hints: [
    'Enable "Flaky network" and run: the journal step dies on its first timeout. Check the trace — the API would have answered on attempt 3.',
    'Drag the Retry ×2 chip onto the journal step. Transient timeouts are exactly what retries are for.',
    'For "Journal outage", retries are not enough — drag the archive-cache Fallback onto the journal step too. Note the stale label in the merged findings.',
  ],
  solution: [
    mkInput(),
    mkTool('step-news', 'Scan the news', 'news-scan'),
    mkTool('step-journal', 'Search journals', 'journal-search', {
      upgrades: { retry: { attempts: 2 }, fallback: { type: 'tool', toolId: 'archive-cache' } },
      onExhausted: 'safe-stop',
    }),
    mkTransform('step-merge', 'Merge findings', 'merge-findings'),
    mkAi('step-compose', 'Compose brief', 'compose-brief', 'quill-3'),
    mkValidator('step-validate', 'Validate brief', 'research-brief', { retryPrevious: 1, finalAction: 'safe-stop' }),
    mkOutput(),
  ],
  solutionScenarioSets: [[], ['flaky-network'], ['journal-outage']],
};
