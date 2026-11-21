import { describe, expect, it } from 'vitest';
import { emptySection } from '../domain';
import { collectSectionElements, generatedSections, stageState } from './sectionElements';
import { buildOutputs, buildRichSession } from './testFixtures.data';

describe('collectSectionElements', () => {
  it('flattens every generated deliverable into one element list with the ids each element cites', () => {
    const elements = collectSectionElements(buildOutputs());
    const byId = new Map(elements.map((element) => [element.id, element]));
    expect(byId.get('CAP_01')?.refs).toEqual(['FR_01']);
    expect(byId.get('ARC_02')?.refs).toEqual(['NFR_02']);
    expect(byId.get('IF_01')?.refs).toEqual(['INT_01']);
    expect(byId.get('AIUC_01')?.refs).toEqual(['FR_03']);
    // A workstream also cites its own drivers, so a change reaching a driver reaches the workstream too.
    expect(byId.get('WS_02')?.refs).toEqual(expect.arrayContaining(['INT_01', 'DATA_01', 'DRV_03', 'DRV_04']));
  });

  it('tags architecture components and environments with facets used by the impact rule table', () => {
    const elements = collectSectionElements(buildOutputs());
    const cache = elements.find((element) => element.id === 'ARC_02');
    expect(cache?.facets).toEqual(expect.arrayContaining(['area:data-storage', 'logical:cache']));
    const environment = elements.find((element) => element.display === 'the "Production" environment');
    expect(environment?.facets).toContain('area:environments');
  });

  it('skips every section whose data is null', () => {
    const elements = collectSectionElements({ prd: emptySection(), architecture: emptySection(), dataIntegration: emptySection(), aiStrategy: emptySection(), estimate: emptySection() });
    expect(elements).toEqual([]);
  });
});

describe('stageState', () => {
  it('returns the matching output section for every stage id', () => {
    const outputs = buildOutputs();
    expect(stageState(outputs, 'prd')).toBe(outputs.prd);
    expect(stageState(outputs, 'architecture')).toBe(outputs.architecture);
    expect(stageState(outputs, 'dataIntegration')).toBe(outputs.dataIntegration);
    expect(stageState(outputs, 'aiStrategy')).toBe(outputs.aiStrategy);
    expect(stageState(outputs, 'estimate')).toBe(outputs.estimate);
  });
});

describe('generatedSections', () => {
  it('lists every output section owned by a stage that has produced data', () => {
    const sections = generatedSections(buildRichSession().outputs);
    expect([...sections].sort()).toEqual(['aiStrategy', 'architecture', 'commercials', 'dataIntegration', 'estimate', 'functionalScope', 'prd']);
  });

  it('excludes sections owned by a stage that has not generated anything yet', () => {
    const outputs = buildOutputs({ aiStrategy: emptySection() });
    const sections = generatedSections(outputs);
    expect(sections.has('aiStrategy')).toBe(false);
    expect(sections.has('architecture')).toBe(true);
  });
});
