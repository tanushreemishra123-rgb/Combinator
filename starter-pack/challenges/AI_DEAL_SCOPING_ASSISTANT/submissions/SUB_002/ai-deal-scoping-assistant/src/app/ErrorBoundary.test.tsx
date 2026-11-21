/**
 * Behaviour tests for the crash-recovery screen: it must never show a blank page when a workspace
 * throws, it must offer to export the current session only when one exists, and each recovery
 * action must call exactly the callback the app wired it to.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('Simulated render crash');
}

describe('ErrorBoundary', () => {
  it('renders its children normally when nothing has crashed', () => {
    render(
      <ErrorBoundary onExportWorkspace={vi.fn()} onReset={vi.fn()}>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows a friendly recovery screen instead of a blank page when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary onExportWorkspace={vi.fn()} onReset={vi.fn()}>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong in this workspace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload application' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to welcome screen' })).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('hides the export action when there is no active session to export', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary onExportWorkspace={null} onReset={vi.fn()}>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.queryByRole('button', { name: 'Export workspace JSON' })).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('calls the export and reset callbacks from the recovery actions', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onExportWorkspace = vi.fn();
    const onReset = vi.fn();

    render(
      <ErrorBoundary onExportWorkspace={onExportWorkspace} onReset={onReset}>
        <Bomb />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export workspace JSON' }));
    expect(onExportWorkspace).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Return to welcome screen' }));
    expect(onReset).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it('reloads the application from the recovery screen', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);

    render(
      <ErrorBoundary onExportWorkspace={vi.fn()} onReset={vi.fn()}>
        <Bomb />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reload application' }));
    expect(reload).toHaveBeenCalledTimes(1);

    reload.mockRestore();
    consoleError.mockRestore();
  });
});
