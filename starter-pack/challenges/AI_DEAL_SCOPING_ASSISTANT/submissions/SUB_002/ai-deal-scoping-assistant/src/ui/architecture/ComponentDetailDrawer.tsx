/** Opens the full detail of one architecture component - reached by clicking a diagram node or a component id chip. */
import type { ReactElement } from 'react';
import type { ArchitectureComponent, CloudPlatform, ScopeModel } from '../../domain';
import { Drawer } from '../common';
import { ComponentFields } from './ComponentFields';

export interface ComponentDetailDrawerProps {
  component: ArchitectureComponent | null;
  platform: CloudPlatform;
  scope: ScopeModel | null;
  onClose: () => void;
  onSelectRequirement: (id: string) => void;
}

export function ComponentDetailDrawer({ component, platform, scope, onClose, onSelectRequirement }: ComponentDetailDrawerProps): ReactElement | null {
  return (
    <Drawer open={component !== null} title={component?.name ?? 'Component detail'} onClose={onClose} side="end">
      {component === null ? null : <ComponentFields component={component} platform={platform} scope={scope} onSelectRequirement={onSelectRequirement} />}
    </Drawer>
  );
}
