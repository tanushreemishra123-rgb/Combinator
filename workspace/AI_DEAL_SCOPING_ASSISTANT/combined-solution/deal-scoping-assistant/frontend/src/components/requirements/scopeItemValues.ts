import { z } from "zod"
import type {
  ItemType,
  QuestionDetails,
  ScopeItem,
  ScopeItemCreate,
  ScopeItemDetails,
  ScopeItemDetailsInput,
  ScopeItemUpdate,
} from "@/api/types"

export const scopeItemSchema = z.object({
  title: z.string().trim().min(1, "Give the item a title."),
  description: z.string(),
  priority: z.enum(["must", "high", "medium", "low"]),
  origin: z.enum(["customer_stated", "ai_inferred", "assumed"]),
  status: z.enum(["proposed", "approved", "modified", "rejected"]),
  notes: z.string(),
  nfr_category: z.enum([
    "performance",
    "scalability",
    "availability",
    "security",
    "compliance",
    "usability",
    "maintainability",
    "observability",
  ]),
  integration_system: z.string(),
  integration_direction: z.enum(["inbound", "outbound", "bidirectional"]),
  integration_pattern: z.enum(["api", "event", "batch", "file"]),
  gap_criticality: z.enum(["high", "medium", "low"]),
  assumption_impact: z.string(),
  question_why: z.string(),
})

export type ScopeItemFormValues = z.infer<typeof scopeItemSchema>

export function toFormValues(item?: ScopeItem): ScopeItemFormValues {
  const details = item?.details
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    priority: item?.priority ?? "medium",
    origin: item?.origin ?? "customer_stated",
    status: item?.status ?? "proposed",
    notes: item?.notes ?? "",
    nfr_category: details?.nfr?.category ?? "performance",
    integration_system: details?.integration?.system ?? "",
    integration_direction: details?.integration?.direction ?? "inbound",
    integration_pattern: details?.integration?.pattern ?? "api",
    gap_criticality: details?.gap?.criticality ?? "medium",
    assumption_impact: details?.assumption?.impact_if_wrong ?? "",
    question_why: details?.question?.why_it_matters ?? "",
  }
}

type QuestionInput = NonNullable<ScopeItemDetailsInput["question"]>

/**
 * A request replaces the whole details block, so an edit has to resend every field of the
 * branch it touches, starting from what the item already carries.
 */
export function toQuestionInput(
  details: QuestionDetails | null | undefined,
  overrides: Partial<QuestionInput> = {},
): QuestionInput {
  return {
    why_it_matters: details?.why_it_matters ?? "",
    affected_ids: details?.affected_ids ?? [],
    answer_status: details?.answer_status ?? "open",
    answer: details?.answer ?? "",
    ...overrides,
  }
}

/** Only the branch that belongs to the item type is sent, so nothing else is overwritten. */
function buildDetails(
  type: ItemType,
  values: ScopeItemFormValues,
  existing?: ScopeItemDetails,
): ScopeItemDetailsInput | undefined {
  switch (type) {
    case "NFR":
      return { nfr: { category: values.nfr_category } }
    case "INT":
      return {
        integration: {
          system: values.integration_system,
          direction: values.integration_direction,
          pattern: values.integration_pattern,
        },
      }
    case "GAP":
      return {
        gap: {
          criticality: values.gap_criticality,
          impacted_areas: existing?.gap?.impacted_areas ?? [],
          question_id: existing?.gap?.question_id ?? "",
          assumption_id: existing?.gap?.assumption_id ?? "",
        },
      }
    case "ASM":
      return {
        assumption: {
          requires_confirmation: existing?.assumption?.requires_confirmation ?? true,
          confirmation_status: existing?.assumption?.confirmation_status ?? "pending",
          impact_if_wrong: values.assumption_impact,
        },
      }
    case "Q":
      return {
        question: toQuestionInput(existing?.question, { why_it_matters: values.question_why }),
      }
    default:
      return undefined
  }
}

export function toUpdatePayload(values: ScopeItemFormValues, item: ScopeItem): ScopeItemUpdate {
  return {
    title: values.title,
    description: values.description,
    priority: values.priority,
    origin: values.origin,
    status: values.status,
    notes: values.notes,
    details: buildDetails(item.type, values, item.details) ?? null,
  }
}

export function toCreatePayload(values: ScopeItemFormValues, type: ItemType): ScopeItemCreate {
  return {
    type,
    title: values.title,
    description: values.description,
    priority: values.priority,
    origin: values.origin,
    notes: values.notes,
    absence_note: "",
    details: buildDetails(type, values),
  }
}

/** Types whose form shows extra fields. */
export const TYPES_WITH_DETAILS: readonly ItemType[] = ["NFR", "INT", "GAP", "ASM", "Q"]
