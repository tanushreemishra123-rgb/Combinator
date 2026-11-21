import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildAssumptionsSection, buildDependenciesSection, buildOpenQuestionsSection, buildRisksSection } from './notes';

describe('buildAssumptionsSection / buildRisksSection / buildDependenciesSection / buildOpenQuestionsSection', () => {
  it('say no requirements have been analysed yet when there is no scope', () => {
    const session = { ...fixtureSession(), scope: null };
    for (const builder of [buildAssumptionsSection, buildRisksSection, buildDependenciesSection, buildOpenQuestionsSection]) {
      expect(builder(session).blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
    }
  });

  it('lists the scope-model assumption items with their validation status', () => {
    const section = buildAssumptionsSection(fixtureSession());
    const table = section.blocks.at(0);
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      expect(table.rows.some((row) => row.at(0) === 'ASM_01' && row.at(2) === 'Needs validation')).toBe(true);
    }
  });

  it('lists open questions with Answered/Open status and the resolution text when answered', () => {
    const session = fixtureSession();
    const scope = session.scope;
    if (scope === null) {
      throw new Error('expected a scope model');
    }
    const answered = { ...scope, items: scope.items.map((item) => (item.id === 'Q_01' ? { ...item, resolved: true, resolution: 'Azure AD B2C.' } : item)) };
    const section = buildOpenQuestionsSection({ ...session, scope: answered });
    const table = section.blocks.find((block) => block.type === 'table');
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      const row = table.rows.find((candidate) => candidate.at(0) === 'Q_01');
      expect(row?.at(2)).toBe('Answered');
      expect(row?.at(1)).toContain('Azure AD B2C.');
      expect(table.rows.some((candidate) => candidate.at(0) === 'Q_02' && candidate.at(2) === 'Open')).toBe(true);
    }
  });

  it('defines every missing-information item next to the questions, with the estimation inputs it affects', () => {
    const section = buildOpenQuestionsSection(fixtureSession());
    const headings = section.blocks.filter((block) => block.type === 'heading').map((block) => (block.type === 'heading' ? block.text : ''));
    expect(headings).toEqual(['Clarification questions for the customer', 'Missing information']);
    const gaps = section.blocks.filter((block) => block.type === 'table').at(1);
    expect(gaps?.type).toBe('table');
    if (gaps?.type === 'table') {
      expect(gaps.rows).toEqual([['GAP_01', 'CRM API readiness unknown: The readiness and limits of the Salesforce APIs are not stated.', 'Yes', 'Integration readiness', 'Open', 'None']]);
    }
  });

  it('appends the estimate\'s own risk/dependency/assumption notes as extra rows', () => {
    const populated = buildFullyPopulatedSession();
    const risks = buildRisksSection(populated);
    const table = risks.blocks.at(0);
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      expect(table.rows.some((row) => row.at(2) === 'Estimation note')).toBe(true);
    }
  });
});
