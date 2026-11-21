/** Colour-codes a requirement's priority so it can be scanned at a glance across long lists. */
import type { ComponentType, ReactElement } from 'react';
import type { Priority } from '../../domain';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from './icons';
import type { IconProps } from './icons';

export interface PriorityBadgeProps {
  priority: Priority;
}

interface PriorityMeta {
  tone: BadgeTone;
  Icon: ComponentType<IconProps>;
}

const PRIORITY_META: ReadonlyMap<Priority, PriorityMeta> = new Map([
  ['High', { tone: 'danger', Icon: ArrowUpIcon }],
  ['Medium', { tone: 'warning', Icon: MinusIcon }],
  ['Low', { tone: 'success', Icon: ArrowDownIcon }],
]);

export function PriorityBadge({ priority }: PriorityBadgeProps): ReactElement {
  const meta = PRIORITY_META.get(priority) ?? { tone: 'neutral' as BadgeTone, Icon: MinusIcon };
  return (
    <Badge tone={meta.tone} icon={<meta.Icon size={12} />}>
      {priority}
    </Badge>
  );
}
