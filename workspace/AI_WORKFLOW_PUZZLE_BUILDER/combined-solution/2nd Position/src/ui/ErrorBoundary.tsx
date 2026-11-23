import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * A crash in one panel should not leave a reviewer staring at a blank page.
 * This shows what broke and offers a recovery that does not require devtools.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced in the UI below; kept here so the stack is inspectable in devtools.
    console.error('Workflow Puzzle Lab crashed:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  private hardReset = () => {
    try {
      localStorage.removeItem('workflow-puzzle-lab-v1');
    } catch {
      // Storage may be unavailable; reloading is still worth trying.
    }
    location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash-screen" role="alert">
        <h1>💥 Something broke</h1>
        <p className="muted">
          The lab hit an unexpected error. Your puzzle progress is stored locally and is probably fine — try dismissing
          this first.
        </p>
        <pre className="json-view">{error.message}</pre>
        <div className="modal-actions">
          <button type="button" className="btn-approve" onClick={this.reset}>
            Dismiss and continue
          </button>
          <button type="button" onClick={() => location.reload()}>
            Reload the page
          </button>
          <button type="button" className="btn-reject" onClick={this.hardReset}>
            Clear saved progress and reload
          </button>
        </div>
      </div>
    );
  }
}
