/** Shows estimation/assumption confidence as a label plus a three-bar signal indicator. */
import type { ReactElement } from 'react';
import type { Confidence } from '../../domain';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';

export interface ConfidenceBadgeProps {
  confidence: Confidence;
}

const TONE_BY_CONFIDENCE: ReadonlyMap<Confidence, BadgeTone> = new Map([
  ['High', 'success'],
  ['Medium', 'warning'],
  ['Low', 'danger'],
]);

const FILLED_BARS_BY_CONFIDENCE: ReadonlyMap<Confidence, number> = new Map([
  ['Low', 1],
  ['Medium', 2],
  ['High', 3],
]);

const BAR_HEIGHTS = [6, 10, 14];

function ConfidenceBars({ confidence }: { confidence: Confidence }): ReactElement {
  const filled = FILLED_BARS_BY_CONFIDENCE.get(confidence) ?? 0;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {BAR_HEIGHTS.map((height, index) => (
        <rect
          key={height}
          x={index * 5}
          y={14 - height}
          width="3"
          height={height}
          rx="1"
          className={index < filled ? 'confidence-bar-filled' : 'confidence-bar-empty'}
        />
      ))}
    </svg>
  );
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps): ReactElement {
  const tone = TONE_BY_CONFIDENCE.get(confidence) ?? 'neutral';
  return (
    <Badge tone={tone} icon={<ConfidenceBars confidence={confidence} />}>
      {confidence} confidence
    </Badge>
  );
}
