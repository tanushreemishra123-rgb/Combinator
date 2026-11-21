import { z } from 'zod';
import type { Puzzle } from './types';
import { mkAi, mkCondition, mkInput, mkOutput, mkRetrieval, mkSafeStop, mkValidator, ok } from './blocks';
import { uid } from '../engine/util';

const LIBRARY = [
  {
    id: 'doc-aurora-01',
    title: 'Aurora Observatory — Fact Sheet',
    snippet: 'The Aurora Deep-Sea Observatory began operations in 2019 on the Cascadia margin, 1,480 m below the surface.',
  },
  {
    id: 'doc-aurora-02',
    title: 'Research Programme Overview',
    snippet: 'Aurora studies methane seep ecosystems and long-term seismic strain along the subduction zone.',
  },
  {
    id: 'doc-aurora-03',
    title: 'Annual Report 2024',
    snippet: 'Since 2019 the observatory has streamed continuous sensor data to shore via a 92 km fibre-optic cable.',
  },
];

const GROUNDED_ANSWER = {
  answer:
    'The Aurora Deep-Sea Observatory began operations in 2019. It studies methane seep ecosystems and long-term seismic strain along the Cascadia subduction zone, streaming continuous sensor data to shore.',
  citations: ['doc-aurora-01', 'doc-aurora-02', 'doc-aurora-03'],
};

const HALLUCINATED_ANSWER = {
  answer:
    'The Aurora Deep-Sea Observatory opened in 1987 and primarily studies coral bleaching near the Great Barrier Reef, operated by a team of twelve divers.',
  citations: [],
};

const schema = z.object({
  answer: z.string().min(20),
  citations: z.array(z.string()).min(1, 'at least one citation is required — answers must cite evidence'),
});

export const knowledgeAssistant: Puzzle = {
  id: 'knowledge-assistant',
  order: 2,
  title: 'Ground the Knowledge Assistant',
  emoji: '📚',
  difficulty: 'beginner',
  tagline: 'No evidence? No answer. Teach the assistant to refuse instead of invent.',
  objective:
    'Answer questions using retrieved library documents — and refuse politely when the library comes back empty. Right now the assistant happily invents an answer when it has no evidence. Add a branch that checks for evidence, and a validator that enforces citations.',
  learning: [
    'Retrieval-grounding: answers must cite the documents they came from',
    'An empty retrieval result is a soft failure — the workflow must decide what it means',
    'A deliberate safe stop beats a confident hallucination',
  ],
  expected: {
    description: 'A JSON object with `answer` and at least one `citations[]` entry referencing retrieved documents.',
    schemaId: 'grounded-answer',
  },
  samples: [
    {
      id: 'aurora-question',
      label: 'Question about the Aurora Observatory',
      value: { question: 'What year did the Aurora Deep-Sea Observatory begin operations, and what does it study?' },
      preview: 'What year did the Aurora Deep-Sea Observatory begin operations, and what does it study?',
    },
  ],
  providers: [{ id: 'sage-2', name: 'Sage-2', blurb: 'A mock reasoning model that is confident even when it should not be.', tier: 'primary' }],
  tasks: [
    {
      id: 'answer-with-citations',
      name: 'Answer using retrieved evidence',
      description: 'Produce JSON: answer + citations[] of supporting doc ids.',
      expectsJson: true,
      mock: ({ attempt, scenarios, ctx }) => {
        const last = ctx.last as { docs?: unknown[] } | undefined;
        const docs = Array.isArray(last?.docs) ? last.docs : [];
        if (docs.length === 0) {
          return ok(HALLUCINATED_ANSWER, 'No evidence available — the model invented an answer anyway.');
        }
        if (scenarios.has('lazy-citer') && attempt === 1) {
          return ok({ ...GROUNDED_ANSWER, citations: [] }, 'The model used the documents but forgot to cite them.');
        }
        return ok(GROUNDED_ANSWER);
      },
      livePrompt: (ctx) =>
        `Answer the user's question using ONLY the retrieved documents below. Respond with ONLY JSON: {"answer": string, "citations": string[]} where citations are the doc ids you used.\n\n${JSON.stringify(ctx.last, null, 2)}`,
    },
  ],
  tools: [],
  sources: [
    {
      id: 'field-library',
      name: 'Ocean research library',
      description: 'A small committed document collection about the (fictional) Aurora Deep-Sea Observatory.',
      search: (_query, topK, scenarios) => (scenarios.has('empty-library') ? [] : LIBRARY.slice(0, topK)),
    },
  ],
  schemas: [
    {
      id: 'grounded-answer',
      name: 'Grounded answer schema',
      rules: ['answer: string, at least 20 characters', 'citations: at least 1 supporting document id'],
      schema,
    },
  ],
  conditions: [
    {
      id: 'evidence-found',
      name: 'Evidence found?',
      description: 'Passes when the retrieval step returned at least one document.',
      test: (ctx) => {
        const last = ctx.last as { docs?: unknown[] } | undefined;
        const count = Array.isArray(last?.docs) ? last.docs.length : 0;
        return count > 0
          ? { pass: true, reason: `${count} supporting document${count > 1 ? 's' : ''} retrieved` }
          : { pass: false, reason: 'the library returned 0 documents' };
      },
    },
  ],
  transforms: [],
  defaults: [],
  palette: [
    {
      id: 'add-condition',
      type: 'step',
      name: 'Condition: evidence?',
      emoji: '🔀',
      blurb: 'Branches on whether retrieval found documents. Put a Safe Stop in the "no" branch.',
      maxInstances: 1,
      make: () => mkCondition(uid(), 'Evidence found?', 'evidence-found'),
    },
    {
      id: 'add-safestop',
      type: 'step',
      name: 'Safe Stop (refuse)',
      emoji: '🛑',
      blurb: 'Ends the run safely with an honest refusal instead of letting the model guess.',
      maxInstances: 2,
      make: () =>
        mkSafeStop(uid(), 'Refuse politely', "I can't answer that: no supporting evidence was found in the library."),
    },
    {
      id: 'add-validator',
      type: 'step',
      name: 'Validator',
      emoji: '🛡️',
      blurb: 'Enforces the grounded-answer schema — answers without citations do not pass.',
      maxInstances: 1,
      make: () =>
        mkValidator(uid(), 'Check citations', 'grounded-answer', { retryPrevious: 1, finalAction: 'safe-stop' }),
    },
  ],
  initialWorkflow: [
    mkInput(),
    mkRetrieval('step-retrieve', 'Search the library', 'field-library', 3),
    mkAi('step-answer', 'Compose answer', 'answer-with-citations', 'sage-2'),
    mkOutput(),
  ],
  failureScenarios: [
    {
      id: 'empty-library',
      name: 'Empty library',
      emoji: '🕳️',
      description: 'Retrieval returns zero documents. Without a guard, the model invents an answer from nothing.',
      attacks: 'the evidence supply — retrieval comes back empty',
      counteredBy: ['condition', 'validator'],
    },
    {
      id: 'lazy-citer',
      name: 'Lazy citer',
      emoji: '🥱',
      description: 'The model answers correctly but forgets its citations on the first attempt.',
      attacks: 'the citation requirement of the answer',
      counteredBy: ['validator'],
    },
  ],
  criteria: [
    {
      id: 'grounded-run',
      label: 'Answer with citations',
      detail: 'Finish a run where the final answer cites retrieved documents.',
      test: (r) => r.status === 'completed' && r.finalOutputValid === true,
    },
    {
      id: 'refuse-gracefully',
      label: 'Refuse without evidence',
      detail: 'With "Empty library" on, the workflow must stop safely — no hallucinated answer may ship.',
      test: (r) => r.scenarios.includes('empty-library') && r.status === 'safe-stopped',
    },
    {
      id: 'citations-enforced',
      label: 'Survive the lazy citer',
      detail: 'With "Lazy citer" on, still ship an answer that carries citations.',
      test: (r) => r.scenarios.includes('lazy-citer') && r.status === 'completed' && r.finalOutputValid === true,
    },
  ],
  hints: [
    'Enable "Empty library" and run: the assistant confidently describes the wrong observatory. Check the trace — retrieval returned 0 docs and nobody noticed.',
    'Add the Condition block right after retrieval. Drag a Safe Stop into its "no evidence" branch so the workflow refuses instead of guessing.',
    'The "Lazy citer" needs the Validator after the AI step: one retry makes the model include its citations.',
  ],
  solution: [
    mkInput(),
    mkRetrieval('step-retrieve', 'Search the library', 'field-library', 3),
    mkCondition('step-gate', 'Evidence found?', 'evidence-found', {
      else: [mkSafeStop('step-refuse', 'Refuse politely', "I can't answer that: no supporting evidence was found in the library.")],
    }),
    mkAi('step-answer', 'Compose answer', 'answer-with-citations', 'sage-2'),
    mkValidator('step-validate', 'Check citations', 'grounded-answer', { retryPrevious: 1, finalAction: 'safe-stop' }),
    mkOutput(),
  ],
  solutionScenarioSets: [[], ['empty-library'], ['lazy-citer']],
};
