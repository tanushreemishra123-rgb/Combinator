const DATE_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })

/** Backend timestamps are ISO strings; an invalid one must not crash a list. */
export function formatDateTime(value: string | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME.format(date)
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
