import { describe, expect, it } from "vitest"
import { deriveStepStatuses } from "@/components/layout/stepStatus"
import type { ArtifactState } from "@/components/layout/stepStatus"

const fresh = (kind: ArtifactState["kind"]): ArtifactState => ({ kind, status: "fresh" })

describe("deriveStepStatuses", () => {
  it("reports every step as not started for a new session", () => {
    const statuses = deriveStepStatuses({ scope_status: "empty" }, [])

    expect(statuses.get("requirements")).toBe("not_started")
    expect(statuses.get("prd-scope")).toBe("not_started")
    expect(statuses.get("package")).toBe("not_started")
  })

  it("follows the scope status for the requirements step", () => {
    expect(deriveStepStatuses({ scope_status: "analyzed" }, []).get("requirements")).toBe("ready")
    expect(deriveStepStatuses({ scope_status: "approved" }, []).get("requirements")).toBe(
      "approved",
    )
  })

  it("is ready while a workspace has produced only some of its artifacts", () => {
    const statuses = deriveStepStatuses({ scope_status: "approved" }, [fresh("prd")])

    expect(statuses.get("prd-scope")).toBe("ready")
  })

  it("is done once every artifact of the workspace exists and is fresh", () => {
    const statuses = deriveStepStatuses({ scope_status: "approved" }, [
      fresh("prd"),
      fresh("functional_scope"),
    ])

    expect(statuses.get("prd-scope")).toBe("done")
  })

  it("is stale when any artifact of the workspace went stale", () => {
    const statuses = deriveStepStatuses({ scope_status: "approved" }, [
      fresh("prd"),
      { kind: "functional_scope", status: "stale" },
    ])

    expect(statuses.get("prd-scope")).toBe("stale")
  })

  it("treats an undefined session and artifact list as nothing started", () => {
    const statuses = deriveStepStatuses(undefined, undefined)

    expect([...statuses.values()].every((status) => status === "not_started")).toBe(true)
  })
})

describe("deriveStepStatuses for the generated workspaces", () => {
  const approved = { scope_status: "approved" } as const

  it("follows each workspace's own artifacts", () => {
    const statuses = deriveStepStatuses(approved, [
      fresh("architecture"),
      fresh("data_strategy"),
      fresh("integration_architecture"),
      fresh("ai_strategy"),
      fresh("estimate_drivers"),
    ])

    expect(statuses.get("architecture")).toBe("done")
    expect(statuses.get("data-integration-ai")).toBe("done")
    expect(statuses.get("estimate")).toBe("ready")
  })

  it("marks the estimate done once the calculation exists", () => {
    const statuses = deriveStepStatuses(approved, [fresh("estimate_drivers"), fresh("estimate")])

    expect(statuses.get("estimate")).toBe("done")
  })

  it("keeps the package unfinished while the quality gate asks for a review", () => {
    const artifacts = [fresh("executive_summary")]

    expect(deriveStepStatuses(approved, artifacts, "ready").get("package")).toBe("done")
    expect(deriveStepStatuses(approved, artifacts, "review_required").get("package")).toBe("ready")
    expect(deriveStepStatuses(approved, artifacts, "blocked").get("package")).toBe("stale")
  })

  it("ignores the export status while nothing has been assembled", () => {
    expect(deriveStepStatuses(approved, [], "blocked").get("package")).toBe("not_started")
  })
})
