// One place for the words shown to a reviewer: no raw enum value ever reaches the screen.
import type { ArchitectureArea, ArtifactKind, CoverageColumn, ItemType } from "@/api/types"
import { lookupTable } from "@/lib/lookup"

// Words that must stay upper-case wherever they appear in a value.
const ACRONYMS = new Set(["ai", "api", "ui", "ux", "prd", "rom", "sla", "crm", "erp", "ml", "dr"])

/** snake_case fallback, so a value added to the API later still reads as a sentence. */
function humanize(value: string): string {
  const words = value.replace(/_/g, " ").trim().toLowerCase().split(" ")
  return words
    .map((word, index) => {
      if (ACRONYMS.has(word)) return word.toUpperCase()
      return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    })
    .join(" ")
}

// Only values whose wording differs from the fallback are listed.
const LABELS = lookupTable<string, string>({
  // Scope item types.
  BR: "Business objective",
  PER: "Persona",
  FR: "Functional requirement",
  NFR: "Non-functional requirement",
  SYS: "Existing system",
  INT: "Integration",
  DATA: "Data requirement",
  SEC: "Security & compliance",
  TECH: "Technology preference",
  CON: "Delivery constraint",
  DEP: "Dependency",
  RISK: "Risk",
  GAP: "Missing information",
  ASM: "Assumption",
  Q: "Clarification question",
  // Origin, basis and review state.
  customer_stated: "Customer stated",
  ai_inferred: "AI inferred",
  customer: "Customer stated",
  inferred: "AI inferred",
  not_started: "Not started",
  // Scope classes (spec FR2).
  customer_requested: "Customer-requested",
  ai_interpreted: "AI interpretation",
  recommended_enhancement: "Recommended enhancement",
  assumption_pending: "Assumption pending",
  // Delivery and platform wording.
  topcoder_challenges: "Topcoder challenges",
  delivery_package: "Delivery package",
  role_mix: "Role mix",
  aws: "AWS",
  openai: "OpenAI",
  platform_native: "Cloud platform's own AI service",
  gcp: "Google Cloud",
  azure: "Azure",
  very_high: "Very high",
  human_decision: "Human decision",
  md: "Markdown",
  txt: "Plain text",
  pdf: "PDF",
  docx: "Word document",
  functional_scope: "Functional scope",
  platform_recommendation: "Platform recommendation",
  data_strategy: "Data strategy",
  integration_architecture: "Integration architecture",
  ai_strategy: "AI strategy",
  estimate_drivers: "Estimate drivers",
  executive_summary: "Executive summary",
  // Quality and export state.
  review_required: "Review required",
  not_applicable: "Not applicable",
  // Processing classes: the spec asks AI work to be told apart from rules and people.
  deterministic: "Deterministic rule",
  // Change-impact actions.
  relink: "Re-link",
  // Change types, in the reviewer's words.
  scope_item_edit: "Requirement edited",
  scope_item_priority: "Priority changed",
  scope_item_status: "Status changed",
  scope_item_added: "Requirement added",
  scope_item_removed: "Requirement removed",
  assumption_decision: "Assumption confirmed or rejected",
  question_answered: "Question answered",
  config_change: "Configuration changed",
  unit_complexity: "Unit complexity changed",
  // Architecture areas that need their own wording.
  apis: "APIs",
  user_facing_applications: "User-facing applications",
  backend_services: "Backend services",
  databases_and_storage: "Databases and storage",
  messaging_and_event_processing: "Messaging and event processing",
  integration_components: "Integration components",
  observability_and_monitoring: "Observability and monitoring",
  security_controls: "Security controls",
  deployment_and_runtime: "Deployment and runtime",
  availability_and_scalability: "Availability and scalability",
  ai_and_ml_services: "AI and ML services",
  identity_and_access_management: "Identity and access management",
  environments_dev_test_prod: "Environments (dev, test, prod)",
  backup_and_disaster_recovery: "Backup and disaster recovery",
})

/** The label for any API enum value. */
export function label(value: string): string {
  return LABELS.get(value) ?? humanize(value)
}

const ITEM_TYPE_PLURAL = lookupTable<ItemType, string>({
  BR: "Business objectives",
  PER: "Personas",
  FR: "Functional requirements",
  NFR: "Non-functional requirements",
  SYS: "Existing systems",
  INT: "Integrations",
  DATA: "Data requirements",
  SEC: "Security & compliance",
  TECH: "Technology preferences",
  CON: "Delivery constraints",
  DEP: "Dependencies",
  RISK: "Risks",
  GAP: "Missing information",
  ASM: "Assumptions",
  Q: "Clarification questions",
})

/** Heading for a group of items of one type; a plain string still gets words back. */
export function itemTypePlural(type: string): string {
  return ITEM_TYPE_PLURAL.get(type) ?? label(type)
}

const COVERAGE_COLUMNS = lookupTable<CoverageColumn, string>({
  prd: "PRD",
  capability: "Capability",
  architecture: "Architecture",
  data: "Data",
  integration: "Integration",
  ai: "AI",
  workstream: "Workstream",
})

export function coverageColumnLabel(column: CoverageColumn): string {
  return COVERAGE_COLUMNS.get(column) ?? label(column)
}

/** The spec's professional wording for the step that produces an artifact. */
const ARTIFACT_STEPS = lookupTable<ArtifactKind, string>({
  prd: "Generate the PRD",
  functional_scope: "Build the functional scope",
  platform_recommendation: "Recommend a cloud platform",
  architecture: "Design the solution",
  data_strategy: "Plan the data flow",
  integration_architecture: "Plan the integrations",
  ai_strategy: "Select the AI approach",
  estimate_drivers: "Prepare the estimate drivers",
  estimate: "Estimate the delivery",
  executive_summary: "Write the executive summary",
})

export function artifactStepLabel(kind: ArtifactKind): string {
  return ARTIFACT_STEPS.get(kind) ?? label(kind)
}

/** The 14 architecture areas, in the order the challenge lists them. */
export const ARCHITECTURE_AREAS = [
  "user_facing_applications",
  "backend_services",
  "apis",
  "databases_and_storage",
  "identity_and_access_management",
  "messaging_and_event_processing",
  "integration_components",
  "ai_and_ml_services",
  "observability_and_monitoring",
  "security_controls",
  "deployment_and_runtime",
  "environments_dev_test_prod",
  "availability_and_scalability",
  "backup_and_disaster_recovery",
] as const satisfies readonly ArchitectureArea[]

const STRUCTURED_ID = /^[A-Z]+_\d+$/
const INDEXED_FIELD = /^([a-z][a-z_]*)\[(\d+)\]$/
const FIELD_NAME = /^[a-z][a-z_]*$/

/** Whether a value is a scope or artifact id such as FR_01 or ARC_12. */
export function isStructuredId(value: string): boolean {
  return STRUCTURED_ID.test(value)
}

/**
 * Display text for anything the impact analysis points at: ids stay as they are, section
 * names such as "deployment_runtime" or "key_risks[0]" become plain words.
 */
export function elementLabel(value: string): string {
  if (isStructuredId(value)) return value
  const indexed = INDEXED_FIELD.exec(value)
  if (indexed) return `${label(indexed[1])} ${Number(indexed[2]) + 1}`
  return FIELD_NAME.test(value) ? label(value) : value
}
