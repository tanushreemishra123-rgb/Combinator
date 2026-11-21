import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorBoundaryState {
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[learner-ui] render error', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: undefined });
  };

  render(): ReactNode {
    if (this.state.error !== undefined) {
      return (
        <div className="app-status" role="alert">
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred while displaying the app.</p>
          <button type="button" className="app-status__retry" onClick={this.handleRetry}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
