import { z } from 'zod';
import type { Puzzle } from './types';
import { mkAi, mkInput, mkOutput, mkValidator, ok } from './blocks';
import { uid } from '../engine/util';

const NOTES = `Team sync — Atlas mobile app, Mon 10:00
- Maya: crash rate on Android up 0.8% after v2.4; suspects the new image cache.
- Decision: roll back the image cache to v2.3 behaviour this week.
- Jonas volunteers to prepare the rollback build by Thursday.
- Decision: pause the A/B test on onboarding until crashes are fixed.
- Someone should tell support about the known crash — nobody claimed it.
- Priya: design review for dark mode moved to next Tuesday.`;

const CLEAN_RESULT = {
  summary:
    'The team investigated an Android crash-rate increase linked to the new image cache, agreed to roll it back this week, and paused the onboarding A/B test until crashes are resolved.',
  decisions: ['Roll back the image cache to v2.3 behaviour this week', 'Pause the onboarding A/B test until crashes are fixed'],
  actionItems: [
    { task: 'Prepare the rollback build by Thursday', owner: 'Jonas' },
    { task: 'Notify support about the known crash', owner: 'Maya' },
  ],
};

/** Same content, but one action item lost its owner. */
const MISSING_OWNER_RESULT = {
  ...CLEAN_RESULT,
  actionItems: [
    { task: 'Prepare the rollback build by Thursday', owner: 'Jonas' },
    { task: 'Notify support about the known crash' },
  ],
};

const fence = (value: unknown) => 'Sure! Here is the summary you asked for:\n\n```json\n' + JSON.stringify(value, null, 2) + '\n```';

const schema = z.object({
  summary: z.string().min(20),
  decisions: z.array(z.string().min(3)),
  actionItems: z
    .array(z.object({ task: z.string().min(3), owner: z.string().min(1) }))
    .min(1),
});

export const meetingSummarizer: Puzzle = {
  id: 'meeting-summarizer',
  order: 1,
  title: 'Fix the Meeting Summarizer',
  emoji: '📝',
  difficulty: 'beginner',
  tagline: 'The summarizer works… until the model gets sloppy. Stop invalid data.',
  objective:
    'Turn raw meeting notes into a structured summary with decisions and action items. The model sometimes wraps its JSON in chatty markdown, and sometimes forgets an owner. Make sure only valid, complete summaries ever reach the output.',
  learning: [
    'Why "the run finished" is not the same as "the output is valid"',
    'Retrying fixes flaky formatting; repair fixes what retrying cannot',
    'A validator is the difference between silent garbage and caught garbage',
  ],
  expected: {
    description: 'A JSON object with `summary`, `decisions[]`, and `actionItems[]` where every action item has a task and an owner.',
    schemaId: 'meeting-summary',
  },
  samples: [
    {
      id: 'sync-notes',
      label: 'Atlas team sync notes',
      value: NOTES,
      preview: NOTES,
    },
  ],
  providers: [{ id: 'scribe-1', name: 'Scribe-1', blurb: 'A capable mock summarization model.', tier: 'primary' }],
  tasks: [
    {
      id: 'summarize-meeting',
      name: 'Summarize meeting notes',
      description: 'Produce JSON: summary, decisions[], actionItems[{task, owner}].',
      expectsJson: true,
      mock: ({ attempt, scenarios }) => {
        const body = scenarios.has('missing-owner') ? MISSING_OWNER_RESULT : CLEAN_RESULT;
        if (scenarios.has('sloppy-json') && attempt === 1) {
          return ok(fence(body), 'First attempt came back wrapped in markdown chatter.');
        }
        return ok(body);
      },
      livePrompt: (ctx) =>
        `Summarize these meeting notes. Respond with ONLY a JSON object shaped like {"summary": string, "decisions": string[], "actionItems": [{"task": string, "owner": string}]} and no other text.\n\nNotes:\n${String(ctx.input)}`,
    },
  ],
  tools: [],
  sources: [],
  schemas: [
    {
      id: 'meeting-summary',
      name: 'Meeting summary schema',
      rules: [
        'summary: string, at least 20 characters',
        'decisions: array of strings',
        'actionItems: at least one item, each with task AND owner',
      ],
      schema,
      repair: (value) => {
        let candidate: unknown = value;
        const notes: string[] = [];
        if (typeof candidate === 'object' && candidate !== null && (candidate as any).malformed === true) {
          const raw = String((candidate as any).raw);
          const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (!match) return null;
          try {
            candidate = JSON.parse(match[1]);
            notes.push('Stripped markdown code fences and re-parsed the JSON.');
          } catch {
            return null;
          }
        }
        if (typeof candidate !== 'object' || candidate === null) return null;
        const draft = structuredClone(candidate) as any;
        if (Array.isArray(draft.actionItems)) {
          for (const item of draft.actionItems) {
            if (item && typeof item === 'object' && !item.owner) {
              item.owner = 'Unassigned ⚠️ (flag for follow-up)';
              notes.push(`Filled missing owner on "${item.task}" with an explicit "Unassigned" flag.`);
            }
          }
        }
        return { value: draft, notes };
      },
    },
  ],
  conditions: [],
  transforms: [],
  defaults: [
    {
      id: 'manual-review-summary',
      name: 'Manual-review notice',
      description: 'A schema-valid placeholder that routes the notes to a human instead of shipping garbage.',
      value: {
        summary: 'Automatic summarization failed validation. The raw notes have been flagged for manual review.',
        decisions: [],
        actionItems: [{ task: 'Summarize the meeting notes manually', owner: 'Unassigned ⚠️ (flag for follow-up)' }],
      },
    },
  ],
  palette: [
    {
      id: 'add-validator',
      type: 'step',
      name: 'Validator',
      emoji: '🛡️',
      blurb: 'Checks the previous step against the meeting-summary schema and can retry, repair, or stop safely.',
      maxInstances: 1,
      make: () =>
        mkValidator(uid(), 'Validate summary', 'meeting-summary', {
          retryPrevious: 1,
          repair: false,
          finalAction: 'safe-stop',
        }),
    },
    {
      id: 'upgrade-retry',
      type: 'upgrade-retry',
      name: 'Retry ×2',
      emoji: '🔁',
      blurb: 'Drop onto the AI step: gives it up to 2 extra attempts when a call hard-fails.',
    },
  ],
  initialWorkflow: [
    mkInput(),
    mkAi('step-summarize', 'Summarize notes', 'summarize-meeting', 'scribe-1'),
    mkOutput(),
  ],
  failureScenarios: [
    {
      id: 'sloppy-json',
      name: 'Sloppy JSON',
      emoji: '🫠',
      description: 'The model wraps its first answer in markdown chatter, so it is not parseable JSON.',
      attacks: "the summarizer's output format",
      counteredBy: ['validator'],
    },
    {
      id: 'missing-owner',
      name: 'Missing owner',
      emoji: '👻',
      description: 'One action item comes back without an owner — on every attempt, so retrying alone will not fix it.',
      attacks: 'a required field in the structured output',
      counteredBy: ['validator', 'human'],
    },
  ],
  criteria: [
    {
      id: 'clean-run',
      label: 'Finish a clean run',
      detail: 'Run with no failure scenarios and produce a schema-valid summary.',
      test: (r) => r.scenarios.length === 0 && r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'survive-sloppy',
      label: 'Survive "Sloppy JSON"',
      detail: 'With Sloppy JSON enabled, still finish with a valid summary (hint: a validator that retries).',
      test: (r) => r.scenarios.includes('sloppy-json') && r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'survive-owner',
      label: 'Survive "Missing owner"',
      detail: 'With Missing owner enabled, still finish valid — retrying will not help, repair will.',
      test: (r) => r.scenarios.includes('missing-owner') && r.status === 'completed' && r.finalOutputValid === true,
    },
  ],
  hints: [
    'Run once with "Sloppy JSON" on and look at the final output panel — the run "succeeds" but ships unparseable text. Nothing caught it.',
    'Add the Validator block between the AI step and the Output. Its retry strategy re-asks the model, which fixes formatting flukes.',
    'For "Missing owner", retrying returns the same gap every time. Open the validator settings and enable Repair — it fills the owner with an explicit "Unassigned" flag.',
  ],
  solution: [
    mkInput(),
    mkAi('step-summarize', 'Summarize notes', 'summarize-meeting', 'scribe-1'),
    mkValidator('step-validate', 'Validate summary', 'meeting-summary', {
      retryPrevious: 1,
      repair: true,
      finalAction: 'safe-stop',
    }),
    mkOutput(),
  ],
  solutionScenarioSets: [[], ['sloppy-json'], ['missing-owner'], ['sloppy-json', 'missing-owner']],
};
