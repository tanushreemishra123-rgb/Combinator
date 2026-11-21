/** Behaviour tests for the "Application components and cloud services" tab: prerequisite/empty states, the area filter with all 14 areas counted (so gaps are visible), and the component cards. */
import { fireEvent, render, screen } from '@testing-library/react';
import { fixtureScope } from '../../test/fixtures';
import { ComponentsTab } from './ComponentsTab';
import { fixtureApiComponent, fixtureArchitectureDesign, fixtureComponent } from './architectureFixtures';

describe('ComponentsTab', () => {
  it('shows the prerequisite message when the architecture has not been generated', () => {
    render(<ComponentsTab design={null} scope={null} prerequisite="Generate the PRD before designing the solution." onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Architecture components not available yet')).toBeInTheDocument();
    expect(screen.getByText('Generate the PRD before designing the solution.')).toBeInTheDocument();
  });

  it('shows a ready empty state when nothing blocks generation but none has happened yet', () => {
    render(<ComponentsTab design={null} scope={null} prerequisite={null} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('No architecture components yet')).toBeInTheDocument();
  });

  it('lists every one of the 14 architecture areas with a component count, including zero-count gaps', () => {
    const design = fixtureArchitectureDesign();
    render(<ComponentsTab design={design} scope={null} prerequisite={null} onSelectRequirement={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Databases and storage.*1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^APIs.*1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Backup and disaster recovery.*0/ })).toBeInTheDocument();
  });

  it('renders one card per component in the spec\'s example format', () => {
    const design = fixtureArchitectureDesign();
    render(<ComponentsTab design={design} scope={fixtureScope()} prerequisite={null} onSelectRequirement={vi.fn()} />);

    expect(screen.getByText('Primary Relational Database')).toBeInTheDocument();
    expect(screen.getByText('API Layer')).toBeInTheDocument();
    expect(screen.getByText('Azure Database for PostgreSQL - Flexible Server')).toBeInTheDocument();
    expect(screen.getByText('Provides managed relational storage with automated backups, patching and encryption at rest.')).toBeInTheDocument();
  });

  it('resolves an assumption id cited by a component to its scope-item title', () => {
    const design = fixtureArchitectureDesign({ components: [fixtureApiComponent({ assumptionIds: ['ASM_01'] })] });
    render(<ComponentsTab design={design} scope={fixtureScope()} prerequisite={null} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText(/ASM_01 - Policy documents are digitised/)).toBeInTheDocument();
  });

  it('filters the card grid by architecture area and shows a gap message when the selected area is empty', () => {
    const design = fixtureArchitectureDesign();
    render(<ComponentsTab design={design} scope={null} prerequisite={null} onSelectRequirement={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^APIs/ }));
    expect(screen.getByText('API Layer')).toBeInTheDocument();
    expect(screen.queryByText('Primary Relational Database')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Backup and disaster recovery/ }));
    expect(screen.getByText('No components in this area')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /All areas/ }));
    expect(screen.getByText('API Layer')).toBeInTheDocument();
    expect(screen.getByText('Primary Relational Database')).toBeInTheDocument();
  });

  it('navigates to the requirement workspace when a supported-requirement chip is clicked', () => {
    const onSelectRequirement = vi.fn();
    const design = fixtureArchitectureDesign({ components: [fixtureComponent()] });
    render(<ComponentsTab design={design} scope={null} prerequisite={null} onSelectRequirement={onSelectRequirement} />);
    fireEvent.click(screen.getByRole('button', { name: 'DATA_01' }));
    expect(onSelectRequirement).toHaveBeenCalledWith('DATA_01');
  });
});
