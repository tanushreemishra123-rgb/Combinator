import { ScopeItemSheet } from "@/components/requirements/ScopeItemSheet"
import { findScopeItem } from "@/components/requirements/scopeItems"
import { ArtifactElementSheet } from "@/components/shared/ArtifactElementSheet"
import { findArtifactElement } from "@/components/shared/artifactElements"
import type { Artifact, ScopeView } from "@/api/types"

interface TraceSheetProps {
  sessionId: string
  selectedId: string | null
  scope: ScopeView | undefined
  artifacts: readonly Artifact[] | undefined
  readOnly: boolean
  onSelectId: (id: string | null) => void
}

/** Any clicked id opens something: a scope item, or the generated element behind it. */
export function TraceSheet({
  sessionId,
  selectedId,
  scope,
  artifacts,
  readOnly,
  onSelectId,
}: TraceSheetProps) {
  const item = findScopeItem(scope, selectedId)
  const element = item ? undefined : findArtifactElement(artifacts, selectedId)
  const close = (open: boolean) => !open && onSelectId(null)
  return (
    <>
      <ScopeItemSheet
        sessionId={sessionId}
        item={item}
        scope={scope}
        readOnly={readOnly}
        onOpenChange={close}
        onSelectId={onSelectId}
      />
      <ArtifactElementSheet
        sessionId={sessionId}
        element={element}
        onOpenChange={close}
        onSelectId={onSelectId}
      />
    </>
  )
}
