import type { ReactNode } from 'react';

export interface PlaceholderViewProps {
  title: string;
  children?: ReactNode;
}

export function PlaceholderView({ title, children }: PlaceholderViewProps) {
  return (
    <section className="app-view" aria-label={title}>
      <h1>{title}</h1>
      {children ?? <p>This view is coming soon.</p>}
    </section>
  );
}
