import { z } from 'zod';
import type { Puzzle } from './types';
import { mkAi, mkInput, mkOutput, mkValidator, ok } from './blocks';
import { uid } from '../engine/util';

const MESSY_EMAIL = `From: accounts@brightleaf.example
Subject: pls process!!

hey — attaching the october invoice from Brightleaf Nurseries.
total came to twelve hundred dollars even, due end of month (2026-10-31).
their billing person is sam ito, reachable at s.ito@brightleaf.example if anything's off.
thx!!`;

const CLEAN_RECORD = {
  vendor: 'Brightleaf Nurseries',
  contactEmail: 's.ito@brightleaf.example',
  amountUSD: 1200,
  dueDate: '2026-10-31',
};

const fence = (value: unknown) => "Here's the extracted record:\n\n```json\n" + JSON.stringify(value, null, 2) + '\n```\n\nLet me know if you need anything else!';

const schema = z.object({
  vendor: z.string().min(2),
  contactEmail: z.string().includes('@', { message: 'contactEmail must be an email address' }),
  amountUSD: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD'),
});

const WORD_AMOUNTS: Record<string, number> = {
  'twelve hundred': 1200,
  'twelve hundred dollars': 1200,
  'one thousand two hundred': 1200,
};

function buildRecord(scenarios: ReadonlySet<string>): Record<string, unknown> {
  const record: Record<string, unknown> = { ...CLEAN_RECORD };
  if (scenarios.has('word-numbers')) record.amountUSD = 'twelve hundred dollars';
  if (scenarios.has('amnesia')) delete record.contactEmail;
  return record;
}

export const dataExtractor: Puzzle = {
  id: 'data-extractor',
  order: 6,
  title: 'Validate the Data Extractor',
  emoji: '🔬',
  difficulty: 'advanced',
  tagline: 'Three ways to return garbage. One escalation ladder to catch them all.',
  objective:
    'Extract a structured invoice record from a messy email. The extractor has three failure modes: markdown-fenced JSON, amounts written in words, and a forgotten email field. Build one validator whose escalation ladder — retry, repair, then human — handles all three.',
  learning: [
    'Different invalid outputs need different fixes: retry for flukes, repair for predictable quirks, humans for missing facts',
    'An escalation ladder tries the cheapest fix first and the human last',
    'A repair should leave a note — silent fixes are future bugs',
  ],
  expected: {
    description: 'A JSON invoice record: vendor, contactEmail, amountUSD (number), dueDate (YYYY-MM-DD).',
    schemaId: 'invoice-record',
  },
  samples: [
    { id: 'brightleaf-email', label: 'Messy Brightleaf invoice email', value: MESSY_EMAIL, preview: MESSY_EMAIL },
  ],
  providers: [{ id: 'lens-4', name: 'Lens-4', blurb: 'A mock extraction model with three documented bad habits.', tier: 'primary' }],
  tasks: [
    {
      id: 'extract-invoice',
      name: 'Extract the invoice record',
      description: 'Produce JSON: vendor, contactEmail, amountUSD, dueDate.',
      expectsJson: true,
      mock: ({ attempt, scenarios }) => {
        const record = buildRecord(scenarios);
        if (scenarios.has('fence-glitch') && attempt === 1) {
          return ok(fence(record), 'First attempt wrapped the JSON in markdown chatter.');
        }
        return ok(record);
      },
      livePrompt: (ctx) =>
        `Extract an invoice record from this email. Respond with ONLY JSON: {"vendor": string, "contactEmail": string, "amountUSD": number, "dueDate": "YYYY-MM-DD"}.\n\n${String(ctx.input)}`,
    },
  ],
  tools: [],
  sources: [],
  schemas: [
    {
      id: 'invoice-record',
      name: 'Invoice record schema',
      rules: [
        'vendor: string',
        'contactEmail: must contain @',
        'amountUSD: a positive number (not words, not a string)',
        'dueDate: YYYY-MM-DD',
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
        if (typeof draft.amountUSD === 'string') {
          const key = draft.amountUSD.toLowerCase().replace(/[^a-z ]/g, '').trim();
          const numeric = Number(draft.amountUSD.replace(/[$,]/g, ''));
          if (WORD_AMOUNTS[key] !== undefined) {
            notes.push(`Converted amount written in words ("${draft.amountUSD}") to the number ${WORD_AMOUNTS[key]}.`);
            draft.amountUSD = WORD_AMOUNTS[key];
          } else if (Number.isFinite(numeric) && numeric > 0) {
            notes.push(`Parsed the amount string "${draft.amountUSD}" as the number ${numeric}.`);
            draft.amountUSD = numeric;
          }
        }
        return notes.length > 0 ? { value: draft, notes } : null;
      },
    },
  ],
  conditions: [],
  transforms: [],
  defaults: [],
  palette: [
    {
      id: 'add-validator',
      type: 'step',
      name: 'Validator',
      emoji: '🛡️',
      blurb: 'The full escalation ladder: retry the extractor, repair predictable quirks, escalate to a human, or stop safely.',
      maxInstances: 1,
      make: () =>
        mkValidator(uid(), 'Validate record', 'invoice-record', {
          retryPrevious: 1,
          repair: true,
          escalate: true,
          finalAction: 'safe-stop',
        }),
    },
  ],
  initialWorkflow: [
    mkInput(),
    mkAi('step-extract', 'Extract record', 'extract-invoice', 'lens-4'),
    mkOutput(),
  ],
  failureScenarios: [
    {
      id: 'fence-glitch',
      name: 'Fence glitch',
      emoji: '🧱',
      description: 'The first attempt wraps the JSON in markdown fences and chatter. A retry gets a clean answer.',
      attacks: 'the parseability of the extracted record',
      counteredBy: ['validator'],
    },
    {
      id: 'word-numbers',
      name: 'Word numbers',
      emoji: '🔤',
      description: 'The amount comes back as "twelve hundred dollars" — a string, on every attempt. Repair converts it.',
      attacks: 'the type of the amount field',
      counteredBy: ['validator'],
    },
    {
      id: 'amnesia',
      name: 'Field amnesia',
      emoji: '🫥',
      description: 'The contact email vanishes from the extraction — every attempt. Only a human can restore a fact the model dropped.',
      attacks: 'a required field no automation can invent',
      counteredBy: ['human', 'validator'],
    },
  ],
  criteria: [
    {
      id: 'clean-extract',
      label: 'Extract a clean record',
      detail: 'With no scenarios, ship a schema-valid invoice record.',
      test: (r) => r.scenarios.length === 0 && r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'retry-fixes-fences',
      label: 'Retry through the fence glitch',
      detail: 'With "Fence glitch" on, a retry gets clean JSON and the record validates.',
      test: (r) => r.scenarios.includes('fence-glitch') && r.status === 'completed' && r.finalOutputValid === true && r.retriesUsed >= 1,
    },
    {
      id: 'repair-fixes-words',
      label: 'Repair the word numbers',
      detail: 'With "Word numbers" on, an automatic repair converts the amount — with a note in the trace.',
      test: (r) => r.scenarios.includes('word-numbers') && r.status === 'completed' && r.finalOutputValid === true && r.repairsApplied >= 1,
    },
    {
      id: 'human-restores-email',
      label: 'Let a human restore the email',
      detail: 'With "Field amnesia" on, the validator escalates and a recorded human fix completes the record.',
      test: (r) =>
        r.scenarios.includes('amnesia') &&
        r.status === 'completed' &&
        r.finalOutputValid === true &&
        r.humanDecisions.some((d) => d.mode === 'fix' && d.decision.action === 'edit'),
    },
  ],
  hints: [
    'Enable one scenario at a time and read the validator issues in the trace — each failure mode reports differently.',
    'One Validator block covers all three: retry (fixes the fence fluke), repair (fixes the word amount), escalate (a human restores the email — it is right there in the source text).',
    'When the human-fix modal opens, copy the email address from the sample input: s.ito@brightleaf.example.',
  ],
  solution: [
    mkInput(),
    mkAi('step-extract', 'Extract record', 'extract-invoice', 'lens-4'),
    mkValidator('step-validate', 'Validate record', 'invoice-record', {
      retryPrevious: 1,
      repair: true,
      escalate: true,
      finalAction: 'safe-stop',
    }),
    mkOutput(),
  ],
  solutionScenarioSets: [[], ['fence-glitch'], ['word-numbers'], ['amnesia'], ['fence-glitch', 'word-numbers', 'amnesia']],
};
