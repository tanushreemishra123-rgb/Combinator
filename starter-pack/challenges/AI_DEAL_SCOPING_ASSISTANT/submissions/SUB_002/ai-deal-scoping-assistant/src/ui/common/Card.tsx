/** Surface container used throughout every workspace to group related content. */
import type { ReactElement, ReactNode } from 'react';

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Set false for a card that manages its own internal padding (e.g. a table-only card). */
  padded?: boolean;
}

export function Card({ title, subtitle, actions, footer, children, className, padded = true }: CardProps): ReactElement {
  const hasHeader = title !== undefined || subtitle !== undefined || actions !== undefined;
  const classes = ['card', padded ? 'card-padded' : '', className].filter((value) => Boolean(value)).join(' ');

  return (
    <section className={classes}>
      {hasHeader ? (
        <header className="card-header">
          <div className="card-header-text">
            {title !== undefined ? <h3 className="card-title">{title}</h3> : null}
            {subtitle !== undefined ? <p className="card-subtitle text-muted text-sm">{subtitle}</p> : null}
          </div>
          {actions !== undefined ? <div className="card-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children !== undefined ? <div className="card-body">{children}</div> : null}
      {footer !== undefined ? <footer className="card-footer">{footer}</footer> : null}
    </section>
  );
}
