import { serviceNames } from "@/components/dataai/arcServices"
import { BasisBadge } from "@/components/shared/BasisBadge"
import { IdBadge } from "@/components/shared/IdBadge"
import { IdList } from "@/components/shared/IdList"
import { NarrativeSectionView } from "@/components/shared/NarrativeSectionView"
import { Separator } from "@/components/ui/separator"
import type { ArchitectureComponent, DataStrategyContent, NarrativeSection } from "@/api/types"

// Named explicitly, in the order the challenge lists the data-strategy areas.
function sections(strategy: DataStrategyContent): [string, NarrativeSection][] {
  return [
    ["Data ingestion", strategy.ingestion],
    ["Transactional storage", strategy.transactional_storage],
    ["Analytical storage", strategy.analytical_storage],
    ["Data quality", strategy.quality],
    ["Metadata and governance", strategy.metadata_governance],
    ["Data retention", strategy.retention],
    ["Privacy and security", strategy.privacy_security],
    ["Reporting and analytics", strategy.reporting_analytics],
    ["Backup and recovery", strategy.backup_recovery],
  ]
}

interface DataStrategyViewProps {
  strategy: DataStrategyContent
  components: readonly ArchitectureComponent[] | undefined
  onSelectId?: (id: string) => void
}

export function DataStrategyView({ strategy, components, onSelectId }: DataStrategyViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-sm font-medium tracking-tight">Data domains</h3>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {strategy.domains.map((domain) => (
            <li key={domain.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <IdBadge id={domain.id} />
                <span className="font-medium">{domain.name}</span>
                <BasisBadge basis={domain.basis} />
              </div>
              <p className="text-sm text-muted-foreground">{domain.description}</p>
              <p className="text-xs text-muted-foreground">
                Sources: {domain.sources.length ? domain.sources.join(", ") : "not stated"} · Owner:{" "}
                {domain.owner || "not stated"}
              </p>
              <IdList
                ids={domain.req_ids}
                label={`${domain.id} requirements`}
                onSelect={onSelectId}
              />
            </li>
          ))}
        </ul>
      </section>
      <Separator />
      <div className="grid gap-3 xl:grid-cols-2">
        {sections(strategy).map(([title, section]) => (
          <NarrativeSectionView
            key={title}
            title={title}
            section={section}
            services={serviceNames(components, section.arc_ids)}
            onSelectId={onSelectId}
          />
        ))}
      </div>
    </div>
  )
}
