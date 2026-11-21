import type { ReactNode } from "react"
import { cn } from "cn"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface DataTableColumn<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[]
  rows: readonly T[]
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  caption?: string
  emptyMessage?: string
  /** Tighter rows for long, scannable lists. */
  dense?: boolean
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  caption,
  emptyMessage = "Nothing to show yet.",
  dense = false,
}: DataTableProps<T>) {
  return (
    <Table>
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.id} className={column.className}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow
              key={getRowId(row)}
              // Rows stay keyboard-reachable when the whole row is the control.
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onRowClick(row)
                      }
                    }
                  : undefined
              }
              className={cn(onRowClick && "cursor-pointer", dense && "[&>td]:py-1.5")}
            >
              {columns.map((column) => (
                <TableCell key={column.id} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
