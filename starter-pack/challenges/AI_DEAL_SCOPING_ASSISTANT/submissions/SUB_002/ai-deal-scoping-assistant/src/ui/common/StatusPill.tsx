/**
 * Freshness/review indicator for a workspace, step or generated section. Use `dotOnly` for
 * space-constrained contexts (e.g. the sidebar) where the item's own label is already visible.
 */
import type { ComponentType, ReactElement } from 'react';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';
import { AlertTriangleIcon, CheckCircleIcon, CircleIcon, ClockIcon } from './icons';
import type { IconProps } from './icons';

export type StatusPillStatus = 'empty' | 'current' | 'stale' | 'reviewed';

export interface StatusPillProps {
  status: StatusPillStatus;
  /** Render only the coloured dot (with an sr-only label) instead of the full labelled pill. */
  dotOnly?: boolean;
}

interface StatusMeta {
  label: string;
  tone: BadgeTone;
  Icon: ComponentType<IconProps>;
}

const STATUS_META: ReadonlyMap<StatusPillStatus, StatusMeta> = new Map([
  ['empty', { label: 'Not started', tone: 'neutral', Icon: CircleIcon }],
  ['current', { label: 'In progress', tone: 'primary', Icon: ClockIcon }],
  ['stale', { label: 'Needs review', tone: 'warning', Icon: AlertTriangleIcon }],
  ['reviewed', { label: 'Reviewed', tone: 'success', Icon: CheckCircleIcon }],
]);

const FALLBACK_META: StatusMeta = { label: 'Unknown', tone: 'neutral', Icon: CircleIcon };

export function StatusPill({ status, dotOnly = false }: StatusPillProps): ReactElement {
  const meta = STATUS_META.get(status) ?? FALLBACK_META;

  if (dotOnly) {
    return (
      <span className={`status-dot status-dot-${meta.tone}`}>
        <span className="sr-only">{meta.label}</span>
      </span>
    );
  }

  return (
    <Badge tone={meta.tone} icon={<meta.Icon size={12} />}>
      {meta.label}
    </Badge>
  );
}
