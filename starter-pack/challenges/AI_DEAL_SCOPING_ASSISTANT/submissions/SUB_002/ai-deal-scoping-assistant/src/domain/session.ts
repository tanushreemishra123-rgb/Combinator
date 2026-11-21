/** The scoping session aggregate persisted in the browser. */
import type { Complexity, GenerationMeta } from './common';
import type { CustomerContext, EstimationConfig, SolutionConfig } from './config';
import type { ArchitectureDesign } from './architecture';
import type { EstimateResult, EstimateSuggestion } from './estimate';
import type { ImpactReport, OutputSectionId } from './impact';
import type { FunctionalScope, PrdDocument } from './prd';
import type { QualityReport } from './quality';
import type { ScopeModel } from './scope';
import type { NormalizedDocument, UploadedDocumentInfo } from './source';
import type { AiStrategyOutput, DataIntegrationOutput } from './strategy';

export type SectionStatus = 'empty' | 'current' | 'stale';

/** Wrapper tracking freshness and human review of each generated deliverable. */
export interface SectionState<T> {
  data: T | null;
  status: SectionStatus;
  /** Set by the user; cleared only when this specific section is regenerated. */
  reviewed: boolean;
  meta: GenerationMeta | null;
  /** Why the section is stale (from the latest impact report). */
  staleReasons: string[];
}

export interface PrdBundle {
  prd: PrdDocument;
  functionalScope: FunctionalScope;
}

/** A reviewer's manual complexity setting for one estimate driver. */
export interface ComplexityOverride {
  driverId: string;
  complexity: Complexity;
}

export interface EstimateBundle {
  suggestion: EstimateSuggestion;
  overrides: ComplexityOverride[];
  result: EstimateResult;
}

export interface SessionOutputs {
  prd: SectionState<PrdBundle>;
  architecture: SectionState<ArchitectureDesign>;
  dataIntegration: SectionState<DataIntegrationOutput>;
  aiStrategy: SectionState<AiStrategyOutput>;
  estimate: SectionState<EstimateBundle>;
}

export interface RequirementsInput {
  rawText: string;
  documents: UploadedDocumentInfo[];
  normalized: NormalizedDocument | null;
  /** Seed scenario the text came from, if any (used by the mock provider's recorded responses). */
  scenarioId: string | null;
}

export interface ScopingSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  customer: CustomerContext;
  input: RequirementsInput;
  scope: ScopeModel | null;
  config: SolutionConfig;
  estimationConfig: EstimationConfig;
  outputs: SessionOutputs;
  changeLog: ImpactReport[];
  quality: QualityReport | null;
  executiveSummary: string;
}

/** Which generation stage owns which output sections (used by impact + regeneration). */
export interface StageDescriptor {
  id: keyof SessionOutputs;
  label: string;
  sections: OutputSectionId[];
}

export const STAGES: readonly StageDescriptor[] = [
  { id: 'prd', label: 'PRD and functional scope', sections: ['prd', 'functionalScope'] },
  { id: 'architecture', label: 'Cloud solution architecture', sections: ['architecture'] },
  { id: 'dataIntegration', label: 'Data and integration strategy', sections: ['dataIntegration'] },
  { id: 'aiStrategy', label: 'AI solution approach', sections: ['aiStrategy'] },
  { id: 'estimate', label: 'Effort, timeline and ROM', sections: ['estimate', 'commercials'] },
];
