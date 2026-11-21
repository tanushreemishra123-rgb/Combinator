import { HISTORICAL_PROJECTS } from '.';

describe('historical project references', () => {
  it('ships between six and eight illustrative references', () => {
    expect(HISTORICAL_PROJECTS.length).toBeGreaterThanOrEqual(6);
    expect(HISTORICAL_PROJECTS.length).toBeLessThanOrEqual(8);
  });

  it('gives every reference a unique id and plausible, non-zero figures', () => {
    const ids = HISTORICAL_PROJECTS.map((project) => project.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const project of HISTORICAL_PROJECTS) {
      expect(project.name.length).toBeGreaterThan(0);
      expect(project.summary.length).toBeGreaterThan(40);
      expect(project.durationWeeks).toBeGreaterThan(0);
      expect(project.effortPersonWeeks).toBeGreaterThan(0);
      expect(project.deliveryModel.length).toBeGreaterThan(0);
    }
  });

  it('never contains filler placeholder text', () => {
    const text = HISTORICAL_PROJECTS.map((project) => `${project.name} ${project.summary}`).join(' ').toLowerCase();
    for (const forbidden of ['lorem', 'acme', 'tbd-placeholder']) {
      expect(text.includes(forbidden)).toBe(false);
    }
  });
});
