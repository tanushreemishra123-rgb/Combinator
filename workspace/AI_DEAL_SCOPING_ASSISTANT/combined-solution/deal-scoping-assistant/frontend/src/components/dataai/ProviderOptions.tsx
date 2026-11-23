import { providersForPlatform } from "@/components/dataai/providerFilter"
import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { label } from "@/lib/labels"
import type { CloudPlatform, ProviderOption } from "@/api/types"

interface ProviderOptionsProps {
  options: readonly ProviderOption[]
  platform: CloudPlatform | null
}

const columns: readonly DataTableColumn<ProviderOption>[] = [
  { id: "provider", header: "Provider", cell: (option) => option.provider },
  { id: "platform", header: "Applies to", cell: (option) => label(option.platform) },
  {
    id: "models",
    header: "Models",
    cell: (option) => (option.models.length ? option.models.join(", ") : "Not stated"),
  },
  { id: "rationale", header: "Why it fits", cell: (option) => option.rationale },
]

export function ProviderOptions({ options, platform }: ProviderOptionsProps) {
  const visible = providersForPlatform(options, platform)
  return (
    <div className="flex flex-col gap-2">
      {platform ? (
        <p className="text-xs text-muted-foreground">
          Filtered to {label(platform)} and platform-independent options.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          rows={visible}
          getRowId={(option) => `${option.platform}-${option.provider}`}
          emptyMessage="No provider option applies to this platform."
        />
      </div>
    </div>
  )
}
