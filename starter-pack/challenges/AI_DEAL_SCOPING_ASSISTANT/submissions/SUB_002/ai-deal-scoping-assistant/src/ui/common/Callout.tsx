/** Inline banner for a single note, warning, error, or success message within a card or dialog. */
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, InfoIcon } from './icons';
import type { IconProps } from './icons';

export type CalloutTone = 'info' | 'warning' | 'danger' | 'success';

export interface CalloutProps {
  tone?: CalloutTone;
  title?: string;
  children: ReactNode;
}

interface CalloutMeta {
  Icon: ComponentType<IconProps>;
}

const CALLOUT_META: ReadonlyMap<CalloutTone, CalloutMeta> = new Map([
  ['info', { Icon: InfoIcon }],
  ['warning', { Icon: AlertTriangleIcon }],
  ['danger', { Icon: AlertCircleIcon }],
  ['success', { Icon: CheckCircleIcon }],
]);

const FALLBACK_META: CalloutMeta = { Icon: InfoIcon };

const ALERT_TONES: ReadonlySet<CalloutTone> = new Set(['warning', 'danger']);

export function Callout({ tone = 'info', title, children }: CalloutProps): ReactElement {
  const meta = CALLOUT_META.get(tone) ?? FALLBACK_META;
  return (
    <div className={`callout callout-${tone}`} role={ALERT_TONES.has(tone) ? 'alert' : 'status'}>
      <meta.Icon />
      <div className="callout-body">
        {title ? <p className="callout-title">{title}</p> : null}
        <div className="callout-text">{children}</div>
      </div>
    </div>
  );
}
