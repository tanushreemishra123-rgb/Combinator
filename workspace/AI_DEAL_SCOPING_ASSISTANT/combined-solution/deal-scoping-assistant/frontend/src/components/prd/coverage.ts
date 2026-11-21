import type { CoverageColumn, CoverageReport } from "@/api/types"

/** The matrix columns the API actually returned, in the order it returned them. */
export function coverageColumns(report: CoverageReport | undefined): CoverageColumn[] {
  const columns: CoverageColumn[] = []
  for (const row of report?.rows ?? []) {
    for (const cell of row.cells ?? []) {
      if (!columns.includes(cell.column)) columns.push(cell.column)
    }
  }
  return columns
}
