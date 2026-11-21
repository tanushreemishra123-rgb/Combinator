/** Unit tests for the stage-status view model: gating, busy detection and the reviewed pill. */
import type { SectionState } from '../../domain';
import { buildStageView } from './stageInfo';
import { fixtureGenerationMeta } from './strategyFixtures';

function emptySection(): SectionState<unknown> {
  return { data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [] };
}

describe('buildStageView', () => {
  it('cannot generate while a prerequisite message is present', () => {
    const view = buildStageView(emptySection(), 'dataIntegration', 'Generate the solution architecture before planning the data flow.', null);
    expect(view.canGenerate).toBe(false);
    expect(view.prerequisite).toBe('Generate the solution architecture before planning the data flow.');
  });

  it('can generate once the prerequisite is met and nothing else is busy', () => {
    const view = buildStageView(emptySection(), 'dataIntegration', null, null);
    expect(view.canGenerate).toBe(true);
    expect(view.isBusy).toBe(false);
  });

  it('is busy only when the global busy state names this exact stage, and blocks generation only for the other stage', () => {
    const busyHere = buildStageView(emptySection(), 'dataIntegration', null, { label: 'Planning...', stageId: 'dataIntegration' });
    const busyElsewhere = buildStageView(emptySection(), 'dataIntegration', null, { label: 'Selecting AI approach...', stageId: 'aiStrategy' });

    // Busy on its own stage still reports canGenerate=true - the Button component's own `busy` prop
    // (driven by isBusy) is what disables it and shows the spinner; canGenerate only gates being
    // blocked by *other* work in flight.
    expect(busyHere.isBusy).toBe(true);
    expect(busyHere.canGenerate).toBe(true);
    expect(busyElsewhere.isBusy).toBe(false);
    expect(busyElsewhere.canGenerate).toBe(false);
  });

  it('shows a reviewed pill only once the section is current and marked reviewed', () => {
    const current: SectionState<unknown> = { data: {}, status: 'current', reviewed: true, meta: fixtureGenerationMeta(), staleReasons: [] };
    const view = buildStageView(current, 'aiStrategy', null, null);
    expect(view.pillStatus).toBe('reviewed');
  });

  it('keeps the raw status as the pill when current but not yet reviewed', () => {
    const current: SectionState<unknown> = { data: {}, status: 'current', reviewed: false, meta: fixtureGenerationMeta(), staleReasons: [] };
    const view = buildStageView(current, 'aiStrategy', null, null);
    expect(view.pillStatus).toBe('current');
  });

  it('carries stale reasons through untouched', () => {
    const stale: SectionState<unknown> = {
      data: {},
      status: 'stale',
      reviewed: true,
      meta: fixtureGenerationMeta(),
      staleReasons: ['Requirement FR_03 changed after this section was generated.'],
    };
    const view = buildStageView(stale, 'aiStrategy', null, null);
    expect(view.status).toBe('stale');
    expect(view.staleReasons).toEqual(['Requirement FR_03 changed after this section was generated.']);
  });
});
