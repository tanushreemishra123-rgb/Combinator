import { COMMERCIAL_PRESETS } from '.';
import { createDefaultEstimationConfig } from './estimationDefaults';

describe('commercial presets', () => {
  it('ships at least three example configurations', () => {
    expect(COMMERCIAL_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it('gives every preset a unique id and non-empty label/description', () => {
    const ids = COMMERCIAL_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of COMMERCIAL_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps every role-mix row summing to 100% after applying each preset', () => {
    for (const preset of COMMERCIAL_PRESETS) {
      const applied = preset.apply(createDefaultEstimationConfig());
      for (const row of applied.roleMix) {
        const total = row.shares.reduce((sum, share) => sum + share.pct, 0);
        expect(total).toBe(100);
      }
    }
  });

  it('never produces a negative or zero day rate after applying a preset', () => {
    for (const preset of COMMERCIAL_PRESETS) {
      const applied = preset.apply(createDefaultEstimationConfig());
      for (const rate of applied.rates) {
        if (rate.dayRate === null) continue;
        expect(rate.dayRate).toBeGreaterThan(0);
      }
    }
  });

  it('is a pure function that never mutates the config it is given', () => {
    for (const preset of COMMERCIAL_PRESETS) {
      const original = createDefaultEstimationConfig();
      const snapshot = JSON.stringify(original);
      preset.apply(original);
      expect(JSON.stringify(original)).toBe(snapshot);
    }
  });

  it('keeps contingency and productivity factors within a sane planning range', () => {
    for (const preset of COMMERCIAL_PRESETS) {
      const applied = preset.apply(createDefaultEstimationConfig());
      expect(applied.contingencyPct).toBeGreaterThan(0);
      expect(applied.contingencyPct).toBeLessThan(50);
      expect(applied.productivityFactor).toBeGreaterThan(0);
    }
  });
});
