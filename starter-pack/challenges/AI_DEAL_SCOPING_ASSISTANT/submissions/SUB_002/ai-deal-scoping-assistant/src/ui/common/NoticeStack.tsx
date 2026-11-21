/** Toast stack announced via aria-live, each dismissible independently. */
import type { ReactElement } from 'react';
import type { CalloutTone } from './Callout';
import { IconButton } from './IconButton';
import { XIcon } from './icons';

export interface Notice {
  id: string;
  tone: CalloutTone;
  title: string;
  message?: string;
}

export interface NoticeStackProps {
  notices: Notice[];
  onDismiss: (id: string) => void;
}

const ALERT_TONES: ReadonlySet<CalloutTone> = new Set(['warning', 'danger']);

export function NoticeStack({ notices, onDismiss }: NoticeStackProps): ReactElement {
  return (
    <div className="notice-stack" aria-live="polite" aria-atomic="false">
      {notices.map((notice) => (
        <div key={notice.id} className={`notice notice-${notice.tone}`} role={ALERT_TONES.has(notice.tone) ? 'alert' : 'status'}>
          <div className="notice-body">
            <p className="notice-title">{notice.title}</p>
            {notice.message ? <p className="notice-message text-sm">{notice.message}</p> : null}
          </div>
          <IconButton label="Dismiss notification" icon={<XIcon size={14} />} size="sm" onClick={() => onDismiss(notice.id)} />
        </div>
      ))}
    </div>
  );
}
