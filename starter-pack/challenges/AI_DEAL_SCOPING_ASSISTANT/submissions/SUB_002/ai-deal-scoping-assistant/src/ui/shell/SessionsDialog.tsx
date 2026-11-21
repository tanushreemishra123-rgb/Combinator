/**
 * Session manager: switch between saved scoping sessions, start a blank one or one seeded from a
 * sample scenario, import/export a session workspace file, and delete sessions - all local to this
 * browser (see the privacy note rendered in the dialog body).
 */
import { useRef } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import { Button, Callout, DataTable, IconButton, Modal } from '../common';
import { formatDateTime } from '../common/format';
import { DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from '../common/icons';

export interface SessionSummary {
  id: string;
  name: string;
  updatedAt: string;
  statusLabel: string;
  scenarioLabel: string | null;
}

export interface SessionScenarioOption {
  id: string;
  name: string;
  tagline: string;
}

export interface SessionsDialogProps {
  open: boolean;
  onClose: () => void;
  sessions: SessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onCreateFromScenario: (scenarioId: string) => void;
  scenarios: SessionScenarioOption[];
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onImport: (file: File) => void;
  onExportWorkspace: (id: string) => void;
}

export function SessionsDialog({
  open,
  onClose,
  sessions,
  activeId,
  onSelect,
  onCreate,
  onCreateFromScenario,
  scenarios,
  onDelete,
  onDeleteAll,
  onImport,
  onExportWorkspace,
}: SessionsDialogProps): ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChosen(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.item(0) ?? null;
    if (file) {
      onImport(file);
    }
    event.target.value = '';
  }

  return (
    <Modal
      open={open}
      title="Sessions"
      description="Every session lives only in this browser's local storage - nothing is uploaded until you export it."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={onDeleteAll} disabled={sessions.length === 0}>
            Delete all sessions
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="stack stack-md">
        <Callout tone="info" title="Local-only storage">
          Sessions (including any API key you enter) never leave this browser unless you use Export. Import accepts a workspace
          file previously exported from this application.
        </Callout>
        <div className="cluster">
          <Button variant="primary" icon={<PlusIcon />} onClick={onCreate}>
            New blank session
          </Button>
          {scenarios.map((scenario) => (
            <Button key={scenario.id} variant="secondary" title={scenario.tagline} onClick={() => onCreateFromScenario(scenario.id)}>
              New from: {scenario.name}
            </Button>
          ))}
          <input ref={fileInputRef} type="file" accept=".json" className="sr-only" onChange={handleFileChosen} />
          <Button variant="secondary" icon={<UploadIcon />} onClick={() => fileInputRef.current?.click()}>
            Import workspace
          </Button>
        </div>
        <DataTable
          caption="Saved sessions"
          rows={sessions}
          getRowId={(session) => session.id}
          emptyState={<p className="text-muted text-sm">No saved sessions yet - create one above.</p>}
          columns={[
            {
              id: 'name',
              header: 'Session',
              render: (session) => (
                <button type="button" className="sessions-dialog-select" onClick={() => onSelect(session.id)}>
                  {session.id === activeId ? <strong>{session.name}</strong> : session.name}
                </button>
              ),
            },
            { id: 'status', header: 'Status', render: (session) => session.statusLabel },
            { id: 'updated', header: 'Updated', render: (session) => formatDateTime(session.updatedAt) },
            {
              id: 'actions',
              header: 'Actions',
              align: 'end',
              render: (session) => (
                <span className="cluster">
                  <IconButton label={`Export ${session.name}`} icon={<DownloadIcon />} size="sm" onClick={() => onExportWorkspace(session.id)} />
                  <IconButton label={`Delete ${session.name}`} icon={<TrashIcon />} size="sm" variant="danger" onClick={() => onDelete(session.id)} />
                </span>
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}
