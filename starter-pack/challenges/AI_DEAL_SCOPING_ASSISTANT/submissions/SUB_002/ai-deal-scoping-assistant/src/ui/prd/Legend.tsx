/**
 * Legend explaining the five grounding labels (spec: "The assistant should distinguish between:
 * Customer-requested scope / AI-derived interpretation / Recommended enhancements / Assumptions
 * requiring confirmation / Out-of-scope items").
 */
import type { ReactElement } from 'react';
import type { ContentLabel } from '../../domain';
import { Card, ContentLabelBadge } from '../common';

interface LegendItem {
  label: ContentLabel;
  description: string;
}

const LEGEND_ITEMS: readonly LegendItem[] = [
  { label: 'customer-requested', description: 'Directly requested by the customer in the reviewed requirements.' },
  { label: 'ai-interpretation', description: 'An AI-derived interpretation of what the customer described.' },
  { label: 'recommended-enhancement', description: 'A recommended enhancement the customer did not explicitly request.' },
  { label: 'assumption-to-confirm', description: 'Relies on an assumption that still needs the customer to confirm it.' },
  { label: 'out-of-scope', description: 'Explicitly excluded from this engagement.' },
];

export function Legend(): ReactElement {
  return (
    <Card title="Label legend" subtitle="How every statement and capability in this workspace is grounded.">
      <ul className="legend-list stack stack-sm">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.label} className="legend-item cluster">
            <ContentLabelBadge label={item.label} />
            <span className="text-sm text-muted">{item.description}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
