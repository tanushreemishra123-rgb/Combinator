/**
 * Wires the shell's `HeaderBar` to the active session (name + rename), the AI-mode badge
 * (`describeAiMode`), the busy label, and the Sessions / AI-settings dialogs it opens. Also renders
 * the guided-demo action (see `GuidedDemoBar`), gated on the same prerequisite the PRD stage uses -
 * the scope must be approved before anything can be generated.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { describeAiMode } from '../../ai';
import { stagePrerequisite, useActions, useActiveSession, useAppState, useBusy } from '../../state';
import { HeaderBar } from '../../ui/shell';
import { AiSettingsContainer } from './AiSettingsContainer';
import { GuidedDemoBar } from './GuidedDemoBar';
import { SessionsContainer } from './SessionsContainer';

export function HeaderContainer(): ReactElement | null {
  const session = useActiveSession();
  const { aiSettings } = useAppState();
  const busy = useBusy();
  const actions = useActions();
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (session === null) {
    return null;
  }

  const prerequisite = stagePrerequisite(session, 'prd');

  return (
    <div className="stack stack-xs">
      <HeaderBar
        sessionName={session.name}
        onRename={(name) => actions.renameSession(session.id, name)}
        aiModeLabel={describeAiMode(aiSettings)}
        isMockMode={aiSettings.mode === 'mock'}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSessions={() => setSessionsOpen(true)}
        busyLabel={busy?.label}
      />
      <GuidedDemoBar prerequisite={prerequisite} busy={busy !== null} onRun={() => void actions.generateAll()} />
      <SessionsContainer open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
      <AiSettingsContainer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
