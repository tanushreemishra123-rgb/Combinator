/** Behaviour tests for the "Functional Scope" tab shell: prerequisite/empty states, the grouping
 * switcher tabs, recommended enhancements kept separate, and the out-of-scope list. */
import { fireEvent, render, screen } from '@testing-library/react';
import { FunctionalScopeTab } from './FunctionalScopeTab';
import { fixtureFunctionalScope, fixturePrdBundle } from './prdFixtures';

describe('FunctionalScopeTab', () => {
  it('shows the prerequisite message instead of a blank panel', () => {
    render(<FunctionalScopeTab bundle={null} prerequisite="Approve the scope before generating the PRD." onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Approve the scope first')).toBeInTheDocument();
  });

  it('defaults to grouping by Capability and lets the reviewer switch to Module / Workstream / Delivery package', () => {
    const bundle = fixturePrdBundle();
    render(<FunctionalScopeTab bundle={bundle} prerequisite={null} onSelectRequirement={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'By Capability', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Identity, Sign-In and Profile Management')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'By Module' }));
    expect(screen.getByRole('tab', { name: 'By Module', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Platform Foundation')).toBeInTheDocument();
  });

  it('keeps recommended enhancements visibly separate from the customer-requested scope', () => {
    const bundle = fixturePrdBundle();
    render(<FunctionalScopeTab bundle={bundle} prerequisite={null} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Recommended enhancements')).toBeInTheDocument();
    expect(screen.getByText('AI-generated recommendation')).toBeInTheDocument();
    expect(screen.getByText('Observability and Operations Dashboard')).toBeInTheDocument();
  });

  it('lists out-of-scope items and shows the label legend', () => {
    const bundle = fixturePrdBundle({
      functionalScope: fixtureFunctionalScope({ outOfScope: [{ text: 'Decommissioning the legacy CRM is out of scope.', refs: [], label: 'out-of-scope' }] }),
    });
    render(<FunctionalScopeTab bundle={bundle} prerequisite={null} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Out-of-scope items')).toBeInTheDocument();
    expect(screen.getByText('Decommissioning the legacy CRM is out of scope.')).toBeInTheDocument();
    expect(screen.getByText('Label legend')).toBeInTheDocument();
  });
});
