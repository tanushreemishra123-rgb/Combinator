import { z } from 'zod';
import type { Puzzle } from './types';
import { failWith, mkAi, mkCondition, mkHuman, mkInput, mkOutput, mkTool, mkValidator, ok } from './blocks';
import { uid } from '../engine/util';

const TICKET = {
  ticketId: 'TCK-4821',
  from: 'dana@riverbend.example',
  subject: 'Charged twice for the same order',
  body: 'Hi — order #88231 shows two identical charges of $84.50 on my card. Can you refund one? I also could not open the invoice PDF.',
};

const QUEUES = ['billing', 'technical', 'account', 'shipping'] as const;

const classificationSchema = z.object({
  category: z.enum(QUEUES),
  confidence: z.number().min(0, 'confidence must be between 0 and 1').max(1, 'confidence must be between 0 and 1'),
  summary: z.string().min(10),
});

const receiptSchema = z.object({
  routedTo: z.string().regex(/^(billing|technical|account|shipping)-queue$/),
  ticketId: z.string(),
  classification: classificationSchema,
});

function classify(scenarios: ReadonlySet<string>) {
  const base = {
    category: 'billing' as string,
    confidence: 0.92,
    summary: 'Customer reports a duplicate charge on order #88231 and requests a refund of one charge.',
  };
  if (scenarios.has('category-drift')) base.category = 'billing-ish';
  if (scenarios.has('confidence-overflow')) base.confidence = 7.5;
  if (scenarios.has('wobbly-classifier')) base.confidence = 0.35;
  return base;
}

export const ticketRouter: Puzzle = {
  id: 'ticket-router',
  order: 3,
  title: 'Repair the Ticket Router',
  emoji: '🎫',
  difficulty: 'intermediate',
  tagline: 'Bad categories crash the router. Low confidence needs a human. Fix both.',
  objective:
    'Classify a customer ticket and route it to the right queue. The classifier sometimes invents categories, sometimes reports confidence on the wrong scale, and sometimes is genuinely unsure. Validate before routing, and send low-confidence calls to a human.',
  learning: [
    'Validate model output before it reaches a tool that will choke on it',
    'Deterministic repair: alias maps and scale normalization fix predictable model quirks',
    'Confidence thresholds + a human branch = routing you can trust',
  ],
  expected: {
    description: 'A routing receipt: `routedTo` queue, `ticketId`, and the validated classification that justified it.',
    schemaId: 'routing-receipt',
  },
  samples: [
    {
      id: 'duplicate-charge',
      label: 'Duplicate-charge ticket',
      value: TICKET,
      preview: `${TICKET.subject} — ${TICKET.body}`,
    },
  ],
  providers: [{ id: 'triage-9', name: 'Triage-9', blurb: 'A mock classifier with a few well-known bad habits.', tier: 'primary' }],
  tasks: [
    {
      id: 'classify-ticket',
      name: 'Classify the ticket',
      description: 'Produce JSON: category (billing|technical|account|shipping), confidence (0–1), summary.',
      expectsJson: true,
      mock: ({ scenarios }) => ok(classify(scenarios)),
      livePrompt: (ctx) =>
        `Classify this support ticket. Respond with ONLY JSON: {"category": "billing"|"technical"|"account"|"shipping", "confidence": number between 0 and 1, "summary": string}.\n\nTicket:\n${JSON.stringify(ctx.input, null, 2)}`,
    },
  ],
  tools: [
    {
      id: 'route-queue',
      name: 'Queue router',
      description: 'Simulated ticketing API: files the ticket into the queue named by the classification.',
      mock: ({ ctx }) => {
        const cls = ctx.last as { category?: string } | undefined;
        const category = cls?.category ?? '';
        if (!(QUEUES as readonly string[]).includes(category)) {
          return failWith('tool-error', `Queue router crashed: no queue named "${category}". Valid queues: ${QUEUES.join(', ')}.`, false);
        }
        const input = ctx.input as typeof TICKET;
        return ok({ routedTo: `${category}-queue`, ticketId: input.ticketId, classification: ctx.last });
      },
    },
  ],
  sources: [],
  schemas: [
    {
      id: 'ticket-classification',
      name: 'Ticket classification schema',
      rules: ['category: one of billing, technical, account, shipping', 'confidence: number between 0 and 1', 'summary: string'],
      schema: classificationSchema,
      repair: (value) => {
        if (typeof value !== 'object' || value === null) return null;
        const draft = structuredClone(value) as any;
        const notes: string[] = [];
        if (typeof draft.category === 'string' && !(QUEUES as readonly string[]).includes(draft.category)) {
          const aliasHit = QUEUES.find((q) => draft.category.toLowerCase().includes(q));
          if (aliasHit) {
            notes.push(`Mapped invented category "${draft.category}" to the closest real queue "${aliasHit}".`);
            draft.category = aliasHit;
          }
        }
        if (typeof draft.confidence === 'number' && draft.confidence > 1 && draft.confidence <= 100) {
          const fixed = draft.confidence > 10 ? draft.confidence / 100 : draft.confidence / 10;
          notes.push(`Normalized confidence ${draft.confidence} to ${fixed} — the model answered on the wrong scale.`);
          draft.confidence = fixed;
        }
        return notes.length > 0 ? { value: draft, notes } : null;
      },
    },
    {
      id: 'routing-receipt',
      name: 'Routing receipt schema',
      rules: ['routedTo: a real queue name', 'ticketId: string', 'classification: a valid ticket classification'],
      schema: receiptSchema,
    },
  ],
  conditions: [
    {
      id: 'confident-enough',
      name: 'Confidence ≥ 0.75?',
      description: 'Passes when the classifier is confident enough to route automatically.',
      test: (ctx) => {
        const cls = ctx.last as { confidence?: number } | undefined;
        const c = typeof cls?.confidence === 'number' ? cls.confidence : 0;
        return c >= 0.75
          ? { pass: true, reason: `confidence ${c} meets the 0.75 auto-routing bar` }
          : { pass: false, reason: `confidence ${c} is below the 0.75 auto-routing bar` };
      },
    },
  ],
  transforms: [],
  defaults: [],
  palette: [
    {
      id: 'add-validator',
      type: 'step',
      name: 'Validator',
      emoji: '🛡️',
      blurb: 'Checks the classification: real category, sane confidence. Can repair known quirks.',
      maxInstances: 1,
      make: () =>
        mkValidator(uid(), 'Validate classification', 'ticket-classification', {
          repair: true,
          escalate: true,
          finalAction: 'safe-stop',
        }),
    },
    {
      id: 'add-condition',
      type: 'step',
      name: 'Confidence gate',
      emoji: '🔀',
      blurb: 'Branches on confidence ≥ 0.75. Put a Human Review in the "not confident" branch.',
      maxInstances: 1,
      make: () => mkCondition(uid(), 'Confident enough?', 'confident-enough'),
    },
    {
      id: 'add-human',
      type: 'step',
      name: 'Human Review',
      emoji: '🙋',
      blurb: 'Pauses the run so a person can confirm or correct the classification.',
      maxInstances: 1,
      make: () =>
        mkHuman(uid(), 'Review classification', {
          title: 'Low-confidence routing review',
          instructions: 'The classifier is unsure. Confirm or correct the category before this ticket is routed.',
          allowEdit: true,
          schemaId: 'ticket-classification',
        }),
    },
  ],
  initialWorkflow: [
    mkInput(),
    mkAi('step-classify', 'Classify ticket', 'classify-ticket', 'triage-9'),
    mkTool('step-route', 'Route to queue', 'route-queue'),
    mkOutput(),
  ],
  failureScenarios: [
    {
      id: 'category-drift',
      name: 'Category drift',
      emoji: '🌀',
      description: 'The classifier invents "billing-ish" — not a real queue. The router tool crashes on it.',
      attacks: 'the category field the router depends on',
      counteredBy: ['validator'],
    },
    {
      id: 'confidence-overflow',
      name: 'Confidence overflow',
      emoji: '📈',
      description: 'Confidence comes back as 7.5 — the model answered on a 0–10 scale instead of 0–1.',
      attacks: 'the confidence value used for routing decisions',
      counteredBy: ['validator'],
    },
    {
      id: 'wobbly-classifier',
      name: 'Wobbly classifier',
      emoji: '🤷',
      description: 'A valid but low confidence of 0.35 — technically fine, but should a machine route this alone?',
      attacks: 'the trustworthiness of automatic routing',
      counteredBy: ['condition', 'human'],
    },
  ],
  criteria: [
    {
      id: 'clean-route',
      label: 'Route a clean ticket',
      detail: 'With no scenarios, the ticket lands in the billing queue with a valid receipt.',
      test: (r) => r.scenarios.length === 0 && r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'survive-drift',
      label: 'Survive "Category drift"',
      detail: 'The invented category must be caught (and repaired) before the router tool sees it.',
      test: (r) => r.scenarios.includes('category-drift') && r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'survive-overflow',
      label: 'Survive "Confidence overflow"',
      detail: 'The 7.5 confidence must be normalized — the final receipt must carry a 0–1 value.',
      test: (r) => r.scenarios.includes('confidence-overflow') && r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'human-in-the-loop',
      label: 'Route a wobbly ticket via a human',
      detail: 'With "Wobbly classifier" on, a recorded human decision must precede the routing.',
      test: (r) =>
        r.scenarios.includes('wobbly-classifier') &&
        r.status === 'completed' &&
        r.finalOutputValid === true &&
        r.humanDecisions.length > 0,
    },
  ],
  hints: [
    'Enable "Category drift" and run: the router tool crashes on "billing-ish". The classification needed checking before any tool touched it.',
    'Add the Validator right after the classify step — its Repair strategy knows how to map drifted categories and fix scale bugs.',
    'For the wobbly classifier, add the Confidence gate after the validator and drag a Human Review into its "below the bar" branch.',
  ],
  solution: [
    mkInput(),
    mkAi('step-classify', 'Classify ticket', 'classify-ticket', 'triage-9'),
    mkValidator('step-validate', 'Validate classification', 'ticket-classification', {
      repair: true,
      escalate: true,
      finalAction: 'safe-stop',
    }),
    mkCondition('step-gate', 'Confident enough?', 'confident-enough', {
      else: [
        mkHuman('step-review', 'Review classification', {
          title: 'Low-confidence routing review',
          instructions: 'The classifier is unsure. Confirm or correct the category before this ticket is routed.',
          allowEdit: true,
          schemaId: 'ticket-classification',
        }),
      ],
    }),
    mkTool('step-route', 'Route to queue', 'route-queue'),
    mkOutput(),
  ],
  solutionScenarioSets: [[], ['category-drift'], ['confidence-overflow'], ['category-drift', 'confidence-overflow'], ['wobbly-classifier']],
};
