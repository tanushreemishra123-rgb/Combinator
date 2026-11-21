// Artifact content types. All of them come from the generated OpenAPI types, so they
// can never drift from the backend models; this file only gives them friendly names.
import type { components } from "@/api/generated/openapi"

type Schemas = components["schemas"]

// The grounding fields every generated element carries (backend `Element` base class).
export type GroundedElement = Pick<
  Schemas["Statement"],
  "req_ids" | "basis" | "validation_required" | "validation_reason"
>
export type ContentStatement = Schemas["Statement"]
export type NarrativeSection = Schemas["NarrativeSection"]
export type ContentFlow = Schemas["Flow"]
export type OutOfScopeItem = Schemas["OutOfScopeItem"]
export type SystemRef = Schemas["SystemRef"]

export type PlatformAlternative = Schemas["PlatformAlternative"]
export type PlatformRecommendationContent = Schemas["PlatformRecommendation"]
export type ExecutiveSummaryContent = Schemas["ExecutiveSummary"]

export type ArchitectureArea = Schemas["ArchitectureArea"]
export type ArchitectureComponent = Schemas["ArchitectureComponent"]
export type Environments = Schemas["Environments"]
export type ArchitectureContent = Schemas["Architecture"]
export type DataDomain = Schemas["DataDomain"]
export type DataStrategyContent = Schemas["DataStrategy"]
export type IntegrationItem = Schemas["IntegrationItem"]
export type IntegrationArchitectureContent = Schemas["IntegrationArchitecture"]
export type ProcessingClass = Schemas["ProcessingClass"]
export type ProviderPlatformScope = Schemas["ProviderPlatformScope"]
export type AiUseCase = Schemas["AiUseCase"]
export type ProviderOption = Schemas["ProviderOption"]
export type FrameworkRecommendation = Schemas["FrameworkRecommendation"]
export type AiStrategyContent = Schemas["AiStrategy"]

export type Persona = Schemas["Persona"]
export type UserJourney = Schemas["UserJourney"]
export type PrdRequirement = Schemas["PrdRequirement"]
export type TraceabilityEntry = Schemas["TraceabilityEntry"]
export type PrdContent = Schemas["Prd"]
export type ScopeClass = Schemas["ScopeClass"]
export type EngagementModel = Schemas["EngagementModel"]
export type Capability = Schemas["Capability"]
export type Module = Schemas["Module"]
export type ScopeWorkstream = Schemas["Workstream"]
export type DeliveryPackage = Schemas["DeliveryPackage"]
export type RecommendedEnhancement = Schemas["RecommendedEnhancement"]
export type FunctionalScopeContent = Schemas["FunctionalScope"]
export type EstimateDriversContent = Schemas["EstimateDrivers"]

/** The content model stored under each artifact kind (backend CONTENT_MODEL_BY_KIND). */
export interface ArtifactContentByKind {
  prd: PrdContent
  functional_scope: FunctionalScopeContent
  platform_recommendation: PlatformRecommendationContent
  architecture: ArchitectureContent
  data_strategy: DataStrategyContent
  integration_architecture: IntegrationArchitectureContent
  ai_strategy: AiStrategyContent
  estimate_drivers: EstimateDriversContent
  estimate: Schemas["Estimate"]
  executive_summary: ExecutiveSummaryContent
}
