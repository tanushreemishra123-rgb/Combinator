/**
 * Cloud-platform selection panel (Functional Requirements 3, "Cloud Solution Architecture": "Select
 * a preferred cloud platform, or Allow the assistant to recommend one based on the requirements").
 * Plain radio cards keep the whole group natively keyboard- and screen-reader-accessible without
 * any extra ARIA wiring.
 */
import type { ReactElement } from 'react';
import { platformLabel } from '../../architecture';
import type { CloudPlatform, SolutionConfig } from '../../domain';

export interface PlatformSelectionPanelProps {
  config: SolutionConfig;
  disabled: boolean;
  onSelectPlatform: (platform: CloudPlatform) => void;
  onSelectRecommend: () => void;
}

type PlatformChoice = CloudPlatform | 'recommend';

const PLATFORMS: readonly CloudPlatform[] = ['aws', 'azure', 'gcp'];

function currentChoice(config: SolutionConfig): PlatformChoice {
  return config.cloudSelectionMode === 'recommend' ? 'recommend' : (config.cloudPlatform ?? 'recommend');
}

export function PlatformSelectionPanel({ config, disabled, onSelectPlatform, onSelectRecommend }: PlatformSelectionPanelProps): ReactElement {
  const choice = currentChoice(config);

  return (
    <fieldset className="platform-selection" disabled={disabled}>
      <legend className="platform-selection-legend">Cloud platform</legend>
      <div className="platform-selection-grid">
        {PLATFORMS.map((platform) => (
          <label key={platform} className={`platform-card${choice === platform ? ' platform-card-selected' : ''}`}>
            <input type="radio" name="cloud-platform" value={platform} checked={choice === platform} onChange={() => onSelectPlatform(platform)} />
            <span className="platform-card-label">{platformLabel(platform)}</span>
          </label>
        ))}
        <label className={`platform-card${choice === 'recommend' ? ' platform-card-selected' : ''}`}>
          <input type="radio" name="cloud-platform" value="recommend" checked={choice === 'recommend'} onChange={onSelectRecommend} />
          <span className="platform-card-label">Let the assistant recommend</span>
        </label>
      </div>
    </fieldset>
  );
}
