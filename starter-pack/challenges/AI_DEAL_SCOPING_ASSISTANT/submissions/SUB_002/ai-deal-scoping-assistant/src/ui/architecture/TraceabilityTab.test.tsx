/**
 * Behaviour tests for the "Requirement traceability" tab (Success Definition 11: "Trace
 * architecture components to requirements or assumptions"): the requirement -> component table and
 * the components-without-justification warning list.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { CoverageReport } from '../../domain';
import { TraceabilityTab } from './TraceabilityTab';
import { fixtureArchitectureDesign, fixtureGenerationMeta } from './architectureFixtures';

function fixtureCoverage(overrides: Partial<CoverageReport> = {}): CoverageReport {
  return {
    rows: [
      { requirementId: 'DATA_01', title: 'Member and policy document data', kind: 'data', priority: 'Medium', capabilityIds: [], componentIds: ['ARC_01'], strategyIds: [], workstreamIds: [], covered: true },
      { requirementId: 'FR_02', title: 'Policy document search and download', kind: 'functional', priority: 'Medium', capabilityIds: ['CAP_01'], componentIds: [], strategyIds: [], workstreamIds: [], covered: true },
    ],
    links: [],
    totalRequirements: 2,
    coveredRequirements: 2,
    coveragePct: 100,
    highPriorityCoveragePct: 100,
    uncoveredIds: [],
    unsupportedAdditions: [],
    ...overrides,
  };
}

describe('TraceabilityTab', () => {
  it('shows the prerequisite message before the architecture has been generated', () => {
    render(
      <TraceabilityTab
        design={null}
        coverage={null}
        meta={null}
        prerequisite="Generate the PRD before designing the solution."
        onSelectRequirement={vi.fn()}
        onSelectComponent={vi.fn()}
      />,
    );
    expect(screen.getByText('Requirement traceability not available yet')).toBeInTheDocument();
  });

  it('lists each requirement with the architecture components that cite it, and a gap message when none does', () => {
    render(
      <TraceabilityTab
        design={fixtureArchitectureDesign()}
        coverage={fixtureCoverage()}
        meta={fixtureGenerationMeta()}
        prerequisite={null}
        onSelectRequirement={vi.fn()}
        onSelectComponent={vi.fn()}
      />,
    );
    expect(screen.getByText('Member and policy document data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ARC_01' })).toBeInTheDocument();
    expect(screen.getByText('Not cited by an architecture component')).toBeInTheDocument();
  });

  it('opens a component detail when a component chip is clicked', () => {
    const onSelectComponent = vi.fn();
    render(
      <TraceabilityTab
        design={fixtureArchitectureDesign()}
        coverage={fixtureCoverage()}
        meta={fixtureGenerationMeta()}
        prerequisite={null}
        onSelectRequirement={vi.fn()}
        onSelectComponent={onSelectComponent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ARC_01' }));
    expect(onSelectComponent).toHaveBeenCalledWith('ARC_01');
  });

  it('shows a reassuring state when every component is justified', () => {
    render(
      <TraceabilityTab
        design={fixtureArchitectureDesign()}
        coverage={fixtureCoverage()}
        meta={fixtureGenerationMeta({ issues: [] })}
        prerequisite={null}
        onSelectRequirement={vi.fn()}
        onSelectComponent={vi.fn()}
      />,
    );
    expect(screen.getByText('Every component is justified')).toBeInTheDocument();
  });

  it('lists components without justification from the generation validation issues', () => {
    render(
      <TraceabilityTab
        design={fixtureArchitectureDesign()}
        coverage={fixtureCoverage()}
        meta={fixtureGenerationMeta({
          issues: [
            { severity: 'warning', code: 'unjustified-component', message: 'ARC_03 (Search Service) cites no requirement, security need or reviewed assumption.', refs: ['ARC_03'] },
            { severity: 'info', code: 'unknown-flow-endpoint', message: 'Flow removed.', refs: [] },
          ],
        })}
        prerequisite={null}
        onSelectRequirement={vi.fn()}
        onSelectComponent={vi.fn()}
      />,
    );
    expect(screen.getByText('ARC_03 (Search Service) cites no requirement, security need or reviewed assumption.')).toBeInTheDocument();
    expect(screen.queryByText('Flow removed.')).not.toBeInTheDocument();
    expect(screen.queryByText('Every component is justified')).not.toBeInTheDocument();
  });
});
