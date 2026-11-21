import { ScenarioGrid } from "@/components/sessions/ScenarioGrid"
import { PageHeader } from "@/components/shared/PageHeader"

export default function ScenariosPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Sample scenarios"
        description="Seeded customer input with recorded AI answers. The whole journey runs without a key."
      />
      <ScenarioGrid />
    </div>
  )
}
