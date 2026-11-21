/**
 * Session-gated root view: the welcome screen (spec Success Definition #1 - open the application in
 * a browser) when there is no active session, otherwise the full shell with the active workspace.
 * Also keeps the browser tab title in sync with the active workspace.
 */
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { useActions, useActiveSession } from '../state';
import { useWorkspaceNavigation, workspaceLabel } from '../ui/navigation';
import { AppLayout } from '../ui/shell';
import { BusyIndicator } from './containers/BusyIndicator';
import { HeaderContainer } from './containers/HeaderContainer';
import { NoticesContainer } from './containers/NoticesContainer';
import { SidebarContainer } from './containers/SidebarContainer';
import { ErrorBoundary } from './ErrorBoundary';
import { WelcomeScreen } from './WelcomeScreen';
import { WorkspaceContainer } from './WorkspaceContainer';

const PRODUCT_NAME = 'AI Deal Scoping Assistant';

function useDocumentTitle(activeLabel: string | null): void {
  useEffect(() => {
    document.title = activeLabel === null ? PRODUCT_NAME : `${activeLabel} · ${PRODUCT_NAME}`;
  }, [activeLabel]);
}

export function AppContent(): ReactElement {
  const session = useActiveSession();
  const actions = useActions();
  const navigation = useWorkspaceNavigation();
  useDocumentTitle(session === null ? null : workspaceLabel(navigation.activeWorkspace));

  if (session === null) {
    return (
      <>
        <BusyIndicator />
        <WelcomeScreen />
      </>
    );
  }

  return (
    <>
      <BusyIndicator />
      <AppLayout sidebar={<SidebarContainer />} header={<HeaderContainer />} notices={<NoticesContainer />}>
        <ErrorBoundary onExportWorkspace={actions.exportWorkspace} onReset={() => actions.selectSession(null)}>
          <WorkspaceContainer />
        </ErrorBoundary>
      </AppLayout>
    </>
  );
}
