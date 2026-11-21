import { z } from 'zod';
import type { Puzzle } from './types';
import { failWith, mkAi, mkHuman, mkInput, mkOutput, mkTool, ok } from './blocks';
import { uid } from '../engine/util';

const INCIDENT = {
  customer: 'Riverbend Logistics',
  contact: 'ops@riverbend.example',
  incident: 'A sync outage delayed shipment status updates for roughly 6 hours on Monday.',
  tone: 'apologetic but factual — no over-promising',
};

const SAFE_DRAFT = {
  subject: 'About Monday’s shipment status delay',
  body:
    'Hi Riverbend team,\n\nOn Monday a sync outage delayed shipment status updates for about 6 hours. Your shipments themselves were not affected, and all statuses have since caught up.\n\nWe are adding monitoring to catch this class of issue earlier. We are sorry for the disruption to your dispatch planning.\n\n— Customer Success',
};

const RISKY_DRAFT = {
  subject: 'It will NEVER happen again',
  body:
    'Hi Riverbend team,\n\nMonday’s delay was unacceptable and we GUARANTEE this will never happen again. As an apology we will refund your entire year of fees and give you priority routing forever.\n\n— Customer Success',
};

const draftSchema = z.object({
  subject: z.string().min(4),
  body: z.string().min(40),
});

const receiptSchema = z.object({
  sent: z.literal(true),
  to: z.string().includes('@'),
  subject: z.string().min(4),
  messageId: z.string().min(6),
  note: z.string(),
});

export const approvalGate: Puzzle = {
  id: 'approval-gate',
  order: 5,
  title: 'Approve Before Sending',
  emoji: '✉️',
  difficulty: 'intermediate',
  tagline: 'The AI drafts. A human decides. Nothing leaves without a signature.',
  objective:
    'Draft an incident email to a customer — but never let it leave the building without human sign-off. Right now the workflow sends whatever the model writes. Add an approval gate so a person can approve, edit, or reject the draft, and give the flaky send API a retry.',
  learning: [
    'External actions (sending email) deserve a human approval gate',
    'A rejection is a valid, safe outcome — the workflow should stop cleanly',
    'Every human decision belongs in the execution trace',
  ],
  expected: {
    description: 'A simulated send receipt: `sent: true`, recipient, subject, and a message id — only after a recorded human decision.',
    schemaId: 'sent-receipt',
  },
  samples: [
    { id: 'sync-outage', label: 'Riverbend sync-outage incident', value: INCIDENT, preview: INCIDENT.incident },
  ],
  providers: [{ id: 'penn-1', name: 'Penn-1', blurb: 'A mock drafting model. Usually calm. Occasionally dramatic.', tier: 'primary' }],
  tasks: [
    {
      id: 'draft-apology',
      name: 'Draft the customer email',
      description: 'Produce JSON: subject + body, in an apologetic but factual tone.',
      expectsJson: true,
      mock: ({ scenarios }) => (scenarios.has('overpromiser') ? ok(RISKY_DRAFT, 'This draft over-promises — a human should catch it.') : ok(SAFE_DRAFT)),
      livePrompt: (ctx) =>
        `Draft a short customer email about this incident. Tone: apologetic but factual, no over-promising. Respond with ONLY JSON: {"subject": string, "body": string}.\n\n${JSON.stringify(ctx.input, null, 2)}`,
    },
  ],
  tools: [
    {
      id: 'send-email',
      name: 'Email API (simulated)',
      description: 'Pretends to send the email. No real message is ever sent.',
      mock: ({ attempt, scenarios, ctx }) => {
        if (scenarios.has('send-hiccup') && attempt === 1) {
          return failWith('tool-error', 'Email API returned 503 Service Unavailable (simulated) — safe to retry.', true);
        }
        const draft = ctx.last as { subject?: string };
        return ok({
          sent: true,
          to: INCIDENT.contact,
          subject: draft?.subject ?? '(no subject)',
          messageId: 'msg-2f8a41c0',
          note: 'Simulated send — no real email left this machine.',
        });
      },
    },
  ],
  sources: [],
  schemas: [
    {
      id: 'email-draft',
      name: 'Email draft schema',
      rules: ['subject: string', 'body: string, at least 40 characters'],
      schema: draftSchema,
    },
    {
      id: 'sent-receipt',
      name: 'Send receipt schema',
      rules: ['sent: true', 'to: an email address', 'subject + messageId present'],
      schema: receiptSchema,
    },
  ],
  conditions: [],
  transforms: [],
  defaults: [],
  palette: [
    {
      id: 'add-human',
      type: 'step',
      name: 'Approval Gate',
      emoji: '🙋',
      blurb: 'Pauses the run: a person approves, edits, or rejects the draft before anything is sent.',
      maxInstances: 1,
      make: () =>
        mkHuman(uid(), 'Approve the draft', {
          title: 'Outbound email approval',
          instructions: 'Read the draft carefully. Approve it, edit it into shape, or reject it — nothing is sent until you decide.',
          allowEdit: true,
          schemaId: 'email-draft',
        }),
    },
    {
      id: 'upgrade-retry',
      type: 'upgrade-retry',
      name: 'Retry ×2',
      emoji: '🔁',
      blurb: 'Drop onto the send step: absorbs a transient 503 from the email API.',
    },
  ],
  initialWorkflow: [
    mkInput(),
    mkAi('step-draft', 'Draft email', 'draft-apology', 'penn-1'),
    mkTool('step-send', 'Send email', 'send-email'),
    mkOutput(),
  ],
  failureScenarios: [
    {
      id: 'overpromiser',
      name: 'The over-promiser',
      emoji: '🎭',
      description: 'The model drafts a guarantee no company should make, plus a full-year refund. Schema-valid — only a human will catch it.',
      attacks: 'the content of the outbound email',
      counteredBy: ['human'],
    },
    {
      id: 'send-hiccup',
      name: 'Send hiccup',
      emoji: '📮',
      description: 'The email API returns a 503 on the first attempt, then recovers.',
      attacks: 'the send step with a transient error',
      counteredBy: ['retry'],
    },
  ],
  criteria: [
    {
      id: 'gated-send',
      label: 'Send only after sign-off',
      detail: 'Finish a run where a recorded human approval precedes the (simulated) send.',
      test: (r) =>
        r.status === 'completed' &&
        r.finalOutputValid === true &&
        r.humanDecisions.some((d) => d.mode === 'approval' && (d.decision.action === 'approve' || d.decision.action === 'edit')),
    },
    {
      id: 'edited-send',
      label: 'Defuse the over-promiser',
      detail: 'With "The over-promiser" on, edit the draft before sending — the risky version must not go out as-is.',
      test: (r) =>
        r.scenarios.includes('overpromiser') &&
        r.status === 'completed' &&
        r.finalOutputValid === true &&
        r.humanDecisions.some((d) => d.decision.action === 'edit'),
    },
    {
      id: 'rejection-respected',
      label: 'Respect a rejection',
      detail: 'Reject a draft: the run must stop safely and the send step must never fire.',
      test: (r) => r.status === 'safe-stopped' && r.humanDecisions.some((d) => d.decision.action === 'reject'),
    },
    {
      id: 'hiccup-survived',
      label: 'Survive the send hiccup',
      detail: 'With "Send hiccup" on, a retry rides out the 503 and the receipt still validates.',
      test: (r) => r.scenarios.includes('send-hiccup') && r.status === 'completed' && r.finalOutputValid === true && r.retriesUsed >= 1,
    },
  ],
  hints: [
    'Run with "The over-promiser" enabled: the workflow happily sends a guarantee and a year of refunds. No schema can catch a bad promise — only a person can.',
    'Add the Approval Gate between the draft and the send. Try all three buttons: approve, edit, reject — each is recorded in the trace.',
    'Turn on "Send hiccup" and drop Retry ×2 onto the send step. Watch the trace: 503, retry, delivered.',
  ],
  solution: [
    mkInput(),
    mkAi('step-draft', 'Draft email', 'draft-apology', 'penn-1'),
    mkHuman('step-approve', 'Approve the draft', {
      title: 'Outbound email approval',
      instructions: 'Read the draft carefully. Approve it, edit it into shape, or reject it — nothing is sent until you decide.',
      allowEdit: true,
      schemaId: 'email-draft',
    }),
    mkTool('step-send', 'Send email', 'send-email', { upgrades: { retry: { attempts: 2 } } }),
    mkOutput(),
  ],
  solutionScenarioSets: [[], ['overpromiser'], ['send-hiccup'], ['overpromiser', 'send-hiccup']],
};
