/**
 * "ROM commercials" package section (spec 6): rate card, role allocation, subtotal, contingency,
 * ROM range and currency - or an explicit blocked callout naming the missing rates.
 */
import type { EstimateResult, PackageSection, RoleAllocation, RoleRate, ScopingSession } from '../../domain';
import { formatMoney } from '../../estimation';
import { headingBlock, joinOrFallback, moneyRangeOrBlocked, notGeneratedCallout, provenanceBlock, tableOrParagraph } from '../text';

function rateRow(rate: RoleRate, currency: string): string[] {
  return [rate.label, rate.dayRate === null ? 'Not provided' : formatMoney(rate.dayRate, currency)];
}

function allocationRow(allocation: RoleAllocation, currency: string): string[] {
  return [
    allocation.label,
    allocation.days.toFixed(1),
    allocation.dayRate === null ? 'Not provided' : formatMoney(allocation.dayRate, currency),
    allocation.cost === null ? 'Blocked - rate not provided' : formatMoney(allocation.cost, currency),
  ];
}

function blockedRatesCallout(result: EstimateResult) {
  const blocked = result.missingInputs.filter((missing) => missing.key === 'roleRate').map((missing) => missing.label);
  const labels = joinOrFallback(blocked, 'one or more delivery roles');
  return {
    type: 'callout' as const,
    tone: 'danger' as const,
    title: 'ROM commercials blocked',
    text: `The ROM commercial range cannot be calculated until day rates are provided for: ${labels}.`,
  };
}

export function buildRomCommercialsSection(session: ScopingSession): PackageSection {
  const result = session.outputs.estimate.data?.result ?? null;
  if (result === null) {
    return { id: 'rom-commercials', title: 'ROM commercials', blocks: [notGeneratedCallout('the ROM commercial estimate has not been generated yet')] };
  }
  const provenance = provenanceBlock(session.outputs.estimate.meta);
  const currency = result.configSnapshot.currency;
  const commercialBases = [...new Set(result.workstreams.map((workstream) => workstream.commercialBasis).filter((basis) => basis.trim().length > 0))];

  return {
    id: 'rom-commercials',
    title: 'ROM commercials',
    blocks: [
      ...(provenance === null ? [] : [provenance]),
      { type: 'keyValues', pairs: [{ key: 'Currency', value: currency }, { key: 'Commercial basis', value: joinOrFallback(commercialBases, 'Not yet defined') }] },
      headingBlock(3, 'Rate card'),
      tableOrParagraph(['Role', 'Day rate'], result.configSnapshot.rates.map((rate) => rateRow(rate, currency)), 'No rate card was configured.'),
      headingBlock(3, 'Role allocation'),
      tableOrParagraph(['Role', 'Days', 'Day rate', 'Cost'], result.roleSummary.map((allocation) => allocationRow(allocation, currency)), 'No role allocation was calculated.'),
      headingBlock(3, 'Totals'),
      {
        type: 'keyValues',
        pairs: [
          { key: 'Subtotal', value: moneyRangeOrBlocked(result.totals.subtotal, 'Blocked - see below') },
          { key: 'Contingency', value: moneyRangeOrBlocked(result.totals.contingency, 'Blocked - see below') },
          { key: 'ROM range', value: moneyRangeOrBlocked(result.totals.rom, 'Blocked - see below') },
        ],
      },
      ...(result.totals.rom === null ? [blockedRatesCallout(result)] : []),
    ],
  };
}
