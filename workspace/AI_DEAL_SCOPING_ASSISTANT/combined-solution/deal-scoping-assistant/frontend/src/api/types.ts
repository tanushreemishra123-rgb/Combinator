// Friendly aliases over the generated OpenAPI types; the generated file is never imported directly.
import type { components } from "@/api/generated/openapi"
import type { ArtifactContentByKind } from "@/api/content"

type Schemas = components["schemas"]

// Re-exported by name: a wildcard type export is not parseable by every tool.
export type {
  AiStrategyContent,
  AiUseCase,
  ArchitectureArea,
  ArchitectureComponent,
  ArchitectureContent,
  Capability,
  ContentFlow,
  ContentStatement,
  DataDomain,
  DataStrategyContent,
  DeliveryPackage,
  EngagementModel,
  Environments,
  EstimateDriversContent,
  ExecutiveSummaryContent,
  FrameworkRecommendation,
  FunctionalScopeContent,
  GroundedElement,
  IntegrationArchitectureContent,
  IntegrationItem,
  Module,
  NarrativeSection,
  OutOfScopeItem,
  Persona,
  PlatformAlternative,
  PlatformRecommendationContent,
  PrdContent,
  PrdRequirement,
  ProcessingClass,
  ProviderOption,
  ProviderPlatformScope,
  RecommendedEnhancement,
  ScopeClass,
  ScopeWorkstream,
  SystemRef,
  TraceabilityEntry,
  UserJourney,
} from "@/api/content"

/* Value unions. */
export type AiMode = Schemas["AiMode"]
export type AiProviderPreference = Schemas["AiProviderPreference"]
export type AnswerStatus = Schemas["AnswerStatus"]
export type ArtifactKind = Schemas["ArtifactKind"]
export type ArtifactStatus = Schemas["ArtifactStatus"]
export type Basis = Schemas["Basis"]
export type BlendedRateMode = Schemas["BlendedRateMode"]
export type BlockType = Schemas["BlockType"]
export type ChangeType = Schemas["ChangeType"]
export type CheckId = Schemas["CheckId"]
export type CheckStatus = Schemas["CheckStatus"]
export type CloudPlatform = Schemas["CloudPlatform"]
export type Complexity = Schemas["Complexity"]
export type ConfidenceLevel = Schemas["ConfidenceLevel"]
export type ConfidenceSignal = Schemas["ConfidenceSignal"]
export type ConfirmationStatus = Schemas["ConfirmationStatus"]
export type CoverageColumn = Schemas["CoverageColumn"]
export type DataMigration = Schemas["DataMigration"]
export type DocumentFormat = Schemas["DocumentFormat"]
export type DocumentKind = Schemas["DocumentKind"]
export type ExportFormat = Schemas["ExportFormat"]
export type ExportStatus = Schemas["ExportStatus"]
export type FactorKind = Schemas["FactorKind"]
export type FindingLevel = Schemas["FindingLevel"]
export type GapCriticality = Schemas["GapCriticality"]
export type ImpactAction = Schemas["ImpactAction"]
export type IntegrationDirection = Schemas["IntegrationDirection"]
export type IntegrationPattern = Schemas["IntegrationPattern"]
export type ItemStatus = Schemas["ItemStatus"]
export type ItemType = Schemas["ItemType"]
export type NfrCategory = Schemas["NfrCategory"]
export type Origin = Schemas["Origin"]
export type PlatformMode = Schemas["PlatformMode"]
export type Priority = Schemas["Priority"]
export type ScopeStatus = Schemas["ScopeStatus"]
export type SecurityLevel = Schemas["SecurityLevel"]
export type SegmentKind = Schemas["SegmentKind"]
export type Severity = Schemas["Severity"]
export type TestingLevel = Schemas["TestingLevel"]
export type UnitType = Schemas["UnitType"]
export type UpdatedBy = Schemas["UpdatedBy"]
export type JsonValue = Schemas["JsonValue"]

/* System and scenarios. */
export type Health = Schemas["Health"]
export type SystemInfo = Schemas["SystemInfo"]
export type Scenario = Schemas["Scenario"]
export type ScenarioDemoChange = Schemas["ScenarioDemoChange"]

/* Sessions. */
export type Session = Schemas["SessionRead"]
export type SessionCreate = Schemas["SessionCreate"]
export type SessionUpdate = Schemas["SessionUpdate"]
export type SessionConfig = Schemas["SessionConfig-Output"]
export type SessionConfigInput = Schemas["SessionConfig-Input"]
export type TeamSizeEntry = Schemas["TeamSizeEntry"]

/* Source documents. */
export type SourceDocument = Schemas["SourceDocument"]
export type DocumentSummary = Schemas["DocumentSummary"]
export type Segment = Schemas["Segment"]

/* Scope model. */
export type ScopeView = Schemas["ScopeView"]
export type ScopeGroup = Schemas["ScopeGroup"]
export type ScopeItem = Schemas["ScopeItem"]
export type ScopeItemCreate = Schemas["ScopeItemCreate-Input"]
export type ScopeItemUpdate = Schemas["ScopeItemUpdate-Input"]
export type ScopeItemDetails = Schemas["ScopeItemDetails-Output"]
export type ScopeItemDetailsInput = Schemas["ScopeItemDetails-Input"]
export type SourceRef = Schemas["SourceRef-Output"]
export type SourceRefInput = Schemas["SourceRef-Input"]
export type GapDetails = Schemas["GapDetails-Output"]
export type AssumptionDetails = Schemas["AssumptionDetails-Output"]
export type QuestionDetails = Schemas["QuestionDetails-Output"]
export type NfrDetails = Schemas["NfrDetails"]
export type IntegrationDetails = Schemas["IntegrationDetails"]
export type QuestionAnswer = Schemas["QuestionAnswer"]

/* Analysis and artifacts. */
export type AnalysisResult = Schemas["AnalysisResult"]
export type Finding = Schemas["Finding"]
export type GenerateOptions = Schemas["GenerateOptions"]
export type GenerateResult = Schemas["GenerateResult"]

/** Envelope whose `content` is narrowed to the model stored for `K`. */
export type Artifact<K extends ArtifactKind = ArtifactKind> = Omit<
  Schemas["ArtifactEnvelope"],
  "kind" | "content"
> & { kind: K; content: ArtifactContentByKind[K] }
export type ArtifactEnvelope = Artifact

/* Estimation. */
export type Estimate = Schemas["Estimate"]
export type EstimateDrivers = Schemas["EstimateDrivers"]
export type EstimateUnit = Schemas["EstimateUnit"]
export type DriverWorkstream = Schemas["DriverWorkstream"]
export type DriverPhase = Schemas["DriverPhase"]
export type UnitComplexityOverride = Schemas["UnitComplexityOverride"]
export type EstimationConfig = Schemas["EstimationConfig"]
export type EstimationRules = Schemas["EstimationRules"]
export type RateCard = Schemas["RateCard"]
export type RoleRate = Schemas["RoleRate"]
export type RoleMixEntry = Schemas["RoleMixEntry"]
export type RomRange = Schemas["RomRange"]
export type PhaseEstimate = Schemas["PhaseEstimate"]
export type PhaseOverhead = Schemas["PhaseOverhead"]
export type WorkstreamEstimate = Schemas["WorkstreamEstimate"]
export type WorkstreamTypeRule = Schemas["WorkstreamTypeRule"]
export type Milestone = Schemas["Milestone"]
export type MissingInput = Schemas["MissingInput"]
export type TraceEntry = Schemas["TraceEntry"]
export type TraceInput = Schemas["TraceInput"]
export type ConfidenceSpread = Schemas["ConfidenceSpread"]
export type ConfidenceThreshold = Schemas["ConfidenceThreshold"]
export type FactorEntry = Schemas["FactorEntry"]
export type FactorScope = Schemas["FactorScope"]
export type BaseEffortEntry = Schemas["BaseEffortEntry"]
export type ProductivityBounds = Schemas["ProductivityBounds"]
export type ReportingRules = Schemas["ReportingRules"]
export type RoundingRule = Schemas["RoundingRule"]
export type HistoricalProject = Schemas["HistoricalProject"]
export type HistoricalProjects = Schemas["HistoricalProjects"]

/* Change impact. */
export type ChangeRecord = Schemas["ChangeRecord"]
export type ChangeRequest = Schemas["ChangeRequest-Input"]
/** The request as the record replays it back. */
export type ChangeRequestRecord = Schemas["ChangeRequest-Output"]
export type ChangeValue = Schemas["ChangeValue"]
export type ImpactEntry = Schemas["ImpactEntry"]
export type RegenerationResult = Schemas["RegenerationResult"]

/* Quality, coverage and package. */
export type QualityReport = Schemas["QualityReport"]
export type QualitySummary = Schemas["QualitySummary"]
export type QualityCheckResult = Schemas["QualityCheckResult"]
export type BlockedLine = Schemas["BlockedLine"]
export type ValidationItem = Schemas["ValidationItem"]
export type CoverageReport = Schemas["CoverageReport"]
export type CoverageRow = Schemas["CoverageRow"]
export type CoverageCell = Schemas["CoverageCell"]
export type UnsupportedAddition = Schemas["UnsupportedAddition"]
export type DocumentModel = Schemas["DocumentModel"]
export type PackageSection = Schemas["Section"]
export type PackageBlock = Schemas["Block"]
export type Statement = Schemas["Statement"]
export type Diagrams = Schemas["Diagrams"]
export type ExportRequest = Schemas["ExportRequest"]
