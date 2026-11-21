import * as build from "@/components/package/changeRequests"
import type {
  ChangeRequest,
  CloudPlatform,
  Complexity,
  ItemStatus,
  ItemType,
  Origin,
  Priority,
  SecurityLevel,
  SessionConfig,
} from "@/api/types"

/** What the reviewer picks. Several kinds map onto the backend's one config change. */
export type ChangeKind =
  | "requirement_edit"
  | "requirement_priority"
  | "requirement_status"
  | "requirement_added"
  | "requirement_removed"
  | "assumption_decision"
  | "question_answered"
  | "cloud_platform"
  | "expected_users"
  | "delivery_deadline"
  | "rate_card"
  | "contingency"
  | "security_level"
  | "regulatory_constraints"
  | "ai_provider"
  | "unit_complexity"

// One ordered list: the picker shows it in this order and reads its words from the same source.
const CHANGE_KIND_ENTRIES: readonly (readonly [ChangeKind, string])[] = [
  ["requirement_edit", "Reword a requirement"],
  ["requirement_priority", "Change a requirement's priority"],
  ["requirement_status", "Bring a requirement in or out of scope"],
  ["requirement_added", "Add a requirement"],
  ["requirement_removed", "Remove a requirement"],
  ["assumption_decision", "Confirm or reject an assumption"],
  ["question_answered", "Answer a clarification question"],
  ["cloud_platform", "Change the cloud platform"],
  ["expected_users", "Change the expected user volume"],
  ["delivery_deadline", "Change the delivery deadline"],
  ["rate_card", "Change the rate card"],
  ["contingency", "Change the contingency percentage"],
  ["security_level", "Change the security and compliance level"],
  ["regulatory_constraints", "Change the regulatory constraints"],
  ["ai_provider", "Change the AI provider preference"],
  ["unit_complexity", "Re-rate a unit's complexity"],
]

export const CHANGE_KINDS: readonly ChangeKind[] = CHANGE_KIND_ENTRIES.map(([kind]) => kind)

const CHANGE_KIND_LABELS = new Map(CHANGE_KIND_ENTRIES)

export function changeKindLabel(kind: ChangeKind): string {
  return CHANGE_KIND_LABELS.get(kind) ?? kind
}

export interface ChangeFormValues {
  note: string
  itemId: string
  title: string
  description: string
  priority: Priority
  status: ItemStatus
  newItemType: ItemType
  newItemOrigin: Origin
  decision: "confirm" | "reject"
  answer: string
  platform: CloudPlatform
  expectedUsers: string
  deadline: string
  rateCardId: string
  contingency: string
  securityLevel: SecurityLevel
  regulatory: string
  aiProvider: string
  unitId: string
  complexity: Complexity
}

function list(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/** Builds the request the backend expects, carrying the untouched config forward. */
export function buildChangeRequest(
  kind: ChangeKind,
  values: ChangeFormValues,
  config: SessionConfig,
): ChangeRequest {
  const note = values.note
  switch (kind) {
    case "requirement_edit":
      return build.requirementEdit(values.itemId, values.title, values.description, note)
    case "requirement_priority":
      return build.priorityChange(values.itemId, values.priority, note)
    case "requirement_status":
      return build.statusChange(values.itemId, values.status, note)
    case "requirement_added":
      return build.requirementAdded(
        {
          type: values.newItemType,
          title: values.title,
          description: values.description,
          origin: values.newItemOrigin,
          priority: values.priority,
          notes: "",
          absence_note: "",
        },
        note,
      )
    case "requirement_removed":
      return build.requirementRemoved(values.itemId, note)
    case "assumption_decision":
      return build.assumptionDecision(values.itemId, values.decision === "confirm", note)
    case "question_answered":
      return build.questionAnswered(values.itemId, values.answer, note)
    case "cloud_platform":
      return build.platformChange(values.platform, note)
    case "unit_complexity":
      return build.unitComplexityChange(values.unitId, values.complexity, note)
    case "expected_users":
      return build.configChange(
        {
          ...config,
          expected_users: values.expectedUsers.trim() === "" ? null : Number(values.expectedUsers),
        },
        note,
      )
    case "delivery_deadline":
      return build.configChange(
        { ...config, delivery_deadline: values.deadline.trim() === "" ? null : values.deadline },
        note,
      )
    case "rate_card":
      // Overrides are priced in the old card's currency, so they do not carry over.
      return build.configChange(
        { ...config, rate_card_id: values.rateCardId, rate_overrides: [] },
        note,
      )
    case "contingency":
      return build.configChange({ ...config, contingency_pct: Number(values.contingency) }, note)
    case "security_level":
      return build.configChange({ ...config, security_level: values.securityLevel }, note)
    case "regulatory_constraints":
      return build.configChange(
        { ...config, regulatory_constraints: list(values.regulatory) },
        note,
      )
    case "ai_provider":
      return build.configChange(
        {
          ...config,
          ai_provider_preference:
            values.aiProvider === "unset"
              ? null
              : (values.aiProvider as NonNullable<SessionConfig["ai_provider_preference"]>),
        },
        note,
      )
  }
}

/** Kinds that act on one existing scope item. */
export const NEEDS_ITEM_ID: readonly ChangeKind[] = [
  "requirement_edit",
  "requirement_priority",
  "requirement_status",
  "requirement_removed",
  "assumption_decision",
  "question_answered",
]

export type ChangeFormErrors = Partial<Record<keyof ChangeFormValues, string>>

function isNumber(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Number(value))
}

/** Field errors for the chosen kind; an empty result means the change can be sent. */
export function validateChangeValues(kind: ChangeKind, values: ChangeFormValues): ChangeFormErrors {
  const errors: ChangeFormErrors = {}
  if (NEEDS_ITEM_ID.includes(kind) && values.itemId.trim() === "") {
    errors.itemId = "Name the scope item, e.g. FR_01."
  }
  if ((kind === "requirement_edit" || kind === "requirement_added") && values.title.trim() === "") {
    errors.title = "Give the requirement a title."
  }
  if (kind === "question_answered" && values.answer.trim() === "") {
    errors.answer = "Record the answer."
  }
  if (kind === "unit_complexity" && values.unitId.trim() === "") {
    errors.unitId = "Name the estimate unit, e.g. CAP_01."
  }
  if (
    kind === "expected_users" &&
    values.expectedUsers.trim() !== "" &&
    !isNumber(values.expectedUsers)
  ) {
    // nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_username -- a validation message for the expected-user-count field, not a credential
    errors.expectedUsers = "Enter a number, or leave it empty."
  }
  if (kind === "contingency") {
    const pct = Number(values.contingency)
    if (!isNumber(values.contingency) || pct < 0 || pct > 100) {
      errors.contingency = "Enter a contingency between 0 and 100."
    }
  }
  return errors
}
