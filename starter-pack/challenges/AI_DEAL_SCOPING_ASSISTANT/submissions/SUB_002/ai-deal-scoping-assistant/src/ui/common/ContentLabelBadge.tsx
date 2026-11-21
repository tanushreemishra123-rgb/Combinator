/** Labels how a generated statement relates to what the customer actually asked for. */
import type { ComponentType, ReactElement } from 'react';
import type { ContentLabel } from '../../domain';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';
import { HelpCircleIcon, LightbulbIcon, MinusCircleIcon, SparklesIcon, UserIcon } from './icons';
import type { IconProps } from './icons';

export interface ContentLabelBadgeProps {
  label: ContentLabel;
}

interface ContentLabelMeta {
  text: string;
  tone: BadgeTone;
  Icon: ComponentType<IconProps>;
}

const CONTENT_LABEL_META: ReadonlyMap<ContentLabel, ContentLabelMeta> = new Map([
  ['customer-requested', { text: 'Customer-requested', tone: 'primary', Icon: UserIcon }],
  ['ai-interpretation', { text: 'AI interpretation', tone: 'violet', Icon: SparklesIcon }],
  ['recommended-enhancement', { text: 'Recommended enhancement', tone: 'teal', Icon: LightbulbIcon }],
  ['assumption-to-confirm', { text: 'Assumption to confirm', tone: 'warning', Icon: HelpCircleIcon }],
  ['out-of-scope', { text: 'Out of scope', tone: 'neutral', Icon: MinusCircleIcon }],
]);

const FALLBACK_META: ContentLabelMeta = { text: 'Unlabelled', tone: 'neutral', Icon: HelpCircleIcon };

export function ContentLabelBadge({ label }: ContentLabelBadgeProps): ReactElement {
  const meta = CONTENT_LABEL_META.get(label) ?? FALLBACK_META;
  return (
    <Badge tone={meta.tone} icon={<meta.Icon size={12} />}>
      {meta.text}
    </Badge>
  );
}
