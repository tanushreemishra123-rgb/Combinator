import { cn } from "cn"
import { DiagramView } from "@/components/shared/DiagramView"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Diagrams, PackageBlock } from "@/api/types"

const SHORT_CELL = 12

interface BlockViewProps {
  block: PackageBlock
  diagrams: Diagrams | undefined
}

/** The package's image blocks name one of two diagrams; the preview renders the live one. */
function diagramSource(imageRef: string, diagrams: Diagrams | undefined): string {
  switch (imageRef) {
    case "architecture_diagram":
      return diagrams?.architecture_mermaid ?? ""
    case "integration_diagram":
      return diagrams?.integration_mermaid ?? ""
    default:
      return ""
  }
}

export function BlockView({ block, diagrams }: BlockViewProps) {
  if (block.type === "heading") {
    // Sub-headings inside a section get air above them, so a reader sees where a group starts.
    const Tag = block.level <= 2 ? "h3" : "h4"
    return (
      <Tag className="mt-3 border-l-2 border-primary pl-2 font-heading text-sm font-semibold tracking-tight">
        {block.text}
      </Tag>
    )
  }
  if (block.type === "paragraph") {
    return <p className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap">{block.text}</p>
  }
  if (block.type === "bullet_list") {
    return (
      <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm">
        {block.items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    )
  }
  if (block.type === "table") {
    return (
      // Framed with a shaded header, so one table does not run into the next one; cells
      // wrap, since a reader scans the package and sideways scrolling is worse than tall rows.
      <div className="overflow-x-auto rounded-lg border">
        <Table className="table-auto">
          <TableHeader className="bg-muted/60">
            <TableRow>
              {block.headers.map((header) => (
                <TableHead key={header} className="h-auto py-2 align-bottom whitespace-normal">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.rows.map((row, rowIndex) => (
              <TableRow key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={`cell-${cellIndex}`}
                    // Short values such as ids stay whole; long text wraps rather than scrolls.
                    className={cn(
                      "max-w-[48ch] align-top",
                      cell.length > SHORT_CELL ? "wrap-anywhere whitespace-normal" : "",
                    )}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }
  if (block.type === "image") {
    const source = diagramSource(block.image_ref, diagrams)
    if (source) return <DiagramView source={source} title={block.text || "Diagram"} />
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        {block.text || "Diagram"} — not generated yet.
      </p>
    )
  }
  // Mermaid source is the Markdown form of a diagram; the image block that follows it
  // draws the picture, so the source is not shown a second time.
  if (block.language === "mermaid") return null
  return (
    <pre className="overflow-x-auto rounded-lg border p-3 text-xs">
      <code>{block.text}</code>
    </pre>
  )
}
