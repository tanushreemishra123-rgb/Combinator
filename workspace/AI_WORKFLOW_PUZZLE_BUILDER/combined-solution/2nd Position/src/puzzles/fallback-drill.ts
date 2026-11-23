import { z } from 'zod';
import type { Puzzle } from './types';
import { mkAi, mkInput, mkOutput, mkValidator, ok, timeout } from './blocks';
import { uid } from '../engine/util';

const ARTICLE = {
  headline: 'Solar balloon startup sets new stratospheric altitude record',
  body:
    'Helios Loft, a four-person startup from Tallinn, flew an unmanned solar-heated balloon to 23.4 km — a new record for zero-fuel flight. ' +
    'The craft carried a 2 kg atmospheric sensor package and stayed aloft for 31 hours. The team plans a transatlantic attempt next spring, ' +
    'pending aviation authority approval.',
};

const ATLAS_DIGEST = {
  headline: ARTICLE.headline,
  digest:
    'Estonian startup Helios Loft flew a zero-fuel, solar-heated balloon to a record 23.4 km, carrying sensors aloft for 31 hours; a transatlantic attempt is planned for spring.',
  sentiment: 'positive',
};

const POCKET_DIGEST = {
  headline: ARTICLE.headline,
  digest:
    'Helios Loft set a solar balloon altitude record of 23.4 km on a 31-hour flight. The startup plans a transatlantic attempt next. (Summarized by the small on-device fallback model.)',
  sentiment: 'positive',
};

const schema = z.object({
  headline: z.string().min(10),
  digest: z.string().min(60).max(400),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
});

export const fallbackDrill: Puzzle = {
  id: 'fallback-drill',
  order: 7,
  title: 'Activate the Fallback',
  emoji: '🪂',
  difficulty: 'advanced',
  tagline: 'The big model is down. Retry, then reach for the small one.',
  objective:
    'Digest a news article with the flagship Atlas-70B model. Atlas has two moods: a brownout (fails twice, then answers) and a full outage (never answers). Configure retries for the brownout and a fallback to the small Pocket-7B model for the outage — and make sure whatever answers still passes validation.',
  learning: [
    'Retry-with-a-budget rides out brownouts; unlimited retries just hammer a dead service',
    'A smaller fallback model that answers beats a perfect model that does not',
    'The trace should show the whole cascade: attempts, the switch, and who finally answered',
  ],
  expected: {
    description: 'A JSON digest: headline, a 60–400 character digest, and a sentiment label.',
    schemaId: 'article-digest',
  },
  samples: [{ id: 'balloon-article', label: 'Solar balloon article', value: ARTICLE, preview: `${ARTICLE.headline} — ${ARTICLE.body}` }],
  providers: [
    { id: 'atlas-70b', name: 'Atlas-70B', blurb: 'The flagship mock model. Brilliant when reachable.', tier: 'primary' },
    { id: 'pocket-7b', name: 'Pocket-7B', blurb: 'A small, boring, always-available mock model. Plainer prose, same schema.', tier: 'fallback' },
  ],
  tasks: [
    {
      id: 'digest-article',
      name: 'Digest the article',
      description: 'Produce JSON: headline, digest (60–400 chars), sentiment.',
      expectsJson: true,
      mock: ({ providerId, attempt, scenarios }) => {
        if (providerId === 'pocket-7b') {
          return ok(POCKET_DIGEST, 'Answered by the fallback model.');
        }
        if (scenarios.has('atlas-outage')) {
          return timeout('Atlas-70B', 12000);
        }
        if (scenarios.has('atlas-brownout') && attempt <= 2) {
          return timeout('Atlas-70B', 12000);
        }
        return ok(ATLAS_DIGEST);
      },
      livePrompt: (ctx) =>
        `Digest this article. Respond with ONLY JSON: {"headline": string, "digest": string (60-400 chars), "sentiment": "positive"|"neutral"|"negative"}.\n\n${JSON.stringify(ctx.input, null, 2)}`,
    },
  ],
  tools: [],
  sources: [],
  schemas: [
    {
      id: 'article-digest',
      name: 'Article digest schema',
      rules: ['headline: string', 'digest: 60–400 characters', 'sentiment: positive | neutral | negative'],
      schema,
    },
  ],
  conditions: [],
  transforms: [],
  defaults: [
    {
      id: 'digest-unavailable',
      name: 'Honest unavailability notice',
      description: 'A schema-valid notice that admits no model was reachable.',
      value: {
        headline: ARTICLE.headline,
        digest:
          'No summarization model was reachable, so this article has not been digested. The full text is preserved for manual review — no AI content was fabricated.',
        sentiment: 'neutral',
      },
    },
  ],
  palette: [
    {
      id: 'upgrade-retry',
      type: 'upgrade-retry',
      name: 'Retry ×2',
      emoji: '🔁',
      blurb: 'Drop onto the AI step: two extra attempts for Atlas before giving up.',
    },
    {
      id: 'upgrade-fallback-pocket',
      type: 'upgrade-fallback',
      name: 'Fallback: Pocket-7B',
      emoji: '🪂',
      blurb: 'Drop onto the AI step: when Atlas is exhausted, switch to the small always-on model.',
      fallback: { type: 'provider', providerId: 'pocket-7b' },
    },
    {
      id: 'add-validator',
      type: 'step',
      name: 'Validator',
      emoji: '🛡️',
      blurb: 'Whoever answers — flagship or fallback — the digest must still pass the schema.',
      maxInstances: 1,
      make: () => mkValidator(uid(), 'Validate digest', 'article-digest', { finalAction: 'safe-stop' }),
    },
  ],
  initialWorkflow: [
    mkInput(),
    mkAi('step-digest', 'Digest with Atlas-70B', 'digest-article', 'atlas-70b'),
    mkOutput(),
  ],
  failureScenarios: [
    {
      id: 'atlas-brownout',
      name: 'Atlas brownout',
      emoji: '🌤️',
      description: 'Atlas times out twice, then answers. A retry budget of 2 rides it out.',
      attacks: 'the primary model with transient timeouts',
      counteredBy: ['retry', 'fallback'],
    },
    {
      id: 'atlas-outage',
      name: 'Atlas outage',
      emoji: '⛈️',
      description: 'Atlas is down hard — every attempt times out. Only the fallback model can answer.',
      attacks: 'the primary model with a total outage',
      counteredBy: ['fallback'],
    },
  ],
  criteria: [
    {
      id: 'clean-digest',
      label: 'Digest on a sunny day',
      detail: 'With no scenarios, Atlas answers first try with a valid digest.',
      test: (r) => r.scenarios.length === 0 && r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'ride-brownout',
      label: 'Ride out the brownout',
      detail: 'With "Atlas brownout" on, retries alone recover — the trace shows the attempt cascade.',
      test: (r) => r.scenarios.includes('atlas-brownout') && r.status === 'completed' && r.finalOutputValid === true && r.retriesUsed >= 1,
    },
    {
      id: 'switch-in-outage',
      label: 'Switch models in the outage',
      detail: 'With "Atlas outage" on, Pocket-7B answers after Atlas is exhausted — and its output still validates.',
      test: (r) =>
        r.scenarios.includes('atlas-outage') &&
        r.status === 'completed' &&
        r.finalOutputValid === true &&
        r.fallbacksActivated.length > 0,
    },
  ],
  hints: [
    'Enable "Atlas brownout" and run the naive workflow: one timeout kills the whole run. Atlas would have answered on attempt 3.',
    'Drop Retry ×2 onto the AI step. Then enable "Atlas outage" instead — now every attempt fails. Retries are not a plan for a dead service.',
    'Add the Pocket-7B fallback chip too. Watch the trace: three Atlas attempts, the switch, and a plainer-but-valid digest from the small model.',
  ],
  solution: [
    mkInput(),
    mkAi('step-digest', 'Digest with Atlas-70B', 'digest-article', 'atlas-70b', {
      upgrades: { retry: { attempts: 2 }, fallback: { type: 'provider', providerId: 'pocket-7b' } },
      onExhausted: 'safe-stop',
    }),
    mkValidator('step-validate', 'Validate digest', 'article-digest', { finalAction: 'safe-stop' }),
    mkOutput(),
  ],
  solutionScenarioSets: [[], ['atlas-brownout'], ['atlas-outage']],
};
