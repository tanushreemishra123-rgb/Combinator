/**
 * Catches a render-time crash anywhere in the active workspace tree and shows a friendly recovery
 * screen instead of a blank page. Every saved session is untouched by the crash (it lives in
 * `localStorage`, not in the component that failed), so the three recovery actions are genuinely
 * safe: reload, back up the current session, or return to the welcome screen and try again.
 */
import { Component } from 'react';
import type { ReactNode } from 'react';
import { Button, Callout } from '../ui/common';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** `null` when there is no active session to export (the export button is then hidden). */
  onExportWorkspace: (() => void) | null;
  onReset: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  public override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div className="error-boundary">
        <Callout tone="danger" title="Something went wrong in this workspace">
          This screen could not be shown. Your saved sessions are unaffected - reload the application, export the
          current session as a backup file, or return to the welcome screen and try again.
        </Callout>
        <div className="cluster">
          <Button variant="primary" onClick={this.handleReload}>
            Reload application
          </Button>
          {this.props.onExportWorkspace !== null ? (
            <Button variant="secondary" onClick={this.props.onExportWorkspace}>
              Export workspace JSON
            </Button>
          ) : null}
          <Button variant="ghost" onClick={this.props.onReset}>
            Return to welcome screen
          </Button>
        </div>
      </div>
    );
  }
}
