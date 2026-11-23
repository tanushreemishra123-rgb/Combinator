import type {
  ChangeRequest,
  CloudPlatform,
  Complexity,
  ItemStatus,
  Priority,
  ScopeItemCreate,
  SessionConfigInput,
} from "@/api/types"

// The backend fills these in itself, but the request schema still expects them.
const BASE = { description: "", answer: "", platform_change: false }

export function requirementEdit(
  itemId: string,
  title: string,
  description: string,
  note: string,
): ChangeRequest {
  return {
    ...BASE,
    change_type: "scope_item_edit",
    description: note,
    item_ids: [itemId],
    item_update: { title, description },
  }
}

export function priorityChange(itemId: string, priority: Priority, note: string): ChangeRequest {
  return {
    ...BASE,
    change_type: "scope_item_priority",
    description: note,
    item_ids: [itemId],
    item_update: { priority },
  }
}

export function statusChange(itemId: string, status: ItemStatus, note: string): ChangeRequest {
  return {
    ...BASE,
    change_type: "scope_item_status",
    description: note,
    item_ids: [itemId],
    item_update: { status },
  }
}

export function requirementAdded(item: ScopeItemCreate, note: string): ChangeRequest {
  return { ...BASE, change_type: "scope_item_added", description: note, item_create: item }
}

export function requirementRemoved(itemId: string, note: string): ChangeRequest {
  return {
    ...BASE,
    change_type: "scope_item_removed",
    description: note,
    item_ids: [itemId],
  }
}

export function assumptionDecision(
  itemId: string,
  confirmed: boolean,
  note: string,
): ChangeRequest {
  return {
    ...BASE,
    change_type: "assumption_decision",
    description: note,
    item_ids: [itemId],
    confirmed,
  }
}

export function questionAnswered(itemId: string, answer: string, note: string): ChangeRequest {
  return {
    ...BASE,
    change_type: "question_answered",
    description: note,
    item_ids: [itemId],
    answer,
  }
}

export function configChange(config: SessionConfigInput, note: string): ChangeRequest {
  return { ...BASE, change_type: "config_change", description: note, config }
}

export function platformChange(platform: CloudPlatform, note: string): ChangeRequest {
  return {
    ...BASE,
    change_type: "config_change",
    description: note,
    platform_change: true,
    cloud_platform: platform,
  }
}

export function unitComplexityChange(
  unitId: string,
  complexity: Complexity,
  note: string,
): ChangeRequest {
  return {
    ...BASE,
    change_type: "unit_complexity",
    description: note,
    unit_complexity: [{ unit_id: unitId, complexity }],
  }
}
