/** One row of the scope items table - its own component so refs and callbacks stay simple to read. */
import { useId } from 'react';
import type { ReactElement } from 'react';
import type { Priority, ReviewStatus, ScopeItem } from '../../../domain';
import { kindLabel } from '../../../scope';
import { Button, IconButton, ProvenanceBadge, RefChips, Select, SourceRefLink, Toggle } from '../../common';
import { AlertTriangleIcon, CheckIcon, TrashIcon, XIcon } from '../../common/icons';

export interface ScopeItemRowProps {
  item: ScopeItem;
  isHighlighted: boolean;
  rowRef: (element: HTMLTableRowElement | null) => void;
  onOpenSource: (item: ScopeItem) => void;
  onSelectRelated: (id: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
  onInScopeChange: (id: string, inScope: boolean) => void;
  onReview: (id: string, review: ReviewStatus) => void;
  onEdit: (item: ScopeItem) => void;
  onDelete: (item: ScopeItem) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

function SourceCell({ item, onOpenSource }: Pick<ScopeItemRowProps, 'item' | 'onOpenSource'>): ReactElement {
  if (item.source === null) {
    return <span className="text-subtle text-sm">No source reference</span>;
  }
  return (
    <span className="stack stack-xs">
      <SourceRefLink source={item.source} onOpen={() => onOpenSource(item)} />
      {!item.source.verified ? (
        <span className="requirements-unverified-warning text-sm">
          <AlertTriangleIcon size={12} />
          Unverified against the normalized text
        </span>
      ) : null}
    </span>
  );
}

export function ScopeItemRow({
  item,
  isHighlighted,
  rowRef,
  onOpenSource,
  onSelectRelated,
  onPriorityChange,
  onInScopeChange,
  onReview,
  onEdit,
  onDelete,
}: ScopeItemRowProps): ReactElement {
  const priorityId = useId();
  return (
    <tr ref={rowRef} className={isHighlighted ? 'requirements-scope-row-highlighted' : undefined}>
      <td>
        <span className="requirements-item-id">{item.id}</span>
      </td>
      <td>{kindLabel(item.kind)}</td>
      <td className="requirements-item-text">
        <p className="requirements-item-title">{item.title}</p>
        <p className="text-muted text-sm">{item.description}</p>
      </td>
      <td>
        <label className="sr-only" htmlFor={priorityId}>{`Priority for ${item.id}`}</label>
        <Select
          id={priorityId}
          value={item.priority}
          options={PRIORITY_OPTIONS}
          onChange={(value) => onPriorityChange(item.id, value as Priority)}
        />
      </td>
      <td>
        <ProvenanceBadge provenance={item.provenance} />
      </td>
      <td>
        <SourceCell item={item} onOpenSource={onOpenSource} />
      </td>
      <td>
        <RefChips refs={item.relatedIds} onSelect={onSelectRelated} />
      </td>
      <td>
        <Toggle checked={item.inScope} onChange={(checked) => onInScopeChange(item.id, checked)} label="In scope" />
      </td>
      <td>
        <span className="cluster">
          <IconButton
            label={`Approve ${item.id}`}
            icon={<CheckIcon />}
            variant={item.review === 'approved' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onReview(item.id, 'approved')}
          />
          <IconButton
            label={`Reject ${item.id}`}
            icon={<XIcon />}
            variant={item.review === 'rejected' ? 'danger' : 'ghost'}
            size="sm"
            onClick={() => onReview(item.id, 'rejected')}
          />
        </span>
      </td>
      <td>
        <span className="cluster">
          <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
            Edit
          </Button>
          <IconButton label={`Delete ${item.id}`} icon={<TrashIcon />} variant="danger" size="sm" onClick={() => onDelete(item)} />
        </span>
      </td>
    </tr>
  );
}
