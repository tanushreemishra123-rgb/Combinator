/**
 * Behaviour tests for step 3, "Clarify missing information": gaps, assumptions and clarification
 * questions, resolving and reopening them, critical flags and the estimation inputs they affect.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ScopeItem, ScopingSession } from '../../../domain';
import { fixtureSession } from '../../../test/fixtures';
import { ClarifyStep } from './ClarifyStep';

const { mockUseActions } = vi.hoisted(() => ({ mockUseActions: vi.fn() }));

vi.mock('../../../state', () => ({ useActions: mockUseActions }));

const actions = {
  resolveScopeItem: vi.fn(),
  reopenScopeItem: vi.fn(),
};

function makeItem(overrides: Partial<ScopeItem> & Pick<ScopeItem, 'id' | 'kind'>): ScopeItem {
  return {
    title: 'Untitled',
    description: 'No description.',
    priority: 'Medium',
    provenance: 'ai-inferred',
    source: null,
    relatedIds: [],
    affectsInputs: [],
    critical: false,
    signals: [],
    review: 'pending',
    inScope: true,
    userEdited: false,
    resolved: false,
    resolution: '',
    ...overrides,
  };
}

function sessionWithClarifyItems(items: ScopeItem[]): ScopingSession {
  const session = fixtureSession();
  return { ...session, scope: session.scope === null ? null : { ...session.scope, items } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseActions.mockReturnValue(actions);
});

describe('ClarifyStep - no scope yet', () => {
  it('shows a prerequisite message instead of a blank panel', () => {
    render(<ClarifyStep session={{ ...fixtureSession(), scope: null }} />);
    expect(screen.getByText('Run the analysis first')).toBeInTheDocument();
  });
});

describe('ClarifyStep - gaps, assumptions and questions', () => {
  it('groups items under the spec-named headings and shows an empty message for a group with none', () => {
    render(
      <ClarifyStep
        session={sessionWithClarifyItems([makeItem({ id: 'GAP_01', kind: 'gap', title: 'CRM readiness unknown', critical: true })])}
      />,
    );
    expect(screen.getByText('Missing information')).toBeInTheDocument();
    expect(screen.getByText('Assumptions')).toBeInTheDocument();
    expect(screen.getByText('No assumptions were made in this analysis.')).toBeInTheDocument();
  });

  it('flags a critical item and names which estimation inputs it affects', () => {
    render(
      <ClarifyStep
        session={sessionWithClarifyItems([
          makeItem({ id: 'GAP_01', kind: 'gap', title: 'CRM readiness unknown', critical: true, affectsInputs: ['integrationReadiness'] }),
        ])}
      />,
    );
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Affects: Integration readiness')).toBeInTheDocument();
  });

  it('excludes rejected items from every group', () => {
    render(<ClarifyStep session={sessionWithClarifyItems([makeItem({ id: 'GAP_01', kind: 'gap', title: 'Rejected gap', review: 'rejected' })])} />);
    expect(screen.getByText('No gaps were identified in this analysis.')).toBeInTheDocument();
  });

  it('closes a gap with its resolution text', () => {
    render(<ClarifyStep session={sessionWithClarifyItems([makeItem({ id: 'GAP_01', kind: 'gap', title: 'CRM readiness unknown' })])} />);
    const card = screen.getByText(/CRM readiness unknown/).closest('section') as HTMLElement;
    fireEvent.change(within(card).getByRole('textbox'), { target: { value: 'Confirmed ready via a spike.' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Close gap' }));
    expect(actions.resolveScopeItem).toHaveBeenCalledWith('GAP_01', 'Confirmed ready via a spike.');
  });

  it('disables the resolve action until a resolution is entered', () => {
    render(<ClarifyStep session={sessionWithClarifyItems([makeItem({ id: 'Q_01', kind: 'question', title: 'Which identity provider?' })])} />);
    expect(screen.getByRole('button', { name: 'Answer question' })).toBeDisabled();
  });

  it('shows a resolved item as resolved and reopens it', () => {
    render(
      <ClarifyStep
        session={sessionWithClarifyItems([
          makeItem({ id: 'ASM_01', kind: 'assumption', title: 'Documents are digitised', resolved: true, resolution: 'Confirmed with the customer.' }),
        ])}
      />,
    );
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('Confirmed with the customer.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(actions.reopenScopeItem).toHaveBeenCalledWith('ASM_01');
  });
});
