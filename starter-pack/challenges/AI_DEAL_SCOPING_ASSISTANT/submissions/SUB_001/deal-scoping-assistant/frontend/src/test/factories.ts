import type {
  GapDetails,
  QuestionDetails,
  ScopeItemDetails,
  ScopeItem,
  ScopeView,
  Session,
  SessionConfig,
  SourceRef,
  SystemInfo,
} from "@/api/types"

const NOW = "2026-09-17T10:00:00Z"

/** A complete details block; every branch the item does not use is null, as the API returns it. */
export function makeDetails(overrides: Partial<ScopeItemDetails> = {}): ScopeItemDetails {
  return { nfr: null, integration: null, gap: null, assumption: null, question: null, ...overrides }
}

export function makeScopeItem(overrides: Partial<ScopeItem> & Pick<ScopeItem, "id">): ScopeItem {
  return {
    type: "FR",
    title: "Self-service renewals",
    description: "Customers renew a policy without calling support.",
    priority: "high",
    origin: "customer_stated",
    source_refs: [],
    related_ids: [],
    tags: [],
    notes: "",
    absence_note: "",
    details: makeDetails(),
    status: "proposed",
    version: 1,
    updated_by: "ai",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

export function makeSourceRef(overrides: Partial<SourceRef> = {}): SourceRef {
  return {
    document_id: "doc-1",
    segment_id: "D1.S2",
    quote: "renew a policy online",
    start: 0,
    end: 0,
    verified: true,
    ...overrides,
  }
}

export function makeScopeView(items: ScopeItem[], overrides: Partial<ScopeView> = {}): ScopeView {
  const types = [...new Set(items.map((item) => item.type))]
  return {
    session_id: "session-1",
    scope_version: 0,
    scope_status: "analyzed",
    locked: false,
    groups: types.map((type) => ({ type, items: items.filter((item) => item.type === type) })),
    ...overrides,
  }
}

export function makeSystemInfo(overrides: Partial<SystemInfo> = {}): SystemInfo {
  return {
    ai_mode: "mock",
    provider: "",
    model: "",
    live_available: false,
    fallback_reason: "",
    ...overrides,
  }
}

export function makeSessionConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    rate_card_id: "default",
    rate_overrides: [],
    expected_users: null,
    target_regions: [],
    delivery_deadline: null,
    security_level: "standard",
    regulatory_constraints: [],
    ai_provider_preference: null,
    contingency_pct: 15,
    blended_rate_mode: "role_mix",
    explicit_blended_rate: null,
    productivity_factor: 1,
    working_weeks_per_month: 4,
    environments_count: 3,
    testing_level: "standard",
    data_migration: "none",
    team_sizes: [],
    ...overrides,
  }
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    name: "Policy modernization",
    customer_name: "Northwind Insurance",
    opportunity_context: "",
    cloud_platform: null,
    platform_mode: "selected",
    config: makeSessionConfig(),
    scope_version: 0,
    scope_status: "empty",
    ai_mode: "mock",
    scenario_slug: "",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

export function makeGapDetails(overrides: Partial<GapDetails> = {}): GapDetails {
  return {
    criticality: "medium",
    impacted_areas: [],
    question_id: "",
    assumption_id: "",
    ...overrides,
  }
}

export function makeQuestionDetails(overrides: Partial<QuestionDetails> = {}): QuestionDetails {
  return {
    why_it_matters: "",
    affected_ids: [],
    answer_status: "open",
    answer: "",
    ...overrides,
  }
}
