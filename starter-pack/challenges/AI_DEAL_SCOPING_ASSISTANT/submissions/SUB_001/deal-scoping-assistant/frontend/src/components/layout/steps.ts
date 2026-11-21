export type WorkspaceId =
  "requirements" | "prd-scope" | "architecture" | "data-integration-ai" | "estimate" | "package"

export interface WorkspaceStep {
  id: WorkspaceId
  title: string
  /** The spec's wording for what the workspace is for. */
  subtitle: string
}

export const WORKSPACE_STEPS: readonly WorkspaceStep[] = [
  { id: "requirements", title: "Requirements", subtitle: "Understand the customer need" },
  { id: "prd-scope", title: "PRD & Scope", subtitle: "Generate the PRD" },
  { id: "architecture", title: "Architecture", subtitle: "Design the solution" },
  {
    id: "data-integration-ai",
    title: "Data, Integration & AI",
    subtitle: "Plan the data flow / Select the AI approach",
  },
  { id: "estimate", title: "Estimate", subtitle: "Estimate the delivery" },
  { id: "package", title: "Package", subtitle: "Prepare the scoping package" },
]
