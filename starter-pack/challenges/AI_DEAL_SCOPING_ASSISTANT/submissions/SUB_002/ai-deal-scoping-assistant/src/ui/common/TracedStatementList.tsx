/** Renders a list of TracedStatement (generated text + its content label + supporting reference ids). */
import type { ReactElement } from 'react';
import type { TracedStatement } from '../../domain';
import { ContentLabelBadge } from './ContentLabelBadge';
import { RefChips } from './RefChips';

export interface TracedStatementListProps {
  statements: TracedStatement[];
  onSelectRef?: (id: string) => void;
  emptyMessage?: string;
}

export function TracedStatementList({
  statements,
  onSelectRef,
  emptyMessage = 'Nothing generated yet.',
}: TracedStatementListProps): ReactElement {
  if (statements.length === 0) {
    return <p className="text-muted text-sm">{emptyMessage}</p>;
  }

  return (
    <ul className="traced-statement-list">
      {statements.map((statement, index) => (
        <li key={`${index}-${statement.text.slice(0, 40)}`} className="traced-statement">
          <ContentLabelBadge label={statement.label} />
          <p className="traced-statement-text">{statement.text}</p>
          <RefChips refs={statement.refs} onSelect={onSelectRef} />
        </li>
      ))}
    </ul>
  );
}
