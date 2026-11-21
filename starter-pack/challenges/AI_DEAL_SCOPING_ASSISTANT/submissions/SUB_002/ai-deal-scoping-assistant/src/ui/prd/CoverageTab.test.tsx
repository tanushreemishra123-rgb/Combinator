/** Behaviour tests for the "Requirement Coverage" tab: prerequisite/empty states, coverage tiles,
 * the matrix, and the uncovered/unsupported lists (spec: never make the reviewer compare documents). */
import { render, screen, within } from '@testing-library/react';
import { CoverageTab } from './CoverageTab';
import { fixtureCoverageReport, fixtureCoverageRow, fixturePrdBundle, fixtureUnsupportedAddition } from './prdFixtures';

describe('CoverageTab', () => {
  it('shows the prerequisite message when the PRD has not been generated', () => {
    render(<CoverageTab bundle={null} coverage={null} prerequisite="Approve the scope before generating the PRD." onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Approve the scope first')).toBeInTheDocument();
  });

  it('shows the coverage tiles, matrix and lists once a bundle and coverage report exist', () => {
    const bundle = fixturePrdBundle();
    const coverage = fixtureCoverageReport();
    render(<CoverageTab bundle={bundle} coverage={coverage} prerequisite={null} onSelectRequirement={vi.fn()} />);

    expect(screen.getByText('Overall requirement coverage')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Requirement x capability coverage matrix')).toBeInTheDocument();
  });

  it('lists uncovered requirements so the reviewer never has to compare documents by hand', () => {
    const bundle = fixturePrdBundle();
    const coverage = fixtureCoverageReport({
      rows: [fixtureCoverageRow({ requirementId: 'FR_02', title: 'Policy document search and download', covered: false })],
      uncoveredIds: ['FR_02'],
    });
    render(<CoverageTab bundle={bundle} coverage={coverage} prerequisite={null} onSelectRequirement={vi.fn()} />);
    const uncoveredCard = screen.getByText('Uncovered requirements').closest('section') as HTMLElement;
    expect(within(uncoveredCard).getByText('Policy document search and download')).toBeInTheDocument();
  });

  it('shows a reassuring empty state when every requirement is covered', () => {
    const bundle = fixturePrdBundle();
    const coverage = fixtureCoverageReport({ rows: [fixtureCoverageRow({ covered: true })], uncoveredIds: [] });
    render(<CoverageTab bundle={bundle} coverage={coverage} prerequisite={null} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Every reviewed requirement is covered')).toBeInTheDocument();
  });

  it('lists unsupported scope additions with their reason and unknown reference ids', () => {
    const bundle = fixturePrdBundle();
    const coverage = fixtureCoverageReport({ unsupportedAdditions: [fixtureUnsupportedAddition()] });
    render(<CoverageTab bundle={bundle} coverage={coverage} prerequisite={null} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText(/Recommended enhancement "Observability and Operations Dashboard"/)).toBeInTheDocument();
    expect(screen.getByText('NFR_99')).toBeInTheDocument();
  });

  it('shows a reassuring empty state when there are no unsupported scope additions', () => {
    const bundle = fixturePrdBundle();
    const coverage = fixtureCoverageReport({ unsupportedAdditions: [] });
    render(<CoverageTab bundle={bundle} coverage={coverage} prerequisite={null} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('No unsupported scope additions')).toBeInTheDocument();
  });
});
