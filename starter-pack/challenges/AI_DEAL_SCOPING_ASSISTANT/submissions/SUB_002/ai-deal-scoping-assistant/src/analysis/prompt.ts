/**
 * Task definition for 'analyze-requirements'. The prompt shows the customer text as numbered lines
 * under their section titles so the model can quote verbatim and the grounding validator can
 * verify every quote afterwards.
 */
import { buildSystemPrompt, describeCustomerForPrompt, jsonContract } from '../ai/promptKit';
import type { AnalyzeContext, PromptParts, TaskDefinition } from '../ai/types';
import { AnalysisOutputSchema, EstimationInputKeySchema, prefixForKind, ScopeItemKindSchema } from '../domain';
import type { AnalysisOutput, NormalizedDocument, ScopeItemKind } from '../domain';

/** Keeps the prompt inside free-tier context windows; the cut is stated in the prompt itself. */
export const MAX_PROMPT_LINES = 1500;

const ANALYST_ROLE =
  'You are a senior pre-sales business analyst. You turn customer requirements into a structured, reviewable scope model with requirement-level source traceability.';

const KIND_GUIDANCE: ReadonlyMap<ScopeItemKind, string> = new Map<ScopeItemKind, string>([
  ['business', 'Business objectives and measurable outcomes'],
  ['persona', 'Target users and personas'],
  ['functional', 'Functional requirements (what users or the system must do)'],
  ['nonFunctional', 'Non-functional requirements (availability, performance, scalability, accessibility, usability)'],
  ['existingSystem', 'Existing systems in the customer landscape'],
  ['integration', 'Integrations with named or described systems'],
  ['data', 'Data requirements (migration, reporting, retention, volumes)'],
  ['security', 'Security and compliance expectations'],
  ['technology', 'Technology and platform preferences'],
  ['constraint', 'Delivery constraints (deadline, budget, phasing, exclusions)'],
  ['dependency', 'Dependencies on the customer or third parties'],
  ['risk', 'Delivery or solution risks'],
  ['gap', 'Missing information that blocks design or estimation'],
  ['assumption', 'Working assumptions that need customer validation'],
  ['question', 'Clarification questions for the customer'],
]);

const PROVENANCE_RULES: readonly string[] = [
  "- 'customer-stated': the customer text says it. 'source.quote' MUST be copied verbatim from the numbered lines (same words, no paraphrase) and 'source.lineStart'/'source.lineEnd' must be the L-numbers it came from.",
  "- 'ai-inferred': your reasoned interpretation of the text. Quote the line that triggered it and list the related item IDs in 'relatedIds'.",
  "- 'assumed': a working assumption you introduce because the text is silent or vague. State the assumption explicitly in the description.",
  '- Quotes are verified automatically against the source; an unverifiable customer-stated item is downgraded and flagged.',
];

const ANALYSIS_RULES: readonly string[] = [
  '- Extract every distinct requirement once; do not merge unrelated requirements and do not repeat the same one.',
  '- Never invent user numbers, dates, volumes, budgets, systems or regulations. When critical information is missing or ambiguous, add a gap item and a linked question item instead.',
  `- For gap and question items set 'affectsInputs' to the estimation inputs left undefined (${EstimationInputKeySchema.options.join(', ')}) and 'critical' to true when it blocks estimation.`,
  "- Vague wording such as 'fast', 'user friendly' or 'scalable' without numbers becomes an 'assumed' assumption item stating the working interpretation.",
  "- Priority follows the customer wording: must/shall/critical/mandatory = High, should/important = Medium, could/nice to have/optional/future = Low.",
  "- Use 'relatedIds' to associate each requirement with its dependencies, assumptions, gaps and open questions (and the reverse).",
  "- 'summary' is two or three sentences naming the customer, what was found and the main open points.",
  '- Titles are at most ten words. Descriptions are one or two specific sentences in professional consulting language.',
];

function idConventionTable(): string {
  return ScopeItemKindSchema.options
    .map((kind) => `- ${kind} -> ${prefixForKind(kind)}_01, ${prefixForKind(kind)}_02 ... : ${KIND_GUIDANCE.get(kind) ?? kind}`)
    .join('\n');
}

/** Numbered lines grouped under their section title: "## [S2] Functional needs" then "L5: ...". */
export function renderNumberedSource(document: NormalizedDocument): string {
  const titles = new Map(document.sections.map((section) => [section.id, section.title]));
  const rendered: string[] = [];
  let currentSection: string | null = null;
  for (const line of document.lines.slice(0, MAX_PROMPT_LINES)) {
    if (line.sectionId !== currentSection) {
      currentSection = line.sectionId;
      rendered.push(`## [${line.sectionId}] ${titles.get(line.sectionId) ?? 'Untitled section'}`);
    }
    if (line.text.trim() !== '') {
      rendered.push(`L${line.number}: ${line.text}`);
    }
  }
  if (document.lines.length > MAX_PROMPT_LINES) {
    rendered.push(`(Source truncated after line ${MAX_PROMPT_LINES} of ${document.lines.length}; analyse only the lines shown.)`);
  }
  return rendered.join('\n');
}

function buildAnalysisPrompt(context: AnalyzeContext): PromptParts {
  const prompt = [
    'TASK: Analyse the customer requirements below and return the structured scope model.',
    '',
    'CUSTOMER CONTEXT (secondary source, provided by the user):',
    describeCustomerForPrompt(context.customer),
    '',
    'ITEM KINDS AND ID CONVENTION (IDs are sequential per kind and unique):',
    idConventionTable(),
    '',
    'PROVENANCE RULES:',
    ...PROVENANCE_RULES,
    '',
    'ANALYSIS RULES:',
    ...ANALYSIS_RULES,
    '',
    'OUTPUT CONTRACT (return JSON only, matching this schema):',
    jsonContract(AnalysisOutputSchema),
    '',
    'CUSTOMER REQUIREMENTS (primary source; numbered lines under section titles):',
    renderNumberedSource(context.document),
  ].join('\n');
  return { system: buildSystemPrompt(ANALYST_ROLE), prompt };
}

export const analyzeRequirementsTask: TaskDefinition<AnalyzeContext, AnalysisOutput> = {
  id: 'analyze-requirements',
  label: 'Customer requirements analysis',
  schema: AnalysisOutputSchema,
  buildPrompt: buildAnalysisPrompt,
};
