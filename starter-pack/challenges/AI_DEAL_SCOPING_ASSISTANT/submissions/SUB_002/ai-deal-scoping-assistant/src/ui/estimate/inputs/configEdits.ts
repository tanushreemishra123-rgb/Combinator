/**
 * Pure builders for the two editable configuration tables (base effort, phase overheads): each
 * returns a whole new array with just the touched cell replaced, ready to pass to
 * `updateEstimationConfig`. Kept separate from the table components so the edit rule is
 * unit-testable without rendering anything.
 */
import type { BaseEffortRow, Complexity, DriverType, PhaseOverhead } from '../../../domain';

/** Replaces one person-days cell (driver type x complexity) in the base-effort table. */
export function withBaseEffortValue(rows: readonly BaseEffortRow[], driverType: DriverType, complexity: Complexity, value: number): BaseEffortRow[] {
  return rows.map((row) =>
    row.driverType === driverType
      ? { ...row, days: row.days.map((cell) => (cell.complexity === complexity ? { ...cell, value } : cell)) }
      : row,
  );
}

/** Replaces one phase's overhead percentage of build effort. */
export function withPhaseOverheadPct(rows: readonly PhaseOverhead[], phaseId: string, pctOfBuild: number): PhaseOverhead[] {
  return rows.map((row) => (row.phaseId === phaseId ? { ...row, pctOfBuild } : row));
}
