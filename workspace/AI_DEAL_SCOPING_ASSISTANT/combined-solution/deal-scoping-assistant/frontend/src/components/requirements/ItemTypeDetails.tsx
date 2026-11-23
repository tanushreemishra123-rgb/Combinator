import { IdList } from "@/components/shared/IdList"
import { KeyValueList } from "@/components/shared/KeyValueList"
import type { KeyValueItem } from "@/components/shared/KeyValueList"
import { label } from "@/lib/labels"
import type { ScopeItem } from "@/api/types"

interface ItemTypeDetailsProps {
  item: ScopeItem
  onSelectId?: (id: string) => void
}

/** The fields that only exist for some item types (NFR, INT, GAP, ASM, Q). */
export function ItemTypeDetails({ item, onSelectId }: ItemTypeDetailsProps) {
  const details = item.details
  const rows: KeyValueItem[] = []

  if (details?.nfr) rows.push({ label: "Category", value: label(details.nfr.category) })

  if (details?.integration) {
    rows.push(
      { label: "System", value: details.integration.system },
      { label: "Direction", value: label(details.integration.direction) },
      { label: "Pattern", value: label(details.integration.pattern) },
    )
  }

  if (details?.gap) {
    rows.push({ label: "Criticality", value: label(details.gap.criticality) })
    if (details.gap.impacted_areas?.length) {
      rows.push({ label: "Impacted areas", value: details.gap.impacted_areas.join(", ") })
    }
    const linked = [details.gap.question_id, details.gap.assumption_id].filter(Boolean) as string[]
    if (linked.length > 0) {
      rows.push({
        label: "Raised as",
        value: <IdList ids={linked} label="Linked question or assumption" onSelect={onSelectId} />,
      })
    }
  }

  if (details?.assumption) {
    rows.push({
      label: "Confirmation",
      value: `${label(details.assumption.confirmation_status ?? "pending")}${
        details.assumption.requires_confirmation ? " — the customer must confirm this" : ""
      }`,
    })
    if (details.assumption.impact_if_wrong) {
      rows.push({ label: "If it is wrong", value: details.assumption.impact_if_wrong })
    }
  }

  if (details?.question) {
    if (details.question.why_it_matters) {
      rows.push({ label: "Why it matters", value: details.question.why_it_matters })
    }
    rows.push({ label: "Answer state", value: label(details.question.answer_status ?? "open") })
    if (details.question.answer) rows.push({ label: "Answer", value: details.question.answer })
    if (details.question.affected_ids?.length) {
      rows.push({
        label: "Affects",
        value: (
          <IdList
            ids={details.question.affected_ids}
            label="Items affected by the answer"
            onSelect={onSelectId}
          />
        ),
      })
    }
  }

  if (rows.length === 0) return null
  return <KeyValueList items={rows} />
}
