import { describe, expect, it } from 'vitest';
import { OUTPUT_SECTION_IDS } from '../domain';
import type { ChangeDescriptor, OutputSectionId, ScopeItem } from '../domain';
import { analyzeImpact, NOT_GENERATED_REASON } from './analyzeImpact';
import { buildEmptyOutputsSession, buildRichSession } from './testFixtures.data';
import type { ImpactAnalysis } from './types';

function change(kind: ChangeDescriptor['kind'], targetId: string, from = 'before', to = 'after'): ChangeDescriptor {
  return { kind, targetId, label: `${kind} changed`, from, to };
}

function affectedSections(analysis: ImpactAnalysis): OutputSectionId[] {
  return [...new Set(analysis.affected.map((entry) => entry.section))].sort();
}

function unaffectedSections(analysis: ImpactAnalysis): (OutputSectionId | 'scope')[] {
  return [...new Set(analysis.unaffected.map((entry) => entry.section))].sort();
}

describe('analyzeImpact - config-driven changes', () => {
  it('cloud-platform re-maps architecture, data/integration services, AI hosting and infrastructure; leaves PRD and functional scope untouched', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('cloud-platform', 'cloudPlatform'));
    expect(affectedSections(analysis)).toEqual(['aiStrategy', 'architecture', 'commercials', 'dataIntegration', 'estimate']);
    expect(unaffectedSections(analysis)).toEqual(['functionalScope', 'prd', 'scope']);
    expect(analysis.affected.every((entry) => entry.action === 'regenerate' || (entry.section === 'commercials' && entry.action === 'recalculate'))).toBe(true);
  });

  it('expected-users affects scalability architecture, performance testing and infrastructure effort; leaves personas, workflows and non-volume-bound integrations', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('expected-users', 'expectedUsers'));
    expect(affectedSections(analysis)).toEqual(['architecture', 'commercials', 'estimate']);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'dataIntegration', 'functionalScope', 'prd', 'scope']);
    const dataIntegrationAreas = analysis.unaffected.filter((entry) => entry.section === 'dataIntegration').map((entry) => entry.area);
    expect(dataIntegrationAreas.some((area) => area.includes('not volume-bound'))).toBe(true);
  });

  it('delivery-deadline recalculates the estimate timeline only; architecture and every other section are preserved', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('delivery-deadline', 'deliveryDeadlineWeeks'));
    expect(affectedSections(analysis)).toEqual(['estimate']);
    expect(analysis.affected.at(0)?.action).toBe('recalculate');
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'architecture', 'commercials', 'dataIntegration', 'functionalScope', 'prd', 'scope']);
  });

  it('environments regenerates the environment/deployment plan and infrastructure effort; leaves PRD, scope, data and AI strategy', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('environments', 'environments'));
    expect(affectedSections(analysis)).toEqual(['architecture', 'commercials', 'estimate']);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'dataIntegration', 'functionalScope', 'prd', 'scope']);
  });

  it('target-regions regenerates regional architecture, data residency, AI hosting region and infrastructure effort; leaves PRD and functional scope', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('target-regions', 'targetRegions'));
    expect(affectedSections(analysis)).toEqual(['aiStrategy', 'architecture', 'commercials', 'dataIntegration', 'estimate']);
    expect(unaffectedSections(analysis)).toEqual(['functionalScope', 'prd', 'scope']);
  });

  it('ai-provider-preference regenerates the AI strategy and AI/ML architecture components only', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('ai-provider-preference', 'aiProviderPreference'));
    expect(affectedSections(analysis)).toEqual(['aiStrategy', 'architecture']);
    expect(unaffectedSections(analysis)).toEqual(['commercials', 'dataIntegration', 'estimate', 'functionalScope', 'prd', 'scope']);
  });

  it('productivity recalculates estimate and commercials only; design sections are preserved', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('productivity', 'productivityFactor'));
    expect(affectedSections(analysis)).toEqual(['commercials', 'estimate']);
    expect(analysis.affected.every((entry) => entry.action === 'recalculate')).toBe(true);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'architecture', 'dataIntegration', 'functionalScope', 'prd', 'scope']);
  });
});

describe('analyzeImpact - commercial-only changes (rate-card, contingency, currency)', () => {
  it.each([
    ['rate-card', 'rate-card'],
    ['contingency', 'contingencyPct'],
    ['currency', 'currency'],
  ] as const)('%s only recalculates commercials; every other section, including estimate, is untouched', (kind, targetId) => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change(kind, targetId));
    expect(affectedSections(analysis)).toEqual(['commercials']);
    expect(analysis.affected.at(0)?.action).toBe('recalculate');
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'architecture', 'dataIntegration', 'estimate', 'functionalScope', 'prd', 'scope']);
  });
});

describe('analyzeImpact - complexity overrides', () => {
  it('driver-complexity recalculates only the owning workstream and commercials', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('driver-complexity', 'DRV_01'));
    expect(affectedSections(analysis)).toEqual(['commercials', 'estimate']);
    expect(analysis.affected.every((entry) => entry.action === 'recalculate')).toBe(true);
    expect(analysis.affected.find((entry) => entry.section === 'estimate')?.elementIds).toContain('DRV_01');
  });

  it('integration-complexity recalculates only the owning workstream and commercials', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('integration-complexity', 'DRV_03'));
    expect(affectedSections(analysis)).toEqual(['commercials', 'estimate']);
    expect(analysis.affected.find((entry) => entry.section === 'estimate')?.elementIds).toContain('DRV_03');
  });
});

describe('analyzeImpact - reviewed scope item changes (trace-based)', () => {
  it('requirement-priority affects sequencing (PRD, functional scope, estimate, commercials) but not the technical design', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('requirement-priority', 'FR_02'));
    expect(affectedSections(analysis)).toEqual(['commercials', 'estimate', 'functionalScope', 'prd']);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'architecture', 'dataIntegration', 'scope']);
  });

  it('requirement-text follows real citations of the edited requirement through every deliverable', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('requirement-text', 'FR_01'));
    expect(affectedSections(analysis)).toEqual(['architecture', 'commercials', 'estimate', 'functionalScope', 'prd']);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'dataIntegration', 'scope']);
    const untouched = analysis.unaffected.find((entry) => entry.section === 'dataIntegration');
    expect(untouched?.reason).toContain('FR_01');
  });

  it('security-requirement follows citations of the edited security item', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('security-requirement', 'SEC_01'));
    expect(affectedSections(analysis)).toEqual(['architecture', 'commercials', 'dataIntegration', 'estimate']);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'functionalScope', 'prd', 'scope']);
  });

  it('scope-inclusion on an existing, in-scope item follows its citations and flags sections of its kind that still cite nothing', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('scope-inclusion', 'DATA_01'));
    // architecture, dataIntegration, estimate and commercials already cite DATA_01 (trace match); PRD is
    // expected to cover data items but no PRD statement or journey cites it yet, so it is also flagged.
    expect(affectedSections(analysis)).toEqual(['architecture', 'commercials', 'dataIntegration', 'estimate', 'prd']);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'functionalScope', 'scope']);
    const prdEntry = analysis.affected.find((entry) => entry.section === 'prd');
    expect(prdEntry?.reason).toContain('now in scope');
  });

  it('scope-inclusion on a newly added, not-yet-cited requirement extends every section expected to cover its kind', () => {
    const session = buildRichSession();
    const newItem: ScopeItem = {
      id: 'FR_99',
      kind: 'functional',
      title: 'Bulk policy export',
      description: 'Members export all policy documents as a single archive.',
      priority: 'Medium',
      provenance: 'customer-stated',
      source: null,
      relatedIds: [],
      affectsInputs: [],
      critical: false,
      signals: [],
      review: 'approved',
      inScope: true,
      userEdited: false,
      resolved: false,
      resolution: '',
    };
    const scope = { ...session.scope!, items: [...session.scope!.items, newItem] };
    const analysis = analyzeImpact({ ...session, scope }, change('scope-inclusion', 'FR_99', 'Not in the scope model', 'In scope'));
    expect(affectedSections(analysis)).toEqual(['architecture', 'commercials', 'estimate', 'functionalScope', 'prd']);
    expect(analysis.affected.every((entry) => entry.elementIds.includes('FR_99'))).toBe(true);
    expect(analysis.affected.every((entry) => entry.reason.includes('now in scope'))).toBe(true);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'dataIntegration', 'scope']);
  });

  it('assumption changes follow both the assumption and the requirement linked to it', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('assumption', 'ASM_01'));
    expect(affectedSections(analysis)).toEqual(['aiStrategy', 'architecture', 'commercials', 'estimate', 'prd']);
    expect(unaffectedSections(analysis)).toEqual(['dataIntegration', 'functionalScope', 'scope']);
  });

  it('question-resolved follows the linked requirement when one cites it', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('question-resolved', 'Q_01'));
    expect(affectedSections(analysis)).toEqual(['architecture', 'commercials', 'estimate', 'functionalScope', 'prd']);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'dataIntegration', 'scope']);
  });

  it('question-resolved reports every section unaffected, with a reason, when nothing cites the question or its linked item', () => {
    const session = buildRichSession();
    const analysis = analyzeImpact(session, change('question-resolved', 'Q_02'));
    expect(analysis.affected).toEqual([]);
    expect(unaffectedSections(analysis)).toEqual(['aiStrategy', 'architecture', 'commercials', 'dataIntegration', 'estimate', 'functionalScope', 'prd', 'scope']);
    expect(analysis.unaffected.every((entry) => entry.reason.length > 0)).toBe(true);
    expect(analysis.unaffected.some((entry) => entry.reason.includes('Q_02'))).toBe(true);
  });
});

describe('analyzeImpact - ungenerated sections', () => {
  it('reports every output section as unaffected with "Not generated yet" when nothing has been generated', () => {
    const session = buildEmptyOutputsSession();
    const analysis = analyzeImpact(session, change('cloud-platform', 'cloudPlatform'));
    expect(analysis.affected).toEqual([]);
    for (const section of OUTPUT_SECTION_IDS) {
      const entry = analysis.unaffected.find((candidate) => candidate.section === section);
      expect(entry?.reason).toBe(NOT_GENERATED_REASON);
    }
  });

  it('never throws for a change kind with no rule entry', () => {
    const session = buildRichSession();
    expect(() => analyzeImpact(session, { kind: 'requirement-priority', targetId: 'UNKNOWN_ID', label: 'x', from: 'a', to: 'b' })).not.toThrow();
  });
});
