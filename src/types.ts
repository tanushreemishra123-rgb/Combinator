/**
 * Canonical domain model for the Topcoder Combinator.
 *
 * Every workspace artifact (requirement-matrix.json, decisions.json,
 * provenance.json, verification.json, …) is a serialization of the types below.
 * Nothing here hard-codes a challenge, submission, requirement, path, score,
 * winner, or expected combination — all of that is discovered at runtime from
 * the starter pack (see src/ingest.ts). This file is the single source of truth
 * for shapes; Zod validators that mirror it live in src/schemas.ts.
 */

// ─── Shared enumerations ─────────────────────────────────────────────────────

export type ChallengeMode = "code" | "ideation";

/** Per-requirement / per-claim assessment states (challenge spec §Profiling). */
export type AssessmentState =
  | "complete"
  | "partial"
  | "missing"
  | "not_verifiable"
  | "manual_review_required";

/** Copilot decision states (challenge spec §Copilot Decision Workflow). */
export type DecisionState =
  | "pending"
  | "accepted"
  | "rejected"
  | "alternative_selected"
  | "blocked"
  | "manual_review"
  | "unresolved";

/** How the active review context was obtained (review-context-policy RC_06). */
export type ReviewContextMode =
  | "provided_with_spec_reconciliation"
  | "specification_derived";

export type ReviewContextStatus = "supplied" | "absent";

export type Confidence = "low" | "medium" | "high";

export type CompatibilityRisk = "low" | "medium" | "high" | "unknown";

// ─── Evidence & provenance primitives ────────────────────────────────────────

/**
 * A pointer to a concrete source location. Every material claim carries at least
 * one of these (spec: "Every material claim must reference a file, function,
 * test, README section, page, slide, table, figure, speaker note, or reviewer
 * comment").
 */
export interface SourceLocation {
  /** Logical artifact kind the evidence points at. */
  kind:
    | "file"
    | "function"
    | "test"
    | "readme_section"
    | "page"
    | "slide"
    | "table"
    | "figure"
    | "speaker_note"
    | "reviewer_comment"
    | "scorecard"
    | "verification"
    | "specification";
  /** Submission or idea this location belongs to (omitted for spec-level). */
  submissionId?: string;
  ideaId?: string;
  /** Path relative to the challenge package root, when file-like. */
  path?: string;
  /** 1-based line span when known. */
  startLine?: number;
  endLine?: number;
  /** Page / slide / section index when document-like. */
  locator?: string;
  /** Short verbatim-or-paraphrased excerpt supporting the claim. */
  excerpt?: string;
}

export interface Evidence {
  /** Stable id so provenance can reference an exact evidence record. */
  id: string;
  statement: string;
  locations: SourceLocation[];
  /** Where the evidence came from, for fusion + conflict detection. */
  origin: "source" | "review_ai" | "review_human" | "scorecard" | "verification" | "appeal" | "derived";
  confidence: Confidence;
}

// ─── Review context ──────────────────────────────────────────────────────────

export interface Constraint {
  id: string;
  text: string;
  /** true when this field was derived from spec rather than supplied. */
  specificationDerived?: boolean;
  sourceLocation?: SourceLocation;
}

export interface Requirement {
  id: string;
  title: string;
  priority: "high" | "medium" | "low" | "unspecified";
  constraints: Constraint[];
  specificationDerived?: boolean;
  sourceLocation?: SourceLocation;
}

export interface ActiveReviewContext {
  challengeId: string;
  mode: ReviewContextMode;
  /** Original platform record id when supplied; null when derived. */
  recordId: string | null;
  status: string | null;
  requirements: Requirement[];
}

export interface ReviewContextReconciliation {
  challengeId: string;
  mode: ReviewContextMode;
  /** IDs present in spec but missing from supplied context (and vice versa). */
  missingInContext: string[];
  missingInSpecification: string[];
  /** IDs whose text/priority differs between the two sources. */
  conflicts: Array<{
    id: string;
    field: string;
    contextValue: string;
    specificationValue: string;
  }>;
  stale: string[];
  notes: string[];
}

// ─── Profiling ───────────────────────────────────────────────────────────────

export interface RequirementCoverage {
  requirementId: string;
  state: AssessmentState;
  /** Grounded coverage strength (0..n) used to compare sources per requirement. */
  score: number;
  evidence: Evidence[];
  notes?: string;
}

export interface CodeSubmissionProfile {
  submissionId: string;
  kind: "code";
  rootPath: string;
  /** Detected nested apps (monorepo awareness — spec demands full-tree inspection). */
  applications: Array<{
    path: string;
    stack: string[];
    role: "frontend" | "backend" | "shared" | "infra" | "unknown";
  }>;
  architecture: { summary: string; evidence: Evidence[] };
  build: { state: AssessmentState; commands: string[]; evidence: Evidence[] };
  tests: { state: AssessmentState; frameworks: string[]; evidence: Evidence[] };
  requirementCoverage: RequirementCoverage[];
  strengths: string[];
  weaknesses: string[];
  reviewEvidence: Evidence[];
  compatibilityRisk: CompatibilityRisk;
  baseSuitability: { score: number; reasoning: string };
}

export interface IdeaProfile {
  ideaId: string;
  submissionId: string;
  title: string;
  problem?: string;
  proposedAgents?: string;
  sdlcPhases?: string[];
  users?: string;
  beneficiaries?: string;
  workflow?: string;
  data?: string;
  integrations?: string;
  humanOversight?: string;
  security?: string;
  feasibility?: string;
  scalability?: string;
  impact?: string;
  risks?: string[];
  assumptions?: string[];
  differentiators?: string[];
  /** Scores against the mandatory ideation evaluation areas. */
  evaluation: Record<
    "originality" | "feasibility" | "scalability" | "impact_potential" | "alignment_with_scope",
    { state: AssessmentState; reasoning: string; evidence: Evidence[] }
  >;
  evidence: Evidence[];
}

export type SubmissionProfile = CodeSubmissionProfile | IdeaProfile;

// ─── Requirement matrix & evidence fusion ────────────────────────────────────

export interface MatrixCell {
  /** submissionId (code) or ideaId (ideation). */
  sourceId: string;
  state: AssessmentState;
  /** Grounded coverage strength, for per-requirement source comparison. */
  score: number;
  evidence: Evidence[];
  confidence: Confidence;
  compatibilityRisk: CompatibilityRisk;
}

export interface MatrixRow {
  requirementId: string;
  requirementTitle: string;
  cells: MatrixCell[];
  recommendedSource: string | null;
  reasoning: string;
  confidence: Confidence;
  unresolvedConflicts: Conflict[];
}

export interface Conflict {
  id: string;
  type: "human_vs_ai" | "review_vs_source" | "uncertain_evidence" | "contradiction";
  description: string;
  evidence: Evidence[];
  requirementId?: string;
}

export interface RequirementMatrix {
  challengeId: string;
  mode: ChallengeMode;
  rows: MatrixRow[];
  conflicts: Conflict[];
}

// ─── Decisions ───────────────────────────────────────────────────────────────

export interface DecisionOption {
  id: string;
  sourceId: string;
  label: string;
  evidence: Evidence[];
  compatibilityRisk: CompatibilityRisk;
}

export interface Decision {
  id: string;
  /** What this decision is about: a requirement, a base pick, a transplant, or an idea element. */
  kind: "base_selection" | "transplant" | "requirement_source" | "idea_element" | "contradiction";
  title: string;
  requirementId?: string;
  options: DecisionOption[];
  recommendation: string; // option id
  reasoning: string;
  risk: CompatibilityRisk;
  state: DecisionState;
  selectedSource: string | null; // option id chosen by copilot (or recommendation when accepted)
  copilotComment: string | null;
  /** Set true when changing this decision must trigger candidate regeneration. */
  regenerationRequired: boolean;
  updatedAt: string;
}

export interface DecisionWorkspace {
  challengeId: string;
  mode: ChallengeMode;
  decisions: Decision[];
}

// ─── Provenance ──────────────────────────────────────────────────────────────

export interface ProvenanceEntry {
  /** What was produced in the candidate. */
  target: string;
  /** Which source it came from. */
  sourceId: string;
  sourcePath?: string;
  decisionId: string;
  evidence: Evidence[];
  /** Agent-generated bridging / assumptions must be labeled (ideation + code). */
  generated: boolean;
  note?: string;
}

export interface Provenance {
  challengeId: string;
  mode: ChallengeMode;
  entries: ProvenanceEntry[];
}

// ─── Verification ────────────────────────────────────────────────────────────

export interface VerificationStep {
  name: string;
  command?: string;
  state: "passed" | "failed" | "skipped" | "partial" | "not_verifiable";
  detail: string;
  durationMs?: number;
}

export interface Verification {
  challengeId: string;
  mode: ChallengeMode;
  candidate: string;
  overall: "passed" | "failed" | "partial" | "not_verifiable";
  steps: VerificationStep[];
  /** Honest statement: never present a failed candidate as successful. */
  honestSummary: string;
  sourceIntegrityOk: boolean;
}

// ─── Integrity ───────────────────────────────────────────────────────────────

export interface HashRecord {
  path: string;
  sha256: string;
  bytes: number;
}

export interface IntegrityReport {
  challengeId: string;
  before: HashRecord[];
  after: HashRecord[];
  mismatches: Array<{ path: string; before: string; after: string }>;
  /** Any mismatch on a source artifact is a critical failure. */
  critical: boolean;
}

// ─── Usage / cost ────────────────────────────────────────────────────────────

export interface UsageReport {
  provider: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  failures: number;
  approxCostUsd: number;
  processingMs: number;
}

// ─── Workspace manifest ──────────────────────────────────────────────────────

export interface WorkspaceManifest {
  challengeId: string;
  title: string;
  mode: ChallengeMode;
  generatedAt: string;
  combinatorVersion: string;
  reviewContextMode: ReviewContextMode;
  artifacts: string[];
  usage: UsageReport;
  integrityCritical: boolean;
  verificationOverall: string;
}
