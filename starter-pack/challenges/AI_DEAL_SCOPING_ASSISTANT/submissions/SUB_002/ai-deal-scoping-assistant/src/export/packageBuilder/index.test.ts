import { PACKAGE_SECTION_IDS } from '../../domain';
import { createSession } from '../../domain';
import { createDefaultEstimationConfig, createDefaultSolutionConfig } from '../../seed';
import { fixtureSession } from '../../test/fixtures';
import { toMarkdown } from '../markdown';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildPackage, buildPackageDiagrams } from './index';

const OPTIONS = { aiModeLabel: 'Mock AI mode', generatedAt: '2026-09-19T00:00:00.000Z' };

describe('buildPackage', () => {
  it('produces every package section, in PACKAGE_SECTION_IDS order', () => {
    const doc = buildPackage(fixtureSession(), OPTIONS);
    expect(doc.sections.map((section) => section.id)).toEqual([...PACKAGE_SECTION_IDS]);
    expect(doc.sections.every((section) => section.blocks.length > 0)).toBe(true);
  });

  it('never throws for a brand-new, empty session and states what is missing', () => {
    const empty = createSession({ id: 'session-empty', name: 'Empty session', now: '2026-09-19T00:00:00.000Z', config: createDefaultSolutionConfig(), estimationConfig: createDefaultEstimationConfig() });
    const doc = buildPackage(empty, OPTIONS);
    expect(doc.sections).toHaveLength(PACKAGE_SECTION_IDS.length);
    const prdSection = doc.sections.find((section) => section.id === 'prd');
    expect(prdSection?.blocks.some((block) => block.type === 'callout' && block.title === 'Not generated yet')).toBe(true);
    const qualitySection = doc.sections.find((section) => section.id === 'quality-review');
    expect(qualitySection?.blocks.some((block) => block.type === 'callout' && block.title === 'Quality gate has not been run')).toBe(true);
  });

  it('carries the export status from the quality gate, or "Quality gate not run" when it has not run', () => {
    const empty = createSession({ id: 'session-empty-2', name: 'Empty session', now: '2026-09-19T00:00:00.000Z', config: createDefaultSolutionConfig(), estimationConfig: createDefaultEstimationConfig() });
    expect(buildPackage(empty, OPTIONS).exportStatus).toBe('Quality gate not run');
    const populated = buildFullyPopulatedSession();
    expect(buildPackage(populated, OPTIONS).exportStatus).toBe(populated.quality?.summary.exportStatus);
  });

  it('never renders undefined, null, NaN or [object Object] in the Markdown export of a fully populated session', () => {
    const doc = buildPackage(buildFullyPopulatedSession(), OPTIONS);
    const markdown = toMarkdown(doc);
    expect(markdown).not.toMatch(/undefined|\bnull\b|NaN|\[object/);
  });

  it('includes the mandatory disclaimer statement', () => {
    const doc = buildPackage(fixtureSession(), OPTIONS);
    expect(doc.disclaimer.length).toBeGreaterThan(0);
    expect(doc.disclaimer).toContain('AI-assisted internal planning output');
  });
});

describe('buildPackageDiagrams', () => {
  it('returns no diagrams before the architecture has been generated', () => {
    expect(buildPackageDiagrams(fixtureSession()).size).toBe(0);
  });

  it('builds the architecture diagram, and the data-flow diagram once data integration is also generated', () => {
    const diagrams = buildPackageDiagrams(buildFullyPopulatedSession());
    expect(diagrams.get('architecture')?.nodes.length).toBeGreaterThan(0);
    expect(diagrams.get('data-flow')?.nodes.length).toBeGreaterThan(0);
  });
});
