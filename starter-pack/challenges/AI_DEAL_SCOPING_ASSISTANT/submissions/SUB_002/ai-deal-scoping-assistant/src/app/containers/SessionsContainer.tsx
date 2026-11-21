/**
 * Wires the shell's `SessionsDialog` to the session use cases: switching, creating (blank or from a
 * seed scenario), deleting one or all sessions (all sessions behind a confirmation step), importing
 * an exported workspace file, and exporting any listed session (`exportWorkspace` takes the id
 * directly, so exporting a session that is not active never has to select it first).
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useActions, useAppState } from '../../state';
import { SEED_SCENARIOS } from '../../seed';
import { Button, Modal, pluralize } from '../../ui/common';
import { SessionsDialog } from '../../ui/shell';
import type { SessionScenarioOption, SessionSummary } from '../../ui/shell';
import { useWorkspaceNavigation } from '../../ui/navigation';
import { describeSessionStatus } from './sessionStatus';

export interface SessionsContainerProps {
  open: boolean;
  onClose: () => void;
}

const SCENARIO_OPTIONS: SessionScenarioOption[] = SEED_SCENARIOS.map((scenario) => ({
  id: scenario.id,
  name: scenario.name,
  tagline: scenario.tagline,
}));

function scenarioLabelFor(scenarioId: string | null): string | null {
  return scenarioId === null ? null : (SCENARIO_OPTIONS.find((option) => option.id === scenarioId)?.name ?? null);
}

export function SessionsContainer({ open, onClose }: SessionsContainerProps): ReactElement {
  const { sessions, activeSessionId } = useAppState();
  const actions = useActions();
  const navigation = useWorkspaceNavigation();
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);

  const summaries: SessionSummary[] = sessions.map((session) => ({
    id: session.id,
    name: session.name,
    updatedAt: session.updatedAt,
    statusLabel: describeSessionStatus(session),
    scenarioLabel: scenarioLabelFor(session.input.scenarioId),
  }));

  function handleExportWorkspace(id: string): void {
    actions.exportWorkspace(id);
  }

  function handleImport(file: File): void {
    void actions.importSession(file);
  }

  function handleConfirmDeleteAll(): void {
    actions.deleteAllData();
    setConfirmingDeleteAll(false);
  }

  return (
    <>
      <SessionsDialog
        open={open}
        onClose={onClose}
        sessions={summaries}
        activeId={activeSessionId}
        onSelect={(id) => {
          actions.selectSession(id);
          onClose();
        }}
        onCreate={() => {
          actions.createNewSession('Untitled scoping session');
          navigation.navigate('requirements');
          onClose();
        }}
        onCreateFromScenario={(scenarioId) => {
          actions.createSessionFromScenario(scenarioId);
          navigation.navigate('requirements');
          onClose();
        }}
        scenarios={SCENARIO_OPTIONS}
        onDelete={(id) => actions.deleteSession(id)}
        onDeleteAll={() => setConfirmingDeleteAll(true)}
        onImport={handleImport}
        onExportWorkspace={handleExportWorkspace}
      />
      <Modal
        open={confirmingDeleteAll}
        title="Delete all sessions?"
        description="This permanently deletes every saved session and AI setting in this browser. It cannot be undone."
        onClose={() => setConfirmingDeleteAll(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingDeleteAll(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteAll}>
              Delete everything
            </Button>
          </>
        }
      >
        <p>You are about to delete {pluralize(sessions.length, 'session')}.</p>
      </Modal>
    </>
  );
}
