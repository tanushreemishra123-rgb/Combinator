/** Definition-list layout for label/value pairs (config summaries, rationale details, and similar). */
import type { ReactElement, ReactNode } from 'react';

export interface KeyValueItem {
  key: string;
  value: ReactNode;
}

export interface KeyValueListProps {
  items: KeyValueItem[];
  columns?: 1 | 2;
}

export function KeyValueList({ items, columns = 1 }: KeyValueListProps): ReactElement {
  return (
    <dl className={`key-value-list key-value-list-cols-${columns}`}>
      {items.map((item) => (
        <div className="key-value-row" key={item.key}>
          <dt>{item.key}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
