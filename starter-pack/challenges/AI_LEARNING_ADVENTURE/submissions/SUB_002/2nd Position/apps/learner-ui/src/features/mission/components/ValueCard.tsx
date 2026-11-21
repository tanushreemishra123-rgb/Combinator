import type { ReactNode } from 'react';

export interface ValueCardProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export function ValueCard({ title, description, icon }: ValueCardProps) {
  return (
    <li className="value-card">
      <span className="value-card__icon" aria-hidden="true">
        {icon}
      </span>
      <h3 className="value-card__title">{title}</h3>
      <p className="value-card__description">{description}</p>
    </li>
  );
}
