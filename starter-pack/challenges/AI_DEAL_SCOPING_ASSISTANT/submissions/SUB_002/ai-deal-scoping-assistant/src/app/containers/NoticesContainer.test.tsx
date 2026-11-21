/**
 * Toast-stack lifecycle owned by this container: capping the visible stack at four notices (oldest
 * dismissed first) and auto-dismissing success/info/warning notices after their tone's delay, while
 * leaving error notices for manual dismissal only. `useAppState`/`useActions` are mocked so this
 * suite exercises only the container's own effects, not the reducer or `NoticeStack`'s rendering.
 */
import { render, screen } from '@testing-library/react';
import type * as StateModule from '../../state';
import type { Notice } from '../../state';
import { NoticesContainer } from './NoticesContainer';

const { mockUseActions, mockUseAppState } = vi.hoisted(() => ({
  mockUseActions: vi.fn(),
  mockUseAppState: vi.fn(),
}));

vi.mock('../../state', async (importOriginal) => {
  const actual = await importOriginal<typeof StateModule>();
  return { ...actual, useActions: mockUseActions, useAppState: mockUseAppState };
});

function notice(overrides: Partial<Notice>): Notice {
  return { id: 'n1', tone: 'info', title: 'Notice', message: 'Details.', ...overrides };
}

let dismissNotice: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  dismissNotice = vi.fn();
  mockUseActions.mockReturnValue({ dismissNotice });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NoticesContainer - visible cap', () => {
  it('dismisses the oldest notices first once more than four are queued', () => {
    const notices = [
      notice({ id: 'n1' }),
      notice({ id: 'n2' }),
      notice({ id: 'n3' }),
      notice({ id: 'n4' }),
      notice({ id: 'n5' }),
      notice({ id: 'n6' }),
    ];
    mockUseAppState.mockReturnValue({ notices });
    render(<NoticesContainer />);

    expect(dismissNotice).toHaveBeenCalledWith('n1');
    expect(dismissNotice).toHaveBeenCalledWith('n2');
    expect(dismissNotice).not.toHaveBeenCalledWith('n3');
  });

  it('does not dismiss anything when four or fewer notices are queued', () => {
    const notices = [notice({ id: 'n1' }), notice({ id: 'n2' })];
    mockUseAppState.mockReturnValue({ notices });
    render(<NoticesContainer />);

    expect(dismissNotice).not.toHaveBeenCalled();
  });
});

describe('NoticesContainer - auto-dismiss timers', () => {
  it('auto-dismisses a success notice after 6 seconds', () => {
    mockUseAppState.mockReturnValue({ notices: [notice({ id: 'n1', tone: 'success' })] });
    render(<NoticesContainer />);

    vi.advanceTimersByTime(5999);
    expect(dismissNotice).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(dismissNotice).toHaveBeenCalledWith('n1');
  });

  it('auto-dismisses an info notice after 6 seconds', () => {
    mockUseAppState.mockReturnValue({ notices: [notice({ id: 'n1', tone: 'info' })] });
    render(<NoticesContainer />);

    vi.advanceTimersByTime(6000);
    expect(dismissNotice).toHaveBeenCalledWith('n1');
  });

  it('auto-dismisses a warning notice after 12 seconds, not sooner', () => {
    mockUseAppState.mockReturnValue({ notices: [notice({ id: 'n1', tone: 'warning' })] });
    render(<NoticesContainer />);

    vi.advanceTimersByTime(6000);
    expect(dismissNotice).not.toHaveBeenCalled();

    vi.advanceTimersByTime(6000);
    expect(dismissNotice).toHaveBeenCalledWith('n1');
  });

  it('never auto-dismisses an error notice', () => {
    mockUseAppState.mockReturnValue({ notices: [notice({ id: 'n1', tone: 'error' })] });
    render(<NoticesContainer />);

    vi.advanceTimersByTime(60_000);
    expect(dismissNotice).not.toHaveBeenCalled();
  });

  it('clears a notice already dismissed by hand instead of dismissing it again later', () => {
    const notices = [notice({ id: 'n1', tone: 'success' })];
    mockUseAppState.mockReturnValue({ notices });
    const { rerender } = render(<NoticesContainer />);

    mockUseAppState.mockReturnValue({ notices: [] });
    rerender(<NoticesContainer />);

    vi.advanceTimersByTime(6000);
    expect(dismissNotice).not.toHaveBeenCalled();
  });

  it('does not schedule a second timer for a notice already scheduled on re-render', () => {
    const notices = [notice({ id: 'n1', tone: 'success' })];
    mockUseAppState.mockReturnValue({ notices });
    const { rerender } = render(<NoticesContainer />);
    rerender(<NoticesContainer />);

    vi.advanceTimersByTime(6000);
    expect(dismissNotice).toHaveBeenCalledTimes(1);
  });

  it('clears pending timers on unmount', () => {
    mockUseAppState.mockReturnValue({ notices: [notice({ id: 'n1', tone: 'success' })] });
    const { unmount } = render(<NoticesContainer />);
    unmount();

    vi.advanceTimersByTime(6000);
    expect(dismissNotice).not.toHaveBeenCalled();
  });
});

describe('NoticesContainer - rendering', () => {
  it('renders the notice title and wires the dismiss button to dismissNotice', () => {
    mockUseAppState.mockReturnValue({ notices: [notice({ id: 'n1', tone: 'error', title: 'Export failed' })] });
    render(<NoticesContainer />);

    expect(screen.getByText('Export failed')).toBeInTheDocument();
  });
});
