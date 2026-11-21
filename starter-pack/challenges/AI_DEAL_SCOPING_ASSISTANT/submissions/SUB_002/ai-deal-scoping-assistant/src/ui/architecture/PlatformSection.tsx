/** Cloud-platform selection grouped with its transparent recommendation (spec "Architecture Workspace": "Cloud-platform selection"). */
import type { ReactElement } from 'react';
import type { CloudPlatform, PlatformRecommendation, SolutionConfig } from '../../domain';
import { Card } from '../common';
import { PlatformRecommendationTable } from './PlatformRecommendationTable';
import { PlatformSelectionPanel } from './PlatformSelectionPanel';

export interface PlatformSectionProps {
  config: SolutionConfig;
  recommendation: PlatformRecommendation | null;
  disabled: boolean;
  onSelectPlatform: (platform: CloudPlatform) => void;
  onSelectRecommend: () => void;
  onSelectRequirement: (id: string) => void;
}

export function PlatformSection({ config, recommendation, disabled, onSelectPlatform, onSelectRecommend, onSelectRequirement }: PlatformSectionProps): ReactElement {
  return (
    <Card title="Cloud platform" subtitle="Select a preferred cloud platform, or let the assistant recommend one from the reviewed requirements.">
      <div className="stack stack-md">
        <PlatformSelectionPanel config={config} disabled={disabled} onSelectPlatform={onSelectPlatform} onSelectRecommend={onSelectRecommend} />
        <PlatformRecommendationTable recommendation={recommendation} onSelectRequirement={onSelectRequirement} />
      </div>
    </Card>
  );
}
