import type { ComponentProps } from "react"
import type { Badge } from "@/components/ui/badge"

export type BadgeVariant = ComponentProps<typeof Badge>["variant"]

// Value unions rendered by the shared badges. They mirror the API contract (PLAN §2, §3, §11).
export type Origin = "customer_stated" | "ai_inferred" | "assumed"
export type Basis = "customer" | "inferred" | "assumed" | "recommended"
export type Priority = "must" | "high" | "medium" | "low"
export type Status = "not_started" | "ready" | "stale" | "approved" | "done"
export type Confidence = "high" | "medium" | "low"
export type AiMode = "mock" | "live"
