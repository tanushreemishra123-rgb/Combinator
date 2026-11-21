import type {
  AiUseCase,
  ArchitectureComponent,
  ChangeRecord,
  DocumentModel,
  PackageBlock,
  QualityCheckResult,
  QualityReport,
} from "@/api/types"

const NOW = "2026-09-17T10:00:00Z"
function grounding(): Pick<
  ArchitectureComponent,
  "req_ids" | "basis" | "validation_required" | "validation_reason"
> {
  return {
    req_ids: ["FR_01"],
    basis: "customer",
    validation_required: false,
    validation_reason: "",
  }
}

export function makeComponent(
  overrides: Partial<ArchitectureComponent> & Pick<ArchitectureComponent, "id">,
): ArchitectureComponent {
  return {
    ...grounding(),
    name: "Managed relational database",
    area: "databases_and_storage",
    cloud_service: "Azure Database for PostgreSQL",
    purpose: "Stores policy records.",
    supported_ids: ["DATA_01"],
    rationale: "Managed PostgreSQL with automated backups.",
    trade_offs: [],
    dependencies: [],
    security_considerations: "",
    environments: [],
    ...overrides,
  }
}

export function makeUseCase(overrides: Partial<AiUseCase> & Pick<AiUseCase, "id">): AiUseCase {
  return {
    ...grounding(),
    name: "Reply drafting",
    description: "Drafts a grounded reply for an agent to approve.",
    processing_class: "ai",
    pattern: "Retrieval-augmented generation",
    model_options: [],
    retrieval_required: false,
    retrieval_notes: "",
    orchestration: "",
    prompt_and_structured_output: "",
    evaluation: "",
    responsible_ai_safety: "",
    monitoring_feedback: "",
    human_review: "",
    data_privacy: "",
    ...overrides,
  }
}

export function makeCheck(
  overrides: Partial<QualityCheckResult> & Pick<QualityCheckResult, "id">,
): QualityCheckResult {
  return {
    name: "High-priority coverage",
    severity: "error",
    status: "passed",
    message: "Every must and high requirement is covered.",
    affected_ids: [],
    remediation: "Add or extend a capability.",
    ...overrides,
  }
}

export function makeQualityReport(overrides: Partial<QualityReport> = {}): QualityReport {
  return {
    session_id: "session-1",
    scope_version: 1,
    checks: [makeCheck({ id: "QG_01" })],
    summary: {
      coverage_pct: 92,
      uncovered_requirements: 2,
      unresolved_questions: 4,
      unsupported_recommendations: 1,
      estimate_confidence: "medium",
      export_status: "review_required",
    },
    items_requiring_human_validation: [],
    created_at: NOW,
    ...overrides,
  }
}

export function makeChangeRecord(overrides: Partial<ChangeRecord> = {}): ChangeRecord {
  return {
    id: "change-1",
    session_id: "session-1",
    scope_version: 2,
    request: {
      change_type: "config_change",
      description: "Expected users increased to 500,000",
      item_ids: [],
      values: [],
      item_update: null,
      item_create: null,
      answer: "",
      confirmed: null,
      config: null,
      cloud_platform: null,
      platform_change: false,
      unit_complexity: [],
    },
    affected: [
      {
        artifact: "architecture",
        element_ids: ["ARC_02"],
        reason: "Scalability components follow the user volume.",
        action: "regenerate",
      },
    ],
    affected_item_ids: ["NFR_02"],
    stale_kinds: ["architecture"],
    coverage_affected: false,
    quality_gate_affected: true,
    unaffected_summary: ["Customer personas", "Existing CRM integration"],
    suggested_actions: ["Regenerate the architecture, then recalculate the estimate."],
    narrative: "",
    created_at: NOW,
    ...overrides,
  }
}

export function makeBlock(
  overrides: Partial<PackageBlock> & Pick<PackageBlock, "type">,
): PackageBlock {
  return {
    text: "",
    level: 2,
    items: [],
    headers: [],
    rows: [],
    image_ref: "",
    language: "",
    ...overrides,
  }
}

export function makeDocument(overrides: Partial<DocumentModel> = {}): DocumentModel {
  return {
    title: "Solution scoping package",
    subtitle: "Halvard Mutual Insurance Group",
    generated_at: NOW,
    disclaimer: "This document is an AI-assisted internal planning output.",
    sections: [],
    ...overrides,
  }
}
