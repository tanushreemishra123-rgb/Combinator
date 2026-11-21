/**
 * Builds the `PackageDocument` (spec 6, "Integrated Scoping Package"): every section listed in
 * `PACKAGE_SECTION_IDS`, in order, each produced by one small, independently testable builder in
 * this folder. `buildPackageDiagrams` exposes the underlying `DiagramModel`s separately (the
 * domain's `PackageDocument` only carries Mermaid text) so `toHtml` can render the same diagrams as
 * SVG instead of a `<pre>` block of Mermaid source.
 */
import { buildArchitectureDiagram } from '../../architecture';
import { EXPORT_DISCLAIMER, PACKAGE_SECTION_IDS } from '../../domain';
import type { DiagramModel, PackageDocument, PackageSection, PackageSectionId, ScopingSession } from '../../domain';
import { buildDataFlowDiagram } from '../../strategy';
import { buildAiSolutionSection } from './aiSolution';
import { buildSolutionArchitectureSection } from './architecture';
import { buildArchitectureDiagramSection } from './architectureDiagram';
import { buildChangeLogSection } from './changeLog';
import { buildCustomerObjectivesSection } from './customerObjectives';
import { buildDataStrategySection } from './dataStrategy';
import { buildDeliveryPhasesSection } from './deliveryPhases';
import { buildEffortTimelineSection } from './effortTimeline';
import { buildExecutiveSummarySection } from './executiveSummary';
import { buildFunctionalScopeSection } from './functionalScope';
import { buildIntegrationArchitectureSection } from './integrationArchitecture';
import { buildAssumptionsSection, buildDependenciesSection, buildOpenQuestionsSection, buildRisksSection } from './notes';
import { buildPrdSection } from './prd';
import { buildQualityReviewSection } from './qualityReview';
import { buildRequirementCoverageSection } from './requirementCoverage';
import { buildRequirementSummarySection } from './requirementSummary';
import { buildRomCommercialsSection } from './romCommercials';
import { buildTechnologiesSection } from './technologies';
import { buildTraceabilityInfoSection } from './traceabilityInfo';

export interface PackageBuildOptions {
  aiModeLabel: string;
  generatedAt: string;
}

/** The two diagrams a package can carry - the architecture view and the data/integration flow view. */
export type PackageDiagramId = 'architecture' | 'data-flow';

/** Renderer-neutral diagram models behind the package's diagram blocks, keyed by diagram id. */
export function buildPackageDiagrams(session: ScopingSession): Map<PackageDiagramId, DiagramModel> {
  const diagrams = new Map<PackageDiagramId, DiagramModel>();
  const design = session.outputs.architecture.data;
  if (design === null) {
    return diagrams;
  }
  diagrams.set('architecture', buildArchitectureDiagram(design));
  const dataIntegration = session.outputs.dataIntegration.data;
  if (dataIntegration !== null) {
    diagrams.set('data-flow', buildDataFlowDiagram(dataIntegration, design));
  }
  return diagrams;
}

function exportStatusText(session: ScopingSession): string {
  return session.quality === null ? 'Quality gate not run' : session.quality.summary.exportStatus;
}

type SectionBuilder = (session: ScopingSession, diagrams: Map<PackageDiagramId, DiagramModel>) => PackageSection;

/** One builder per `PackageSectionId`; `PACKAGE_SECTION_IDS` order is what `buildPackage` renders in. */
const SECTION_BUILDERS: ReadonlyMap<PackageSectionId, SectionBuilder> = new Map<PackageSectionId, SectionBuilder>([
  ['executive-summary', buildExecutiveSummarySection],
  ['customer-objectives', buildCustomerObjectivesSection],
  ['requirement-summary', buildRequirementSummarySection],
  ['prd', buildPrdSection],
  ['functional-scope', buildFunctionalScopeSection],
  ['solution-architecture', buildSolutionArchitectureSection],
  ['architecture-diagram', (_session, diagrams) => buildArchitectureDiagramSection(diagrams.get('architecture'))],
  ['data-strategy', buildDataStrategySection],
  ['integration-architecture', (session, diagrams) => buildIntegrationArchitectureSection(session, diagrams.get('data-flow'))],
  ['ai-solution-approach', buildAiSolutionSection],
  ['recommended-technologies', buildTechnologiesSection],
  ['delivery-phases', buildDeliveryPhasesSection],
  ['effort-timeline', buildEffortTimelineSection],
  ['rom-commercials', buildRomCommercialsSection],
  ['assumptions', buildAssumptionsSection],
  ['risks', buildRisksSection],
  ['dependencies', buildDependenciesSection],
  ['open-questions', buildOpenQuestionsSection],
  ['requirement-coverage', buildRequirementCoverageSection],
  ['traceability', buildTraceabilityInfoSection],
  ['quality-review', buildQualityReviewSection],
  ['change-log', buildChangeLogSection],
]);

/** Builds every package section, in the spec's fixed `PACKAGE_SECTION_IDS` order. */
function buildSections(session: ScopingSession, diagrams: Map<PackageDiagramId, DiagramModel>): PackageSection[] {
  return PACKAGE_SECTION_IDS.map((id) => {
    const builder = SECTION_BUILDERS.get(id);
    if (builder === undefined) {
      throw new Error(`No section builder registered for package section "${id}".`);
    }
    return builder(session, diagrams);
  });
}

/**
 * Assembles the format-neutral `PackageDocument` (spec 6, "Integrated Scoping Package") from a
 * session: every section is produced independently and a section whose upstream data is missing
 * renders a clear "Not generated yet" callout instead of being dropped, so the package is always
 * complete and always exportable, however early in the workflow the session is.
 */
export function buildPackage(session: ScopingSession, options: PackageBuildOptions): PackageDocument {
  const diagrams = buildPackageDiagrams(session);
  const opportunity = session.customer.opportunityName.trim().length > 0 ? session.customer.opportunityName : session.name;
  const subtitle = session.customer.customerName.trim().length > 0 ? session.customer.customerName : session.name;
  return {
    title: `${opportunity} - Integrated Scoping Package`,
    subtitle,
    generatedAt: options.generatedAt,
    aiModeLabel: options.aiModeLabel,
    exportStatus: exportStatusText(session),
    disclaimer: EXPORT_DISCLAIMER,
    sections: buildSections(session, diagrams),
  };
}
