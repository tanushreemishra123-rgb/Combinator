import { BlockView } from "@/components/package/BlockView"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { formatDateTime } from "@/lib/format"
import type { Diagrams, DocumentModel } from "@/api/types"

interface PackagePreviewProps {
  document: DocumentModel
  diagrams: Diagrams | undefined
}

/** The same model the export renders, with the required disclaimer at both ends. */
export function PackagePreview({ document, diagrams }: PackagePreviewProps) {
  const disclaimer = (
    <Alert>
      <AlertDescription>{document.disclaimer}</AlertDescription>
    </Alert>
  )

  return (
    <article className="flex flex-col gap-6">
      {disclaimer}
      <header className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-medium tracking-tight">{document.title}</h2>
        <p className="text-sm text-muted-foreground">{document.subtitle}</p>
        <p className="text-xs text-muted-foreground">
          Generated {formatDateTime(document.generated_at)}
        </p>
      </header>
      {document.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-3">
          <h3 className="font-heading text-base font-medium tracking-tight">{section.title}</h3>
          {section.blocks.map((block, index) => (
            <BlockView key={`${section.id}-${index}`} block={block} diagrams={diagrams} />
          ))}
          <Separator />
        </section>
      ))}
      {disclaimer}
    </article>
  )
}
