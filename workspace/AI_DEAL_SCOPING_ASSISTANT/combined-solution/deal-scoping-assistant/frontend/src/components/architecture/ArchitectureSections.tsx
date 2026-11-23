import { NarrativeSectionView } from "@/components/shared/NarrativeSectionView"
import { KeyValueList } from "@/components/shared/KeyValueList"
import { Separator } from "@/components/ui/separator"
import type { ArchitectureContent } from "@/api/types"

interface ArchitectureSectionsProps {
  architecture: ArchitectureContent
  onSelectId?: (id: string) => void
}

export function ArchitectureSections({ architecture, onSelectId }: ArchitectureSectionsProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-sm font-medium tracking-tight">Environments</h3>
        <KeyValueList
          items={[
            { label: "Development", value: architecture.environments.dev },
            { label: "Test", value: architecture.environments.test },
            { label: "Production", value: architecture.environments.prod },
          ]}
        />
      </section>
      <Separator />
      <div className="grid gap-3 xl:grid-cols-2">
        <NarrativeSectionView
          title="Deployment and runtime"
          section={architecture.deployment_runtime}
          onSelectId={onSelectId}
        />
        <NarrativeSectionView
          title="Availability and scalability"
          section={architecture.availability_scalability}
          onSelectId={onSelectId}
        />
        <NarrativeSectionView
          title="Backup and disaster recovery"
          section={architecture.backup_dr}
          onSelectId={onSelectId}
        />
        <NarrativeSectionView
          title="Observability and monitoring"
          section={architecture.observability}
          onSelectId={onSelectId}
        />
        <NarrativeSectionView
          title="Security controls"
          section={architecture.security_controls}
          onSelectId={onSelectId}
        />
      </div>
    </div>
  )
}
