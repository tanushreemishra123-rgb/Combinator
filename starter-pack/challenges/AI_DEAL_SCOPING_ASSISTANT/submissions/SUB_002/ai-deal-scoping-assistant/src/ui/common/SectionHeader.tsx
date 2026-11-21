/**
 * Heading block for a workspace section. `eyebrow` should be the plain-language journey phrase
 * (e.g. 'Review the extracted scope') the spec asks the experience to speak in.
 */
import type { ReactElement, ReactNode } from 'react';

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
}

export function SectionHeader({ eyebrow, title, description, actions, as = 'h2' }: SectionHeaderProps): ReactElement {
  const HeadingTag = as;
  return (
    <div className="section-header">
      <div className="section-header-text">
        {eyebrow ? <p className="section-header-eyebrow">{eyebrow}</p> : null}
        <HeadingTag className="section-header-title">{title}</HeadingTag>
        {description ? <p className="section-header-description text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="section-header-actions">{actions}</div> : null}
    </div>
  );
}
