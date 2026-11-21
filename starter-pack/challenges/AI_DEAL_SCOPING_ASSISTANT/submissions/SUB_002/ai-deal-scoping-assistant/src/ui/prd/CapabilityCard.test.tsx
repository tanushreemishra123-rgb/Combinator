/** Behaviour tests for a single capability card rendered in the spec's example format
 * (Capability / Included Requirements / Scope / Priority / Dependencies). */
import { fireEvent, render, screen } from '@testing-library/react';
import { CapabilityCard } from './CapabilityCard';
import { fixtureCapability } from './prdFixtures';

describe('CapabilityCard', () => {
  it('renders the name, module/workstream/delivery-package placement, scope text, priority and label', () => {
    const capability = fixtureCapability();
    render(<CapabilityCard capability={capability} onSelectRequirement={vi.fn()} />);

    expect(screen.getByText(capability.name)).toBeInTheDocument();
    expect(screen.getByText('Platform Foundation • Identity and Access • Package 1 - Foundation')).toBeInTheDocument();
    expect(screen.getByText(capability.scope)).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Customer-requested')).toBeInTheDocument();
  });

  it('lists dependencies when present', () => {
    const capability = fixtureCapability({ dependencies: ['Identity provider access', 'CRM API availability'] });
    render(<CapabilityCard capability={capability} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Identity provider access')).toBeInTheDocument();
    expect(screen.getByText('CRM API availability')).toBeInTheDocument();
  });

  it('states plainly when there are no dependencies, never leaving the field blank', () => {
    const capability = fixtureCapability({ dependencies: [] });
    render(<CapabilityCard capability={capability} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('No dependencies identified.')).toBeInTheDocument();
  });

  it('shows included requirements as clickable chips and reports a click', () => {
    const onSelectRequirement = vi.fn();
    const capability = fixtureCapability({ requirementIds: ['FR_01', 'FR_02'] });
    render(<CapabilityCard capability={capability} onSelectRequirement={onSelectRequirement} />);
    fireEvent.click(screen.getByRole('button', { name: 'FR_02' }));
    expect(onSelectRequirement).toHaveBeenCalledWith('FR_02');
  });

  it('shows a message instead of an empty chip list when nothing is cited yet', () => {
    const capability = fixtureCapability({ requirementIds: [] });
    render(<CapabilityCard capability={capability} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('No requirements cited yet')).toBeInTheDocument();
  });

  it('reveals acceptance hints behind a disclosure only when there are any', () => {
    const capability = fixtureCapability({ acceptance: ['A new user can register and sign in without manual provisioning.'] });
    render(<CapabilityCard capability={capability} onSelectRequirement={vi.fn()} />);
    expect(screen.queryByText('A new user can register and sign in without manual provisioning.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Acceptance hints'));
    expect(screen.getByText('A new user can register and sign in without manual provisioning.')).toBeInTheDocument();
  });

  it('omits the acceptance disclosure entirely when there are no acceptance hints', () => {
    const capability = fixtureCapability({ acceptance: [] });
    render(<CapabilityCard capability={capability} onSelectRequirement={vi.fn()} />);
    expect(screen.queryByText('Acceptance hints')).not.toBeInTheDocument();
  });
});
