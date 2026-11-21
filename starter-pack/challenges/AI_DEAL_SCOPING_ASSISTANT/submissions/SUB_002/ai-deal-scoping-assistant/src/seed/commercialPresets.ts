/**
 * Example commercial configurations the Estimate Workspace can apply on top of the default
 * `EstimationConfig` (see `estimationDefaults.ts`). Each preset is a pure function - it never
 * mutates its input - so switching presets is reversible and every number stays reproducible.
 * Rates are illustrative planning values, not a live rate card.
 */
import type { EstimationConfig, RoleRate } from '../domain';
import type { CommercialPreset } from './index';

/** Scales every configured day rate by a factor and rounds to the nearest whole currency unit. */
function scaleRates(rates: readonly RoleRate[], factor: number): RoleRate[] {
  return rates.map((rate) => ({
    ...rate,
    dayRate: rate.dayRate === null ? null : Math.round(rate.dayRate * factor),
  }));
}

/** European delivery: EUR rates run higher than the USD baseline to reflect local cost-to-serve. */
const EUROPE_RATE_MULTIPLIER = 1.12;
const EUROPE_CONTINGENCY_PCT = 18;

/** Crowd-assisted delivery: many contributors working in parallel lowers blended day rates but the
 * coordination and review overhead means each unit of work takes somewhat longer to land cleanly. */
const CROWD_RATE_MULTIPLIER = 0.72;
const CROWD_PRODUCTIVITY_FACTOR = 0.85;
const CROWD_CONTINGENCY_PCT = 20;
const CROWD_TEAM_SIZE = 12;

/** Nearshore delivery: a blended nearshore team at a lower cost base than the USD baseline. */
const NEARSHORE_RATE_MULTIPLIER = 0.68;
const NEARSHORE_CONTINGENCY_PCT = 12;

/** Baseline USD blended-team delivery - the same assumptions `createDefaultEstimationConfig` ships with. */
function applyStandardBlendedUsd(config: EstimationConfig): EstimationConfig {
  return { ...config, currency: 'USD' };
}

/** Onshore-European delivery: EUR currency, higher day rates, extra contingency for local compliance overhead. */
function applyEuropeanDelivery(config: EstimationConfig): EstimationConfig {
  return {
    ...config,
    currency: 'EUR',
    contingencyPct: EUROPE_CONTINGENCY_PCT,
    rates: scaleRates(config.rates, EUROPE_RATE_MULTIPLIER),
  };
}

/** Topcoder crowdsourced-challenge delivery: lower blended rates, reduced productivity factor for
 * challenge-review overhead, a larger effective concurrent team and a higher contingency buffer. */
function applyCrowdAssistedTopcoder(config: EstimationConfig): EstimationConfig {
  return {
    ...config,
    currency: 'USD',
    productivityFactor: CROWD_PRODUCTIVITY_FACTOR,
    contingencyPct: CROWD_CONTINGENCY_PCT,
    teamSize: CROWD_TEAM_SIZE,
    rates: scaleRates(config.rates, CROWD_RATE_MULTIPLIER),
  };
}

/** Nearshore blended delivery: lower cost base than the USD baseline with a lighter contingency
 * buffer, reflecting a mature nearshore delivery centre rather than a crowdsourced model. */
function applyNearshoreDelivery(config: EstimationConfig): EstimationConfig {
  return {
    ...config,
    currency: 'USD',
    contingencyPct: NEARSHORE_CONTINGENCY_PCT,
    rates: scaleRates(config.rates, NEARSHORE_RATE_MULTIPLIER),
  };
}

/** Example commercial configurations shown in the Estimate Workspace's preset picker. */
export const COMMERCIAL_PRESETS: readonly CommercialPreset[] = [
  {
    id: 'standard-blended-usd',
    label: 'Standard blended delivery (USD)',
    description: 'The default onshore/offshore blended team and USD day rates shipped with every new session.',
    apply: applyStandardBlendedUsd,
  },
  {
    id: 'european-delivery-eur',
    label: 'European delivery (EUR, higher rates)',
    description: 'EUR-denominated rates for an EU-based delivery team, with extra contingency for local compliance overhead.',
    apply: applyEuropeanDelivery,
  },
  {
    id: 'crowd-assisted-topcoder',
    label: 'Crowd-assisted Topcoder delivery',
    description: 'Lower blended rates from parallel Topcoder challenges, a reduced productivity factor for review overhead and a larger contingency buffer.',
    apply: applyCrowdAssistedTopcoder,
  },
  {
    id: 'nearshore-delivery-usd',
    label: 'Nearshore blended delivery (USD)',
    description: 'A lower-cost nearshore delivery centre at USD rates below the standard blended baseline.',
    apply: applyNearshoreDelivery,
  },
];
