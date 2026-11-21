/**
 * Behaviour tests for step 2, "Review the extracted scope": kind-group filters and search, the
 * review/priority/in-scope controls, add/edit/delete, source references (with the unverified
 * warning), related-id chips and cross-workspace focus (spec Core User Journey steps 5-6).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ScopingSession } from '../../../domain';
import { fixtureSession } from '../../../test/fixtures';
import { ReviewScopeStep } from './ReviewScopeStep';

const { mockUseActions, mockUseBusy } = vi.hoisted(() => ({ mockUseActions: vi.fn(), mockUseBusy: vi.fn() }));

vi.mock('../../../state', () => ({ useActions: mockUseActions, useBusy: mockUseBusy }));

const actions = {
  editScopeItem: vi.fn(),
  addScopeItem: vi.fn(),
  removeScopeItem: vi.fn(),
  setItemReview: vi.fn(),
};

function renderStep(session: ScopingSession, focusItemId: string | null = null) {
  const onFocusHandled = vi.fn();
  render(<ReviewScopeStep session={session} focusItemId={focusItemId} onFocusHandled={onFocusHandled} />);
  return { onFocusHandled };
}

function rowFor(id: string): HTMLElement {
  return screen.getByText(id, { selector: 'span.requirements-item-id' }).closest('tr') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseActions.mockReturnValue(actions);
  mockUseBusy.mockReturnValue(null);
});

describe('ReviewScopeStep - no scope yet', () => {
  it('shows a prerequisite message instead of a blank panel', () => {
    renderStep({ ...fixtureSession(), scope: null });
    expect(screen.getByText('Run the analysis first')).toBeInTheDocument();
  });
});

describe('ReviewScopeStep - kind groups and filtering', () => {
  it('counts every item into its spec kind group and defaults to Requirements', () => {
    renderStep(fixtureSession());
    expect(screen.getByRole('tab', { name: 'Requirements (9)', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Context (6)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Missing information (4)' })).toBeInTheDocument();
    expect(screen.getByText('FR_01')).toBeInTheDocument();
    expect(screen.queryByText('PER_01')).not.toBeInTheDocument();
  });

  it('switches to the Context group', () => {
    renderStep(fixtureSession());
    fireEvent.click(screen.getByRole('tab', { name: 'Context (6)' }));
    expect(screen.getByText('PER_01')).toBeInTheDocument();
    expect(screen.queryByText('FR_01')).not.toBeInTheDocument();
  });

  it('narrows the active group by the search box', () => {
    renderStep(fixtureSession());
    fireEvent.change(screen.getByPlaceholderText('Search title, description or id'), { target: { value: 'AI policy assistant' } });
    expect(screen.getByText('FR_03')).toBeInTheDocument();
    expect(screen.queryByText('FR_01')).not.toBeInTheDocument();
  });

  it('shows the no-matches empty state when a filter excludes everything', () => {
    renderStep(fixtureSession());
    fireEvent.change(screen.getByPlaceholderText('Search title, description or id'), { target: { value: 'no such requirement anywhere' } });
    expect(screen.getByText('No items match these filters')).toBeInTheDocument();
  });
});

describe('ReviewScopeStep - review, priority and in-scope controls', () => {
  it('approves an item', () => {
    renderStep(fixtureSession());
    fireEvent.click(within(rowFor('FR_01')).getByRole('button', { name: 'Approve FR_01' }));
    expect(actions.setItemReview).toHaveBeenCalledWith('FR_01', 'approved');
  });

  it('rejects an item', () => {
    renderStep(fixtureSession());
    fireEvent.click(within(rowFor('FR_01')).getByRole('button', { name: 'Reject FR_01' }));
    expect(actions.setItemReview).toHaveBeenCalledWith('FR_01', 'rejected');
  });

  it('changes an item priority', () => {
    renderStep(fixtureSession());
    fireEvent.change(screen.getByLabelText('Priority for FR_01'), { target: { value: 'Low' } });
    expect(actions.editScopeItem).toHaveBeenCalledWith('FR_01', { priority: 'Low' });
  });

  it('toggles an item out of scope', () => {
    renderStep(fixtureSession());
    fireEvent.click(within(rowFor('FR_01')).getByRole('switch', { name: 'In scope' }));
    expect(actions.editScopeItem).toHaveBeenCalledWith('FR_01', { inScope: false });
  });
});

describe('ReviewScopeStep - add, edit and delete', () => {
  it('adds a new scope item from the modal', () => {
    renderStep(fixtureSession());
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    const dialog = screen.getByRole('dialog', { name: 'Add a scope item' });
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: 'Support ticket export' } });
    fireEvent.change(within(dialog).getByLabelText(/^Description/), { target: { value: 'Export support tickets nightly.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add item' }));

    expect(actions.addScopeItem).toHaveBeenCalledWith('functional', {
      title: 'Support ticket export',
      description: 'Export support tickets nightly.',
      priority: 'Medium',
    });
  });

  it('edits an item through the drawer', () => {
    renderStep(fixtureSession());
    fireEvent.click(within(rowFor('FR_01')).getByRole('button', { name: 'Edit' }));

    const drawer = screen.getByRole('dialog', { name: 'Edit FR_01' });
    fireEvent.change(within(drawer).getByLabelText('Title'), { target: { value: 'Registration, SSO and profile management' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save changes' }));

    expect(actions.editScopeItem).toHaveBeenCalledWith(
      'FR_01',
      expect.objectContaining({ title: 'Registration, SSO and profile management' }),
    );
  });

  it('deletes an item after confirmation', () => {
    renderStep(fixtureSession());
    fireEvent.click(within(rowFor('FR_02')).getByRole('button', { name: 'Delete FR_02' }));

    const dialog = screen.getByRole('dialog', { name: 'Remove this scope item?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove item' }));

    expect(actions.removeScopeItem).toHaveBeenCalledWith('FR_02');
  });
});

describe('ReviewScopeStep - source references', () => {
  it('opens the source panel scrolled to and highlighting the quoted lines', () => {
    renderStep(fixtureSession());
    fireEvent.click(within(rowFor('FR_01')).getByRole('button', { name: /Functional needs/ }));

    const drawer = screen.getByRole('dialog', { name: 'Source for FR_01' });
    expect(
      within(drawer).getByText('Members must be able to register, sign in with SSO and update their profile.', { selector: 'mark' }),
    ).toBeInTheDocument();
  });

  it('warns when a source reference is unverified', () => {
    const session = fixtureSession();
    const scope = session.scope;
    expect(scope).not.toBeNull();
    const unverified = {
      ...scope!,
      items: scope!.items.map((item) => (item.id === 'FR_01' ? { ...item, source: { ...item.source!, verified: false } } : item)),
    };
    renderStep({ ...session, scope: unverified });
    expect(within(rowFor('FR_01')).getByText('Unverified against the normalized text')).toBeInTheDocument();
  });

  it('shows "No source reference" for an item without one', () => {
    const session = fixtureSession();
    const scope = session.scope;
    expect(scope).not.toBeNull();
    const noSource = { ...scope!, items: scope!.items.map((item) => (item.id === 'FR_01' ? { ...item, source: null } : item)) };
    renderStep({ ...session, scope: noSource });
    expect(within(rowFor('FR_01')).getByText('No source reference')).toBeInTheDocument();
  });
});

describe('ReviewScopeStep - related id chips and validation issues', () => {
  it('jumps to a related item and its group when its chip is clicked', () => {
    renderStep(fixtureSession());
    fireEvent.click(within(rowFor('FR_01')).getByRole('button', { name: 'Q_01' }));
    expect(screen.getByRole('tab', { name: 'Missing information (4)', selected: true })).toBeInTheDocument();
    expect(rowFor('Q_01')).toHaveClass('requirements-scope-row-highlighted');
  });

  it('shows validation issues raised by the analysis and jumps to a referenced item', () => {
    const session = fixtureSession();
    const scope = session.scope;
    expect(scope).not.toBeNull();
    const withIssue = { ...scope!, issues: [{ severity: 'warning' as const, code: 'ungrounded-claim', message: 'FR_02 could not be grounded in the customer text and was downgraded to AI-inferred.', refs: ['FR_02'] }] };
    renderStep({ ...session, scope: withIssue });

    fireEvent.click(screen.getByText(/Validation issues from this analysis/));
    expect(screen.getByText('FR_02 could not be grounded in the customer text and was downgraded to AI-inferred.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'FR_02' }));
    expect(rowFor('FR_02')).toHaveClass('requirements-scope-row-highlighted');
  });
});

describe('ReviewScopeStep - cross-workspace focus', () => {
  it('switches group, highlights the focused item and reports the focus as handled', () => {
    const { onFocusHandled } = renderStep(fixtureSession(), 'PER_01');
    expect(screen.getByRole('tab', { name: 'Context (6)', selected: true })).toBeInTheDocument();
    expect(rowFor('PER_01')).toHaveClass('requirements-scope-row-highlighted');
    expect(onFocusHandled).toHaveBeenCalled();
  });
});
