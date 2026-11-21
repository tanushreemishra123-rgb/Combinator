/** "AI solution approach" tab (spec 4): provider preference, use cases, the AI/deterministic/human split, frameworks and prose panels. */
import type { ReactElement } from 'react';
import type { AiProviderPreference, AiStrategyOutput } from '../../domain';
import { EmptyState, SectionHeader, TracedStatementList } from '../common';
import { AiBoundaryTable } from './AiBoundaryTable';
import { AiNotApplicablePanel } from './AiNotApplicablePanel';
import { AiProsePanels } from './AiProsePanels';
import { AiProviderSelect } from './AiProviderSelect';
import { AiUseCaseCards } from './AiUseCaseCards';
import { FrameworkRecommendationCards } from './FrameworkRecommendationCards';

export interface AiSolutionTabProps {
  strategy: AiStrategyOutput | null;
  prerequisite: string | null;
  providerPreference: AiProviderPreference;
  providerSelectDisabled: boolean;
  onChangeProviderPreference: (value: AiProviderPreference) => void;
  onSelectRequirement: (id: string) => void;
}

const READY_MESSAGE = 'Use "Select the AI approach" above to generate it from the reviewed scope.';

function ApplicableStrategy({ strategy, onSelectRequirement }: { strategy: AiStrategyOutput; onSelectRequirement: (id: string) => void }): ReactElement {
  return (
    <>
      <SectionHeader as="h3" title="AI use cases" description="One card per AI-driven capability the reviewed scope signals." />
      <TracedStatementList statements={strategy.summary} onSelectRef={onSelectRequirement} />
      <AiUseCaseCards useCases={strategy.useCases} onSelectRequirement={onSelectRequirement} />
      <SectionHeader
        as="h3"
        title="AI vs deterministic vs human decision"
        description="Which activities are automated with AI, handled by deterministic rules, or require a mandatory human decision."
      />
      <AiBoundaryTable boundaries={strategy.boundaries} onSelectRequirement={onSelectRequirement} />
      <SectionHeader as="h3" title="Framework recommendations" description="Solution-specific framework and service choices, with alternatives considered." />
      <FrameworkRecommendationCards frameworks={strategy.frameworks} onSelectRequirement={onSelectRequirement} />
      <SectionHeader as="h3" title="Architecture, evaluation and responsible AI" />
      <AiProsePanels strategy={strategy} />
    </>
  );
}

export function AiSolutionTab({
  strategy,
  prerequisite,
  providerPreference,
  providerSelectDisabled,
  onChangeProviderPreference,
  onSelectRequirement,
}: AiSolutionTabProps): ReactElement {
  return (
    <div className="stack stack-lg">
      <AiProviderSelect value={providerPreference} disabled={providerSelectDisabled} onChange={onChangeProviderPreference} />
      {strategy === null ? (
        <EmptyState
          title={prerequisite !== null ? 'AI solution approach not available yet' : 'No AI solution approach yet'}
          message={prerequisite ?? READY_MESSAGE}
        />
      ) : strategy.applicable ? (
        <ApplicableStrategy strategy={strategy} onSelectRequirement={onSelectRequirement} />
      ) : (
        <AiNotApplicablePanel strategy={strategy} onSelectRequirement={onSelectRequirement} />
      )}
    </div>
  );
}
