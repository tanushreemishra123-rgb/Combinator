/** One labelled list of estimate notes (risk / dependency / assumption / exclusion) with their reference chips. */
import type { ReactElement } from 'react';
import type { EstimateNote } from '../../../domain';
import { Badge, EmptyState, RefChips } from '../../common';

export interface NoteListProps {
  title: string;
  emptyMessage: string;
  notes: EstimateNote[];
  onSelectRequirement: (id: string) => void;
}

export function NoteList({ title, emptyMessage, notes, onSelectRequirement }: NoteListProps): ReactElement {
  return (
    <div className="stack stack-sm">
      <p className="estimate-subheading text-sm">{title}</p>
      {notes.length === 0 ? (
        <EmptyState title="None recorded" message={emptyMessage} />
      ) : (
        <ul className="stack stack-sm">
          {notes.map((note) => (
            <li key={note.id} className="stack stack-xs">
              <div className="cluster">
                <Badge tone="neutral">{note.id}</Badge>
                <span className="text-sm">{note.text}</span>
              </div>
              {note.refs.length > 0 ? <RefChips refs={note.refs} onSelect={onSelectRequirement} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
