/** Shows an estimation driver's complexity as a label plus a four-bar level indicator. */
import type { ReactElement } from 'react';
import type { Complexity } from '../../domain';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';

export interface ComplexityBadgeProps {
  complexity: Complexity;
}

const TONE_BY_COMPLEXITY: ReadonlyMap<Complexity, BadgeTone> = new Map([
  ['Low', 'success'],
  ['Medium', 'teal'],
  ['High', 'warning'],
  ['Very High', 'danger'],
]);

const FILLED_BARS_BY_COMPLEXITY: ReadonlyMap<Complexity, number> = new Map([
  ['Low', 1],
  ['Medium', 2],
  ['High', 3],
  ['Very High', 4],
]);

const BAR_HEIGHTS = [5, 8, 11, 14];

function ComplexityBars({ complexity }: { complexity: Complexity }): ReactElement {
  const filled = FILLED_BARS_BY_COMPLEXITY.get(complexity) ?? 0;
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
      {BAR_HEIGHTS.map((height, index) => (
        <rect
          key={height}
          x={index * 4.5}
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

export function ComplexityBadge({ complexity }: ComplexityBadgeProps): ReactElement {
  const tone = TONE_BY_COMPLEXITY.get(complexity) ?? 'neutral';
  return (
    <Badge tone={tone} icon={<ComplexityBars complexity={complexity} />}>
      {complexity} complexity
    </Badge>
  );
}
