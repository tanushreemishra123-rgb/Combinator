/** Edit drawer for one scope item: title, description, priority, provenance and related IDs. */
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Priority, Provenance, ScopeItem } from '../../../domain';
import { canBeCustomerStated, provenanceLabel } from '../../../scope';
import type { ScopeItemPatch } from '../../../scope';
import { Button, Drawer, Field, Select, TextArea, TextInput } from '../../common';
import { PRIORITY_FILTER_OPTIONS, PROVENANCE_FILTER_OPTIONS } from '../types';

export interface ScopeItemDrawerProps {
  open: boolean;
  item: ScopeItem | null;
  onClose: () => void;
  onSave: (itemId: string, patch: ScopeItemPatch) => void;
}

function parseRelatedIds(text: string): string[] {
  const ids = text
    .split(/[,\s]+/)
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
  return Array.from(new Set(ids));
}

export function ScopeItemDrawer({ open, item, onClose, onSave }: ScopeItemDrawerProps): ReactElement | null {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [provenance, setProvenance] = useState<Provenance>('assumed');
  const [relatedIdsText, setRelatedIdsText] = useState('');
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Reloads the draft fields from `item` whenever the drawer opens for a (possibly different) item,
  // computed during render rather than in an effect so a re-opened item always starts from its
  // current values instead of a stale draft.
  const activeKey = open && item !== null ? item.id : null;
  if (activeKey !== loadedKey) {
    setLoadedKey(activeKey);
    if (item !== null && activeKey !== null) {
      setTitle(item.title);
      setDescription(item.description);
      setPriority(item.priority);
      setProvenance(item.provenance);
      setRelatedIdsText(item.relatedIds.join(', '));
    }
  }

  if (item === null) {
    return null;
  }

  // Customer-stated is offered only when the item has a verified customer source to point at.
  const provenanceOptions = PROVENANCE_FILTER_OPTIONS.filter((value) => value !== 'customer-stated' || canBeCustomerStated(item));
  const provenanceHint = canBeCustomerStated(item)
    ? 'Only change this when the grounding hierarchy itself was misclassified.'
    : 'Customer-stated needs a verified customer source; this item has none, so it can only be AI-inferred or assumed.';

  function handleSave(): void {
    if (item === null) {
      return;
    }
    onSave(item.id, { title, description, priority, provenance, relatedIds: parseRelatedIds(relatedIdsText) });
    onClose();
  }

  return (
    <Drawer open={open} title={`Edit ${item.id}`} onClose={onClose} side="end">
      <div className="stack stack-md">
        <Field label="Title">{(props) => <TextInput {...props} value={title} onChange={setTitle} />}</Field>
        <Field label="Description">{(props) => <TextArea {...props} rows={4} value={description} onChange={setDescription} />}</Field>
        <Field label="Priority">
          {(props) => (
            <Select {...props} value={priority} options={PRIORITY_FILTER_OPTIONS.map((value) => ({ value, label: value }))} onChange={(value) => setPriority(value as Priority)} />
          )}
        </Field>
        <Field label="Provenance" hint={provenanceHint}>
          {(props) => (
            <Select
              {...props}
              value={provenance}
              options={provenanceOptions.map((value) => ({ value, label: provenanceLabel(value) }))}
              onChange={(value) => setProvenance(value as Provenance)}
            />
          )}
        </Field>
        <Field label="Related IDs" hint="Comma-separated scope item IDs, e.g. FR_01, ASM_02">
          {(props) => <TextInput {...props} value={relatedIdsText} onChange={setRelatedIdsText} />}
        </Field>
        <div className="cluster">
          <Button variant="primary" onClick={handleSave}>
            Save changes
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
