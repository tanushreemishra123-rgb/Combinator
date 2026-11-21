/** Confirmation dialog before removing a scope item (also strips it from every other item's related IDs). */
import type { ReactElement } from 'react';
import type { ScopeItem } from '../../../domain';
import { Button, Modal } from '../../common';

export interface DeleteScopeItemModalProps {
  item: ScopeItem | null;
  onCancel: () => void;
  onConfirm: (itemId: string) => void;
}

export function DeleteScopeItemModal({ item, onCancel, onConfirm }: DeleteScopeItemModalProps): ReactElement {
  return (
    <Modal
      open={item !== null}
      title="Remove this scope item?"
      description={item === null ? undefined : `${item.id} - ${item.title}`}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (item !== null) {
                onConfirm(item.id);
              }
            }}
          >
            Remove item
          </Button>
        </>
      }
    >
      <p className="text-muted text-sm">This also removes it from any other item&apos;s related IDs. This cannot be undone.</p>
    </Modal>
  );
}
