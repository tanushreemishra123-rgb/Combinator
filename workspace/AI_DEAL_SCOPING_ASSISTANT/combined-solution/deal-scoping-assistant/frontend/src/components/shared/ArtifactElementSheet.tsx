import { Link } from "react-router"
import { ArrowRightIcon } from "lucide-react"
import { BasisBadge } from "@/components/shared/BasisBadge"
import { IdList } from "@/components/shared/IdList"
import { KeyValueList } from "@/components/shared/KeyValueList"
import { ValidationBadge } from "@/components/shared/ValidationBadge"
import type { ArtifactElement } from "@/components/shared/artifactElements"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface ArtifactElementSheetProps {
  sessionId: string
  element: ArtifactElement | undefined
  onOpenChange: (open: boolean) => void
  onSelectId?: (id: string) => void
}

/** A generated element (component, capability, integration...) opened from its id badge. */
export function ArtifactElementSheet({
  sessionId,
  element,
  onOpenChange,
  onSelectId,
}: ArtifactElementSheetProps) {
  return (
    <Sheet open={Boolean(element)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {element ? (
          <>
            <SheetHeader>
              <SheetTitle>
                {element.id} — {element.name}
              </SheetTitle>
              <SheetDescription>Generated in the {element.source.toLowerCase()}.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <BasisBadge basis={element.element.basis} />
                {element.element.validation_required ? (
                  <ValidationBadge reason={element.element.validation_reason} />
                ) : null}
              </div>
              {element.description ? (
                <p className="text-sm leading-relaxed">{element.description}</p>
              ) : null}
              {element.facts.length > 0 ? <KeyValueList items={element.facts} /> : null}
              <IdList
                ids={element.linkedIds}
                label={`${element.id} references`}
                onSelect={onSelectId}
              />
              <Button asChild variant="outline" className="self-start">
                <Link
                  to={`/sessions/${sessionId}/${element.workspace}`}
                  onClick={() => onOpenChange(false)}
                >
                  Open the {element.source.toLowerCase()}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
