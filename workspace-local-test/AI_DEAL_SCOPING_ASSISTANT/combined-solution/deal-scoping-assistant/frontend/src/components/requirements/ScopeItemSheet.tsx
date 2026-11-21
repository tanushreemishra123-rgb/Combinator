import { ScopeItemPanel } from "@/components/requirements/ScopeItemPanel"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { ScopeItem, ScopeView } from "@/api/types"

interface ScopeItemSheetProps {
  sessionId: string
  item: ScopeItem | undefined
  scope: ScopeView | undefined
  /** After approval the scope is locked and every change goes through the change service. */
  readOnly: boolean
  onOpenChange: (open: boolean) => void
  onSelectId?: (id: string) => void
}

export function ScopeItemSheet({
  sessionId,
  item,
  scope,
  readOnly,
  onOpenChange,
  onSelectId,
}: ScopeItemSheetProps) {
  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {item ? (
          <>
            <SheetHeader>
              <SheetTitle>
                {item.id} — {item.title}
              </SheetTitle>
              <SheetDescription>
                {readOnly
                  ? "The scope is approved, so this item is read-only here."
                  : "Review the wording, the priority and where it came from."}
              </SheetDescription>
            </SheetHeader>
            <ScopeItemPanel
              key={item.id}
              sessionId={sessionId}
              item={item}
              scope={scope}
              readOnly={readOnly}
              onClose={() => onOpenChange(false)}
              onSelectId={onSelectId}
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
