import { EyeIcon } from "lucide-react"
import { PackagePreview } from "@/components/package/PackagePreview"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Diagrams, DocumentModel } from "@/api/types"

interface PackagePreviewDialogProps {
  document: DocumentModel
  diagrams: Diagrams | undefined
}

/** The built package in a near full-screen dialog, so the page itself stays short. */
export function PackagePreviewDialog({ document, diagrams }: PackagePreviewDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <EyeIcon data-icon="inline-start" />
          Preview the package
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[calc(100vh-2rem)] flex-col gap-4 sm:max-w-[calc(100%-2rem)] 2xl:max-w-[calc(100%-6rem)]">
        <DialogHeader>
          <DialogTitle>Package preview</DialogTitle>
          <DialogDescription>Exactly what the exported file contains.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-2">
          <PackagePreview document={document} diagrams={diagrams} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
