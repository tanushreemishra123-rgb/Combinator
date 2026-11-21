/**
 * Confirmation before re-running the analysis over an existing scope model: a new run replaces the
 * reviewed scope, its approvals and edits, every generated deliverable and the change log.
 */
import type { ReactElement } from 'react';
import type { ScopeModel } from '../../../domain';
import { isScopeApproved } from '../../../scope';
import { Button, Modal } from '../../common';

export interface ReplaceScopeModalProps {
  scope: ScopeModel | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** One line naming what the reviewer is about to lose: the version, its approval and their edits. */
export function describeReviewedScope(scope: ScopeModel): string {
  const approval = isScopeApproved(scope) ? 'approved' : 'not yet approved';
  const edited = scope.items.filter((item) => item.userEdited).length;
  const edits = edited === 1 ? '1 edited item' : `${edited} edited items`;
  return `The reviewed scope is at version ${scope.version}, ${approval}, with ${edits}.`;
}

export function ReplaceScopeModal({ scope, open, onCancel, onConfirm }: ReplaceScopeModalProps): ReactElement {
  return (
    <Modal
      open={open && scope !== null}
      title="Replace the reviewed scope?"
      description={scope === null ? undefined : describeReviewedScope(scope)}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Keep the current scope
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Run the analysis again
          </Button>
        </>
      }
    >
      <p className="text-muted text-sm">
        A new analysis replaces the reviewed scope, its approvals and edits, and every generated deliverable, including the change log. This cannot be
        undone; export the workspace first if you need to keep it.
      </p>
    </Modal>
  );
}
