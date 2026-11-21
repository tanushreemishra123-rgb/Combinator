/**
 * "Recommended technologies and frameworks" package section (spec 6): AI frameworks with rationale,
 * plus the concrete cloud services the solution architecture actually selected.
 */
import type { ArchitectureComponent, FrameworkRecommendation, PackageSection, ScopingSession } from '../../domain';
import { joinSentences, notGeneratedCallout, provenanceBlock, refsCell, tableOrParagraph, headingBlock } from '../text';

const FRAMEWORK_COLUMNS = ['Framework', 'Category', 'Rationale', 'Requirements', 'Alternatives considered'] as const;

const CATEGORY_TEXT: ReadonlyMap<FrameworkRecommendation['category'], string> = new Map([
  ['orchestration', 'Orchestration'],
  ['model-service', 'Model service'],
  ['retrieval', 'Retrieval'],
  ['evaluation', 'Evaluation'],
  ['guardrails', 'Guardrails'],
  ['sdk', 'SDK'],
]);

function frameworkRow(framework: FrameworkRecommendation): string[] {
  return [framework.name, CATEGORY_TEXT.get(framework.category) ?? framework.category, framework.rationale, refsCell(framework.requirementIds), joinSentences(framework.alternatives, 'None recorded')];
}

/** Presentable form of an architecture area id, e.g. 'ai-ml' -> 'Ai ml'. Cosmetic only. */
function areaLabel(area: string): string {
  const words = area.split('-');
  const capitalised = words.map((word) => (word.length === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`));
  return capitalised.join(' ');
}

function serviceRow(component: ArchitectureComponent): string[] {
  return [component.service, component.name, areaLabel(component.area), component.purpose];
}

export function buildTechnologiesSection(session: ScopingSession): PackageSection {
  const strategy = session.outputs.aiStrategy.data;
  const design = session.outputs.architecture.data;
  if (strategy === null && design === null) {
    return { id: 'recommended-technologies', title: 'Recommended technologies and frameworks', blocks: [notGeneratedCallout('neither the AI strategy nor the solution architecture has been generated yet')] };
  }
  const frameworkProvenance = strategy === null ? null : provenanceBlock(session.outputs.aiStrategy.meta);
  const frameworkBlocks =
    strategy === null
      ? [notGeneratedCallout('the AI strategy has not been generated yet, so no framework recommendations are available')]
      : [...(frameworkProvenance === null ? [] : [frameworkProvenance]), tableOrParagraph([...FRAMEWORK_COLUMNS], strategy.frameworks.map(frameworkRow), 'No AI frameworks were recommended for this engagement.')];
  const serviceBlocks =
    design === null
      ? [notGeneratedCallout('the solution architecture has not been generated yet, so no selected cloud services are available')]
      : [tableOrParagraph(['Service', 'Component', 'Area', 'Purpose'], design.components.map(serviceRow), 'No cloud services have been selected yet.')];
  return {
    id: 'recommended-technologies',
    title: 'Recommended technologies and frameworks',
    blocks: [headingBlock(3, 'Frameworks'), ...frameworkBlocks, headingBlock(3, 'Selected cloud services'), ...serviceBlocks],
  };
}
