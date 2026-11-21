/** One architecture component rendered in the spec's example format, headed by its logical-component name and area. */
import type { ReactElement } from 'react';
import type { ArchitectureComponent, CloudPlatform, ScopeModel } from '../../domain';
import { Card } from '../common';
import { areaLabel } from './areaInfo';
import { ComponentFields } from './ComponentFields';

export interface ComponentCardProps {
  component: ArchitectureComponent;
  platform: CloudPlatform;
  scope: ScopeModel | null;
  onSelectRequirement: (id: string) => void;
}

export function ComponentCard({ component, platform, scope, onSelectRequirement }: ComponentCardProps): ReactElement {
  return (
    <Card className="architecture-component-card" title={component.name} subtitle={areaLabel(component.area)}>
      <ComponentFields component={component} platform={platform} scope={scope} onSelectRequirement={onSelectRequirement} />
    </Card>
  );
}
