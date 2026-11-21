/**
 * One row per AI use-case pattern, grouping the `ai:*` signals (src/domain/signals.ts) that belong
 * to it so co-occurring signals such as `ai:assistant` + `ai:rag` merge into a single use case
 * instead of two, and supplying every narrative field a use case needs (spec 4, "AI Solution
 * Approach"). Kept as a data table so a new pattern is one row, not a new branch in the planner.
 */
import type { Complexity } from '../domain';

export type AiModality = 'text' | 'vision' | 'speech';

export interface UseCaseNarrativeInput {
  /** Use case name, e.g. "Policy Question Assistant". */
  name: string;
  region: string;
  customerName: string;
}

export interface AiPatternDef {
  /** ai:* signal ids this pattern groups; a use case is created once any is present in the scope. */
  signals: readonly string[];
  patternLabel: string;
  complexity: Complexity;
  modality: AiModality;
  /** Needs a document/knowledge retrieval step before generation. */
  needsRetrieval: boolean;
  /** Needs a stateful, looping agent workflow (retrieve/draft/check, investigate, draft/guardrail/revise) rather than one linear pass - the case for LangGraph over custom orchestration. */
  multiStep: boolean;
  retrieval(input: UseCaseNarrativeInput): string;
  orchestration(input: UseCaseNarrativeInput): string;
  evaluation(input: UseCaseNarrativeInput): string;
  safety(input: UseCaseNarrativeInput): string;
  privacy(input: UseCaseNarrativeInput): string;
  humanReview(input: UseCaseNarrativeInput): string;
  /** Mandatory human decision this use case's output feeds, for the AI/deterministic/human boundary table. */
  humanDecisionActivity: string;
}

export const AI_PATTERN_DEFS: readonly AiPatternDef[] = [
  {
    signals: ['ai:assistant', 'ai:rag'],
    patternLabel: 'Retrieval-augmented generation (RAG) assistant',
    complexity: 'High',
    modality: 'text',
    needsRetrieval: true,
    multiStep: true,
    retrieval: ({ customerName }) =>
      `Answers are grounded in ${customerName}'s own indexed content: the assistant retrieves the top-matching passages before generating a response and cites the source passage instead of answering from the model's general training data.`,
    orchestration: ({ name }) =>
      `A stateful workflow retrieves context, drafts an answer, checks the draft against the retrieved passages for groundedness, and only then returns it to the "${name}" user, so an ungrounded draft never reaches them.`,
    evaluation: () =>
      'A golden set of representative questions with expected answers runs on every prompt or model change; groundedness (does the answer match the retrieved passage) and answer relevance are scored automatically, and the regression suite blocks release on a drop.',
    safety: () =>
      "Prompt-injection defences separate retrieved content from the system prompt, content filters run on every response, and abnormal request volume or repeated jailbreak attempts are flagged for abuse review.",
    privacy: ({ region }) =>
      `Only the minimum personal data needed to answer is included in the prompt context, requests are processed within ${region}, and the provider's terms exclude request content from model training.`,
    humanReview: () =>
      'The assistant answers informational questions only; any answer touching a binding decision is withheld and routed to a human, and every answer links back to its source document for verification.',
    humanDecisionActivity: 'a binding decision that an assistant conversation surfaces',
  },
  {
    signals: ['ai:extraction'],
    patternLabel: 'Document extraction pipeline with human validation',
    complexity: 'Medium',
    modality: 'text',
    needsRetrieval: false,
    multiStep: false,
    retrieval: () => '',
    orchestration: () =>
      'Each document is parsed and key fields are extracted with a confidence score per field; any field below the confidence threshold is routed to a reviewer queue instead of written straight through.',
    evaluation: () =>
      'Extraction accuracy is measured field-by-field against a labelled golden set of representative documents, and the regression suite re-runs on every model or prompt change before release.',
    safety: () =>
      "Uploaded documents are scanned before processing, and the extraction prompt is isolated from any instruction-like text the document itself contains (prompt-injection defence).",
    privacy: ({ region }) =>
      `Extracted personal data is limited to the fields the downstream process needs, processed within ${region}; source documents are not used to train the model.`,
    humanReview: () =>
      'Every extraction below the confidence threshold, plus a sample of high-confidence extractions, is confirmed by a human before the record is written to the system of record.',
    humanDecisionActivity: 'confirmation of a low-confidence extracted field',
  },
  {
    signals: ['ai:classification'],
    patternLabel: 'Classifier / router',
    complexity: 'Medium',
    modality: 'text',
    needsRetrieval: false,
    multiStep: false,
    retrieval: () => '',
    orchestration: () =>
      'The model returns a single label with a confidence score; a deterministic rule routes the record from that label, keeping the routing logic itself testable and auditable independent of the model.',
    evaluation: () => 'Precision and recall per class are measured against a labelled validation set, and class-level drift is tracked release over release.',
    safety: () => 'Inputs are sanitised before classification, and an out-of-distribution input (confidence below threshold) falls back to manual triage instead of a low-confidence auto-route.',
    privacy: ({ region }) => `Only the fields needed to classify the record are sent to the model, processed within ${region}.`,
    humanReview: () => 'Low-confidence classifications are queued for manual triage rather than auto-routed.',
    humanDecisionActivity: 'manual triage of a low-confidence classification',
  },
  {
    signals: ['ai:recommendation'],
    patternLabel: 'Recommendation engine',
    complexity: 'Medium',
    modality: 'text',
    needsRetrieval: false,
    multiStep: false,
    retrieval: () => '',
    orchestration: () =>
      "Ranked suggestions are generated from the user's own activity and profile data and shown with the reason each item was suggested, never as an unexplained auto-applied change.",
    evaluation: () => 'Offline ranking quality (precision@k against historical interactions) is measured before rollout, and acceptance rate is tracked once live.',
    safety: () => 'Recommendations are filtered against a deny-list of ineligible items before they are shown.',
    privacy: ({ region }) => `Recommendations are computed from the user's own activity, processed within ${region}, and are never shared across customer accounts.`,
    humanReview: () => 'Recommendations are advisory; the user, or an internal reviewer for staff-facing suggestions, decides whether to act on one.',
    humanDecisionActivity: 'acceptance of a suggested recommendation',
  },
  {
    signals: ['ai:forecasting'],
    patternLabel: 'Forecasting model',
    complexity: 'High',
    modality: 'text',
    needsRetrieval: false,
    multiStep: false,
    retrieval: () => '',
    orchestration: () => 'The model produces a point forecast with a confidence interval on a defined cadence; downstream planning consumes the interval, not only the point estimate.',
    evaluation: () =>
      'Forecast accuracy is back-tested against historical actuals before rollout and monitored against actuals as new data arrives; a material accuracy drop triggers retraining rather than silent continued use.',
    safety: () => 'Inputs are validated for range and completeness before scoring; a forecast built on incomplete input data is flagged rather than returned as reliable.',
    privacy: ({ region }) => `Forecasts are computed from aggregated, not individually identifying, data where the source allows it, processed within ${region}.`,
    humanReview: () => 'The forecast informs planning; a human still approves any resourcing or commercial commitment made on top of it.',
    humanDecisionActivity: 'a commitment made on top of a forecast',
  },
  {
    signals: ['ai:summarization'],
    patternLabel: 'Summarisation pipeline',
    complexity: 'Low',
    modality: 'text',
    needsRetrieval: false,
    multiStep: false,
    retrieval: () => '',
    orchestration: () => "Source content is chunked to the model's context window, summarised, and the summary is linked back to the source so a reader can verify it.",
    evaluation: () => 'Summary quality is spot-checked against a reference summary set for factual consistency: no claim in the summary that is absent from the source.',
    safety: () => 'The summariser is instructed to omit rather than invent when the source is ambiguous, and output is scanned for content the source does not contain.',
    privacy: ({ region }) => `Summaries are generated within ${region} and are not retained by the model provider beyond the request.`,
    humanReview: () => 'Summaries used in a customer-facing or compliance context are reviewed before distribution.',
    humanDecisionActivity: 'distribution of a customer-facing summary',
  },
  {
    signals: ['ai:anomaly'],
    patternLabel: 'Anomaly / fraud detection model',
    complexity: 'High',
    modality: 'text',
    needsRetrieval: false,
    multiStep: true,
    retrieval: () => '',
    orchestration: () => 'Each event scored above the anomaly threshold opens a case for investigation rather than triggering an automatic block, so a false positive does not immediately deny a legitimate user.',
    evaluation: () => 'False-positive and false-negative rates are tracked against a labelled historical set, and the threshold is tuned to the cost of each error type rather than a single fixed cutoff.',
    safety: () => 'Model inputs are validated and rate-limited so the scoring threshold cannot be probed by trial and error.',
    privacy: ({ region }) => `Only the fields needed to score risk are used, processed within ${region}, with case data restricted to the investigation team.`,
    humanReview: () => "A flagged case is decided by a human investigator; the model's role is to prioritise, not to block or deny automatically.",
    humanDecisionActivity: 'the decision on a flagged case',
  },
  {
    signals: ['ai:generation'],
    patternLabel: 'Content generation pipeline with human review',
    complexity: 'Medium',
    modality: 'text',
    needsRetrieval: false,
    multiStep: true,
    retrieval: () => '',
    orchestration: () => 'Content is drafted against a template and brand/tone guardrails, then held in a draft state until a reviewer approves it; nothing generated publishes automatically.',
    evaluation: () => 'Generated drafts are sampled against a style/accuracy rubric before the pipeline is trusted to reduce the review sample rate.',
    safety: () => 'Prompts constrain the model to the approved topic and tone, and output is scanned for disallowed claims before it reaches the reviewer queue.',
    privacy: ({ region }) => `Generation prompts exclude personal data unless the specific content genuinely requires it, processed within ${region}.`,
    humanReview: () => 'Every generated item is approved by a human before publication; none is auto-published.',
    humanDecisionActivity: 'approval of generated content before publication',
  },
  {
    signals: ['ai:vision'],
    patternLabel: 'Computer vision pipeline',
    complexity: 'Medium',
    modality: 'vision',
    needsRetrieval: false,
    multiStep: false,
    retrieval: () => '',
    orchestration: () => 'Images or video are scored against the target classes with a confidence score; results below threshold are queued for manual labelling rather than accepted automatically.',
    evaluation: () => 'Precision and recall are measured on a labelled image set representative of the real capture conditions before rollout.',
    safety: () => 'Inputs are validated for format and size before processing to prevent malformed-file attacks.',
    privacy: ({ region }) => `Images containing identifiable people are processed within ${region}, and access to raw images is restricted to the processing pipeline.`,
    humanReview: () => 'Low-confidence results are confirmed by a human before the outcome is acted on.',
    humanDecisionActivity: 'confirmation of a low-confidence vision result',
  },
  {
    signals: ['ai:speech'],
    patternLabel: 'Speech / voice processing pipeline',
    complexity: 'Medium',
    modality: 'speech',
    needsRetrieval: false,
    multiStep: false,
    retrieval: () => '',
    orchestration: () => 'Audio is transcribed, then handed to the downstream capability (e.g. intent classification); the transcript is retained alongside the outcome so a disputed interaction can be replayed.',
    evaluation: () => 'Transcription accuracy (word error rate) is sampled against a labelled audio set representative of the real call conditions.',
    safety: () => 'Callers are informed the interaction may be processed by an automated system, consistent with applicable recording-consent rules.',
    privacy: ({ region }) => `Recordings and transcripts are processed within ${region} and retained only for the period the customer confirms.`,
    humanReview: () => 'A caller can request a human at any point in the interaction; the system never forces a fully automated path.',
    humanDecisionActivity: "escalation of a caller's request to a human agent",
  },
];
