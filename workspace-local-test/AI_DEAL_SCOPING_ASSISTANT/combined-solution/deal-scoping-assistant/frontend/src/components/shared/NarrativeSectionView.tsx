import { BasisBadge } from "@/components/shared/BasisBadge"
import { IdList } from "@/components/shared/IdList"
import { ValidationBadge } from "@/components/shared/ValidationBadge"
import type { NarrativeSection } from "@/api/types"

interface NarrativeSectionViewProps {
  title: string
  section: NarrativeSection
  onSelectId?: (id: string) => void
  /** Cloud service names behind the section's architecture components. */
  services?: readonly string[]
}

/** A prose section of a strategy document, with what it rests on. */
export function NarrativeSectionView({
  title,
  section,
  onSelectId,
  services,
}: NarrativeSectionViewProps) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-heading text-sm font-medium tracking-tight">{title}</h3>
        <BasisBadge basis={section.basis} />
        {section.validation_required ? (
          <ValidationBadge reason={section.validation_reason} />
        ) : null}
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{section.text}</p>
      {services && services.length > 0 ? (
        <p className="text-xs text-muted-foreground">Runs on: {services.join(", ")}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-3">
        <IdList ids={section.req_ids} label={`${title} requirements`} onSelect={onSelectId} />
        <IdList ids={section.arc_ids} label={`${title} components`} onSelect={onSelectId} />
      </div>
    </section>
  )
}
