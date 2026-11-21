/** One gap, assumption or open question: resolve it (or reopen it once resolved). */
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ScopeItem, ScopeItemKind } from '../../../domain';
import { Badge, Button, Card, ProvenanceBadge, TextArea } from '../../common';
import { AlertCircleIcon } from '../../common/icons';
import { estimationInputLabel } from '../types';

export interface ClarifyItemCardProps {
  item: ScopeItem;
  onResolve: (itemId: string, resolution: string) => void;
  onReopen: (itemId: string) => void;
}

const RESOLVE_ACTION_LABEL: ReadonlyMap<ScopeItemKind, string> = new Map([
  ['question', 'Answer question'],
  ['assumption', 'Validate assumption'],
  ['gap', 'Close gap'],
]);

const RESOLUTION_FIELD_LABEL: ReadonlyMap<ScopeItemKind, string> = new Map([
  ['question', 'Answer'],
  ['assumption', 'Validation note'],
  ['gap', 'Resolution'],
]);

export function ClarifyItemCard({ item, onResolve, onReopen }: ClarifyItemCardProps): ReactElement {
  const [draft, setDraft] = useState(item.resolution);
  const actionLabel = RESOLVE_ACTION_LABEL.get(item.kind) ?? 'Resolve';
  const fieldLabel = RESOLUTION_FIELD_LABEL.get(item.kind) ?? 'Resolution';

  return (
    <Card
      title={
        <span className="cluster">
          {item.id} - {item.title}
          {item.critical ? (
            <Badge tone="danger" icon={<AlertCircleIcon size={12} />}>
              Critical
            </Badge>
          ) : null}
        </span>
      }
      actions={<ProvenanceBadge provenance={item.provenance} />}
    >
      <div className="stack stack-sm">
        <p className="text-muted text-sm">{item.description}</p>
        {item.affectsInputs.length > 0 ? (
          <p className="text-subtle text-sm">Affects: {item.affectsInputs.map(estimationInputLabel).join(', ')}</p>
        ) : null}
        {item.resolved ? (
          <div className="stack stack-xs">
            <Badge tone="success">Resolved</Badge>
            <p className="text-sm">{item.resolution}</p>
            <Button variant="secondary" size="sm" onClick={() => onReopen(item.id)}>
              Reopen
            </Button>
          </div>
        ) : (
          <div className="stack stack-sm">
            <label className="field-label" htmlFor={`resolution-${item.id}`}>
              {fieldLabel}
            </label>
            <TextArea id={`resolution-${item.id}`} rows={2} value={draft} onChange={setDraft} />
            <Button variant="primary" size="sm" disabled={draft.trim().length === 0} onClick={() => onResolve(item.id, draft.trim())}>
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
