import { artifactOf } from "@/api/hooks/artifacts"
import type { WorkspaceId } from "@/components/layout/steps"
import { label } from "@/lib/labels"
import type { Artifact, ArtifactKind, GroundedElement } from "@/api/types"

/** One generated element (capability, component, integration...) resolved from its id. */
export interface ArtifactElement {
  id: string
  name: string
  /** The artifact the element lives in, e.g. "Architecture". */
  source: string
  workspace: WorkspaceId
  description: string
  facts: readonly { label: string; value: string }[]
  /** Ids the element rests on, in the order they should be listed. */
  linkedIds: readonly string[]
  element: GroundedElement
}

function text(value: string | readonly string[] | undefined): string {
  if (!value) return ""
  return Array.isArray(value) ? value.join(", ") : String(value)
}

function facts(entries: readonly [string, string | readonly string[] | undefined][]) {
  return entries
    .map(([name, value]) => ({ label: name, value: text(value) }))
    .filter((f) => f.value)
}

/** Every id prefix the generated artifacts use, and where each one is found. */
export function findArtifactElement(
  artifacts: readonly Artifact[] | undefined,
  id: string | null,
): ArtifactElement | undefined {
  if (!artifacts || !id) return undefined
  const prefix = id.split("_")[0]
  const from = <K extends ArtifactKind>(kind: K) => artifactOf(artifacts, kind)?.content

  if (prefix === "CAP" || prefix === "WS" || prefix === "DP" || prefix === "ENH") {
    const scope = from("functional_scope")
    if (!scope) return undefined
    const capability = scope.capabilities.find((c) => c.id === id)
    if (capability) {
      return {
        id,
        name: capability.name,
        source: "Functional scope",
        workspace: "prd-scope",
        description: capability.description,
        facts: facts([
          ["Priority", label(capability.priority)],
          ["Scope class", label(capability.scope_class)],
          ["Module", capability.module],
          ["Dependencies", capability.dependencies],
        ]),
        linkedIds: [
          ...capability.included_req_ids,
          capability.workstream_id,
          capability.delivery_package_id,
        ].filter(Boolean),
        element: capability,
      }
    }
    const workstream = scope.workstreams.find((w) => w.id === id)
    if (workstream) {
      return {
        id,
        name: workstream.name,
        source: "Functional scope",
        workspace: "prd-scope",
        description: "",
        facts: [],
        linkedIds: [...workstream.capability_ids, ...workstream.req_ids],
        element: workstream,
      }
    }
    const pkg = scope.delivery_packages.find((p) => p.id === id)
    if (pkg) {
      return {
        id,
        name: pkg.name,
        source: "Functional scope",
        workspace: "prd-scope",
        description: "",
        facts: facts([["Engagement model", label(pkg.engagement_model)]]),
        linkedIds: [...pkg.capability_ids, ...pkg.req_ids],
        element: pkg,
      }
    }
    const enhancement = scope.recommended_enhancements.find((e) => e.id === id)
    if (enhancement) {
      return {
        id,
        name: "Recommended enhancement",
        source: "Functional scope",
        workspace: "prd-scope",
        description: enhancement.description,
        facts: facts([["Rationale", enhancement.rationale]]),
        linkedIds: [...enhancement.related_req_ids, ...enhancement.req_ids],
        element: enhancement,
      }
    }
    return undefined
  }

  if (prefix === "ARC") {
    const component = from("architecture")?.components.find((c) => c.id === id)
    if (!component) return undefined
    return {
      id,
      name: component.name,
      source: "Architecture",
      workspace: "architecture",
      description: component.purpose,
      facts: facts([
        ["Area", label(component.area)],
        ["Cloud service", component.cloud_service],
        ["Rationale", component.rationale],
        ["Trade-offs", component.trade_offs],
        ["Security", component.security_considerations],
        ["Environments", component.environments],
      ]),
      linkedIds: [...component.supported_ids, ...component.dependencies],
      element: component,
    }
  }

  if (prefix === "DOM") {
    const domain = from("data_strategy")?.domains.find((d) => d.id === id)
    if (!domain) return undefined
    return {
      id,
      name: domain.name,
      source: "Data strategy",
      workspace: "data-integration-ai",
      description: domain.description,
      facts: facts([
        ["Sources", domain.sources],
        ["Owner", domain.owner],
      ]),
      linkedIds: domain.req_ids,
      element: domain,
    }
  }

  if (prefix === "IA") {
    const integration = from("integration_architecture")?.integrations.find((i) => i.id === id)
    if (!integration) return undefined
    return {
      id,
      name: integration.name,
      source: "Integration architecture",
      workspace: "data-integration-ai",
      description: `${integration.source_system} to ${integration.target_system}`,
      facts: facts([
        ["Direction", label(integration.direction)],
        ["Pattern", label(integration.pattern)],
        ["Authentication", integration.auth_approach],
        ["Error handling", integration.error_handling],
        ["Retry", integration.retry_behavior],
        ["Monitoring", integration.monitoring],
        ["Synchronisation", integration.sync_considerations],
      ]),
      linkedIds: [...integration.req_ids, ...integration.arc_ids],
      element: integration,
    }
  }

  if (prefix === "AI") {
    const useCase = from("ai_strategy")?.use_cases.find((u) => u.id === id)
    if (!useCase) return undefined
    return {
      id,
      name: useCase.name,
      source: "AI strategy",
      workspace: "data-integration-ai",
      description: useCase.description,
      facts: facts([
        ["Processing", label(useCase.processing_class)],
        ["Pattern", useCase.pattern],
        ["Models", useCase.model_options],
        ["Evaluation", useCase.evaluation],
        ["Human review", useCase.human_review],
        ["Data privacy", useCase.data_privacy],
      ]),
      linkedIds: useCase.req_ids,
      element: useCase,
    }
  }

  return undefined
}
