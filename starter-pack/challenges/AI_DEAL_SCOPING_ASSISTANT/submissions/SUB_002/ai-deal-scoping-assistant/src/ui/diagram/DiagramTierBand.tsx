/** One tier band: its background rect and a wrapped label in the left-hand gutter. */
import type { ReactElement } from 'react';
import { TIER_LABEL_FONT_SIZE, TIER_LABEL_MAX_CHARS, wrapLabelToLines } from '../../diagram';
import type { LaidOutTier } from '../../diagram';

export interface DiagramTierBandProps {
  tier: LaidOutTier;
}

const LINE_HEIGHT = TIER_LABEL_FONT_SIZE + 2;
const MAX_LINES = 3;
const GUTTER_TEXT_INSET = 10;

export function DiagramTierBand({ tier }: DiagramTierBandProps): ReactElement {
  const lines = wrapLabelToLines(tier.label, TIER_LABEL_MAX_CHARS, MAX_LINES);
  const textX = tier.x + GUTTER_TEXT_INSET;
  const textY = tier.y + tier.height / 2 - ((lines.length - 1) * LINE_HEIGHT) / 2;

  return (
    <g className="diagram-tier">
      <rect x={tier.x} y={tier.y} width={tier.width} height={tier.height} className="diagram-tier-band" />
      <text x={textX} y={textY} className="diagram-tier-label">
        {lines.map((line, index) => (
          <tspan key={`${index}-${line}`} x={textX} y={textY + index * LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
