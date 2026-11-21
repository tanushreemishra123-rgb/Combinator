/** Behaviour tests for the functional-scope grouping switcher (spec: "grouping switcher" by
 * Capability / Module / Workstream / Delivery package), including the empty state for each. */
import { render, screen } from '@testing-library/react';
import type { FunctionalScope } from '../../domain';
import { FunctionalScopeGroups } from './FunctionalScopeGroups';
import { fixtureCapability, fixtureFunctionalScope } from './prdFixtures';

describe('FunctionalScopeGroups', () => {
  it('lists capabilities flat when grouped by Capability', () => {
    const functionalScope = fixtureFunctionalScope();
    render(<FunctionalScopeGroups functionalScope={functionalScope} grouping="capability" onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Identity, Sign-In and Profile Management')).toBeInTheDocument();
  });

  it('shows an empty state when there are no capabilities at all', () => {
    const functionalScope: FunctionalScope = fixtureFunctionalScope({ capabilities: [] });
    render(<FunctionalScopeGroups functionalScope={functionalScope} grouping="capability" onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('No capabilities yet')).toBeInTheDocument();
  });

  it('groups capabilities under their module name', () => {
    const functionalScope = fixtureFunctionalScope();
    render(<FunctionalScopeGroups functionalScope={functionalScope} grouping="module" onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Platform Foundation')).toBeInTheDocument();
    expect(screen.getByText('Identity, Sign-In and Profile Management')).toBeInTheDocument();
  });

  it('groups capabilities under their workstream name', () => {
    const functionalScope = fixtureFunctionalScope();
    render(<FunctionalScopeGroups functionalScope={functionalScope} grouping="workstream" onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Identity and Access')).toBeInTheDocument();
  });

  it('shows an empty state for a grouping dimension that has no groups yet', () => {
    const functionalScope = fixtureFunctionalScope({ modules: [] });
    render(<FunctionalScopeGroups functionalScope={functionalScope} grouping="module" onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Nothing to group yet')).toBeInTheDocument();
  });

  it('shows the engagement model and suggested Topcoder challenge types on each delivery package group', () => {
    const functionalScope = fixtureFunctionalScope();
    render(<FunctionalScopeGroups functionalScope={functionalScope} grouping="package" onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Package 1 - Foundation')).toBeInTheDocument();
    expect(screen.getByText('Dedicated team')).toBeInTheDocument();
    expect(screen.getByText('Development challenge series')).toBeInTheDocument();
    expect(screen.getByText('QA / bug hunt')).toBeInTheDocument();
  });

  it('silently skips a group id that no longer resolves to a capability instead of crashing', () => {
    const functionalScope = fixtureFunctionalScope({
      modules: [{ name: 'Ghost Module', capabilityIds: ['CAP_MISSING'], requirementIds: [] }],
    });
    render(<FunctionalScopeGroups functionalScope={functionalScope} grouping="module" onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Ghost Module')).toBeInTheDocument();
    expect(screen.queryByText('CAP_MISSING')).not.toBeInTheDocument();
  });

  it('renders more than one capability under the same group', () => {
    const second = fixtureCapability({ id: 'CAP_02', name: 'Policy Document Search' });
    const functionalScope = fixtureFunctionalScope({
      capabilities: [fixtureCapability(), second],
      modules: [{ name: 'Platform Foundation', capabilityIds: ['CAP_01', 'CAP_02'], requirementIds: [] }],
    });
    render(<FunctionalScopeGroups functionalScope={functionalScope} grouping="module" onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Identity, Sign-In and Profile Management')).toBeInTheDocument();
    expect(screen.getByText('Policy Document Search')).toBeInTheDocument();
  });
});
