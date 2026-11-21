/** Placeholder shown where a list or panel has no content yet, with an optional call to action. */
import type { ReactElement, ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps): ReactElement {
  return (
    <div className="empty-state">
      {icon ? (
        <span className="empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="empty-state-title">{title}</p>
      {message ? <p className="empty-state-message text-muted text-sm">{message}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
