/** "Add item" dialog: kind + title + description + priority (spec "Recommended Application Sections 1"). */
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Priority, ScopeItemKind } from '../../../domain';
import { kindLabel, SCOPE_KIND_ORDER } from '../../../scope';
import type { NewScopeItemFields } from '../../../scope';
import { Button, Field, Modal, Select, TextArea, TextInput } from '../../common';
import { PRIORITY_FILTER_OPTIONS } from '../types';

export interface AddScopeItemModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (kind: ScopeItemKind, fields: NewScopeItemFields) => void;
}

const KIND_OPTIONS = SCOPE_KIND_ORDER.map((kind) => ({ value: kind, label: kindLabel(kind) }));

export function AddScopeItemModal({ open, onClose, onAdd }: AddScopeItemModalProps): ReactElement {
  const [kind, setKind] = useState<ScopeItemKind>('functional');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');

  function reset(): void {
    setKind('functional');
    setTitle('');
    setDescription('');
    setPriority('Medium');
  }

  function handleAdd(): void {
    onAdd(kind, { title: title.trim(), description: description.trim(), priority });
    reset();
    onClose();
  }

  const canAdd = title.trim().length > 0 && description.trim().length > 0;

  return (
    <Modal
      open={open}
      title="Add a scope item"
      description="Reviewer-added items always start as an assumption pending review, just like every other manual scope edit."
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canAdd} onClick={handleAdd}>
            Add item
          </Button>
        </>
      }
    >
      <div className="stack stack-md">
        <Field label="Kind">
          {(props) => <Select {...props} value={kind} options={KIND_OPTIONS} onChange={(value) => setKind(value as ScopeItemKind)} />}
        </Field>
        <Field label="Title" required>
          {(props) => <TextInput {...props} value={title} onChange={setTitle} />}
        </Field>
        <Field label="Description" required>
          {(props) => <TextArea {...props} rows={4} value={description} onChange={setDescription} />}
        </Field>
        <Field label="Priority">
          {(props) => (
            <Select {...props} value={priority} options={PRIORITY_FILTER_OPTIONS.map((value) => ({ value, label: value }))} onChange={(value) => setPriority(value as Priority)} />
          )}
        </Field>
      </div>
    </Modal>
  );
}
