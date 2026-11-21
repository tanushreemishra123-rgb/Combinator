import { AiUseCaseCard } from "@/components/dataai/AiUseCaseCard"
import { FrameworkList } from "@/components/dataai/FrameworkList"
import { ProviderOptions } from "@/components/dataai/ProviderOptions"
import { StatementSection } from "@/components/prd/StatementSection"
import { SectionCard } from "@/components/shared/SectionCard"
import type { AiStrategyContent, CloudPlatform } from "@/api/types"

interface AiStrategyViewProps {
  strategy: AiStrategyContent
  platform: CloudPlatform | null
  onSelectId?: (id: string) => void
}

export function AiStrategyView({ strategy, platform, onSelectId }: AiStrategyViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="AI approach"
        description={`Recommended pattern: ${strategy.architecture_pattern}`}
      >
        <div className="flex flex-col gap-6">
          <StatementSection
            title="AI-specific requirements"
            statements={strategy.ai_requirements}
            onSelectId={onSelectId}
          />
          <StatementSection
            title="Better handled by deterministic rules"
            statements={strategy.deterministic_areas}
            onSelectId={onSelectId}
          />
          <StatementSection
            title="Decisions that stay with a human"
            statements={strategy.mandatory_human_decisions}
            onSelectId={onSelectId}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="AI use cases"
        description="Each one names its evaluation, safety and human review."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {strategy.use_cases.map((useCase) => (
            <AiUseCaseCard key={useCase.id} useCase={useCase} onSelectId={onSelectId} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Model and provider options">
        <ProviderOptions options={strategy.provider_options} platform={platform} />
      </SectionCard>

      <SectionCard title="Framework recommendations">
        <FrameworkList frameworks={strategy.framework_recommendations} onSelectId={onSelectId} />
      </SectionCard>
    </div>
  )
}
