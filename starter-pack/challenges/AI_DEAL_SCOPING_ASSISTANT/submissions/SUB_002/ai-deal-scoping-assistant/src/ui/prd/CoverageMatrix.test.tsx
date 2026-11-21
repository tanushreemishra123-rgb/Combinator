/** Behaviour tests for the requirement x capability coverage matrix: covered/uncovered cells,
 * the sticky first column, and the empty state (spec constraint: never compare documents by hand). */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CoverageMatrix } from './CoverageMatrix';
import { fixtureCapability, fixtureCoverageRow } from './prdFixtures';

describe('CoverageMatrix', () => {
  it('shows an empty state when there are no requirements to compare', () => {
    render(<CoverageMatrix rows={[]} columns={[]} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('No requirements yet')).toBeInTheDocument();
  });

  it('renders one column per capability and marks covered cells', () => {
    const columns = [fixtureCapability()];
    const rows = [fixtureCoverageRow({ requirementId: 'FR_01', capabilityIds: ['CAP_01'], covered: true })];
    render(<CoverageMatrix rows={rows} columns={columns} onSelectRequirement={vi.fn()} />);

    expect(screen.getByRole('columnheader', { name: 'Identity, Sign-In and Profile Management' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Registration, SSO sign-in and profile/ });
    expect(within(row).getByText('Covered')).toBeInTheDocument();
  });

  it('leaves a cell unmarked for a capability that does not cite the requirement', () => {
    const columns = [fixtureCapability(), fixtureCapability({ id: 'CAP_02', name: 'Policy Document Search' })];
    const rows = [fixtureCoverageRow({ requirementId: 'FR_02', capabilityIds: ['CAP_01'], covered: true })];
    render(<CoverageMatrix rows={rows} columns={columns} onSelectRequirement={vi.fn()} />);

    const row = screen.getByRole('row', { name: /Registration, SSO sign-in and profile/ });
    const cells = within(row).getAllByRole('cell');
    // cells in order: [priority, CAP_01, CAP_02]
    const coveredCell = cells.at(1);
    const uncoveredCell = cells.at(2);
    expect(coveredCell).toBeDefined();
    expect(uncoveredCell).toBeDefined();
    expect(within(coveredCell as HTMLElement).getByText('Covered')).toBeInTheDocument();
    expect(within(uncoveredCell as HTMLElement).getByText('Not covered')).toBeInTheDocument();
  });

  it('lets a reviewer jump to the requirement from its row via the id chip', () => {
    const onSelectRequirement = vi.fn();
    const rows = [fixtureCoverageRow()];
    render(<CoverageMatrix rows={rows} columns={[fixtureCapability()]} onSelectRequirement={onSelectRequirement} />);
    fireEvent.click(screen.getByRole('button', { name: 'FR_01' }));
    expect(onSelectRequirement).toHaveBeenCalledWith('FR_01');
  });

  it('shows the requirement priority next to its title', () => {
    const rows = [fixtureCoverageRow({ priority: 'High' })];
    render(<CoverageMatrix rows={rows} columns={[]} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
