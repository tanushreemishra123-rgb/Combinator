/** Delivery-phase vocabulary shared by the planner, the semantic validator and the engine. */
import { DELIVERY_PHASES } from '../domain';
import type { DriverType } from '../domain';

/** Phases that carry scope-driven workstreams; PH_1, PH_5 and PH_6 are percentage overheads. */
export const BUILD_PHASE_IDS: readonly string[] = ['PH_2', 'PH_3', 'PH_4'];

const PHASE_NAMES: ReadonlyMap<string, string> = new Map<string, string>(
  DELIVERY_PHASES.map((phase) => [phase.id, phase.name]),
);

const PHASE_BY_DRIVER_TYPE: ReadonlyMap<DriverType, string> = new Map<DriverType, string>([
  ['capability', 'PH_2'],
  ['security', 'PH_2'],
  ['nonFunctional', 'PH_2'],
  ['infrastructure', 'PH_2'],
  ['integration', 'PH_3'],
  ['data', 'PH_3'],
  ['ai', 'PH_4'],
]);

export function phaseName(phaseId: string, fallback: string): string {
  return PHASE_NAMES.get(phaseId) ?? fallback;
}

export function isBuildPhase(phaseId: string): boolean {
  return BUILD_PHASE_IDS.includes(phaseId);
}

/** The build phase a driver of this type is delivered in. */
export function phaseForDriverType(type: DriverType): string {
  return PHASE_BY_DRIVER_TYPE.get(type) ?? 'PH_2';
}

/** Locale-independent ordering of phase ids (PH_1 < PH_2 < ...), so results never depend on the runtime's ICU data. */
export function comparePhaseIds(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
