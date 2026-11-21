/** Display vocabulary for output sections, in the wording of the challenge specification. */
import type { OutputSectionId } from '../domain';

interface SectionVocabulary {
  label: string;
  /** Noun used in 'No <noun> cites FR_02'. */
  elementNoun: string;
}

const SECTION_VOCABULARY: ReadonlyMap<OutputSectionId, SectionVocabulary> = new Map([
  ['prd', { label: 'PRD', elementNoun: 'PRD section or user journey' }],
  ['functionalScope', { label: 'Functional scope', elementNoun: 'capability' }],
  ['architecture', { label: 'Solution architecture', elementNoun: 'architecture component' }],
  ['dataIntegration', { label: 'Data and integration strategy', elementNoun: 'data domain, data topic or integration' }],
  ['aiStrategy', { label: 'AI solution approach', elementNoun: 'AI use case or framework' }],
  ['estimate', { label: 'Effort and timeline estimate', elementNoun: 'workstream or estimate driver' }],
  ['commercials', { label: 'ROM commercials', elementNoun: 'priced workstream' }],
]);

const SCOPE_MODEL_LABEL = 'Reviewed scope model';

export function sectionLabel(section: OutputSectionId | 'scope'): string {
  return section === 'scope' ? SCOPE_MODEL_LABEL : (SECTION_VOCABULARY.get(section)?.label ?? section);
}

export function elementNoun(section: OutputSectionId): string {
  return SECTION_VOCABULARY.get(section)?.elementNoun ?? 'generated element';
}
