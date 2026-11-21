/**
 * "Application components and cloud services" tab (spec "Recommended Application Sections 3"):
 * every proposed component in the spec's example format, filterable by architecture area with all
 * 14 areas counted so a gap - an applicable area with no proposed component - is visible.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ArchitectureArea, ArchitectureDesign, ScopeModel } from '../../domain';
import { EmptyState } from '../common';
import { countComponentsByArea } from './areaInfo';
import { ComponentAreaSummary } from './ComponentAreaSummary';
import { ComponentCard } from './ComponentCard';

export interface ComponentsTabProps {
  design: ArchitectureDesign | null;
  scope: ScopeModel | null;
  prerequisite: string | null;
  onSelectRequirement: (id: string) => void;
}

const READY_MESSAGE = 'Use "Design the solution" above to generate the architecture components from the reviewed scope.';

export function ComponentsTab({ design, scope, prerequisite, onSelectRequirement }: ComponentsTabProps): ReactElement {
  const [activeArea, setActiveArea] = useState<ArchitectureArea | null>(null);

  if (design === null) {
    return (
      <EmptyState
        title={prerequisite !== null ? 'Architecture components not available yet' : 'No architecture components yet'}
        message={prerequisite ?? READY_MESSAGE}
      />
    );
  }

  const areas = countComponentsByArea(design.components);
  const visibleComponents = activeArea === null ? design.components : design.components.filter((component) => component.area === activeArea);

  return (
    <div className="stack stack-lg">
      <ComponentAreaSummary areas={areas} activeArea={activeArea} onSelectArea={setActiveArea} />
      {visibleComponents.length === 0 ? (
        <EmptyState
          title="No components in this area"
          message="This architecture area has no proposed component yet - worth reviewing with a solution architect."
        />
      ) : (
        <div className="architecture-component-grid">
          {visibleComponents.map((component) => (
            <ComponentCard key={component.id} component={component} platform={design.platform} scope={scope} onSelectRequirement={onSelectRequirement} />
          ))}
        </div>
      )}
    </div>
  );
}
