/** Behaviour tests for the "Product Requirements Document" tab: prerequisite/empty states, the
 * sticky outline, statement grounding badges and the journey step lists. */
import { fireEvent, render, screen } from '@testing-library/react';
import { DocumentTab } from './DocumentTab';
import { fixturePrdBundle } from './prdFixtures';

describe('DocumentTab', () => {
  it('shows the prerequisite message instead of a blank panel when the scope is not approved', () => {
    render(<DocumentTab bundle={null} prerequisite="Approve the scope before generating the PRD." onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Approve the scope first')).toBeInTheDocument();
    expect(screen.getByText('Approve the scope before generating the PRD.')).toBeInTheDocument();
  });

  it('shows a generate-first empty state once the prerequisite is met but nothing was generated', () => {
    render(<DocumentTab bundle={null} prerequisite={null} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText('Nothing generated yet')).toBeInTheDocument();
  });

  it('renders every PRD section title in the sticky outline', () => {
    const bundle = fixturePrdBundle();
    render(<DocumentTab bundle={bundle} prerequisite={null} onSelectRequirement={vi.fn()} />);
    const outline = screen.getByRole('navigation', { name: 'Product Requirements Document sections' });
    for (const section of bundle.prd.sections) {
      expect(outline.querySelector(`a[href="#prd-section-${section.id}"]`)).not.toBeNull();
    }
  });

  it('renders the document title and one section per PRD section, each with its content label and requirement chips', () => {
    const bundle = fixturePrdBundle();
    render(<DocumentTab bundle={bundle} prerequisite={null} onSelectRequirement={vi.fn()} />);
    expect(screen.getByText(bundle.prd.title)).toBeInTheDocument();
    expect(screen.getAllByText('Customer-requested').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'FR_01' }).length).toBeGreaterThan(0);
  });

  it('renders user journeys as persona-led step lists instead of a traced-statement list', () => {
    const bundle = fixturePrdBundle();
    render(<DocumentTab bundle={bundle} prerequisite={null} onSelectRequirement={vi.fn()} />);
    const journey = bundle.prd.journeys.at(0);
    expect(journey).toBeDefined();
    expect(screen.getByText(journey?.name ?? '')).toBeInTheDocument();
    for (const step of journey?.steps ?? []) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it('calls onSelectRequirement when a requirement chip in the document is clicked', () => {
    const onSelectRequirement = vi.fn();
    const bundle = fixturePrdBundle();
    render(<DocumentTab bundle={bundle} prerequisite={null} onSelectRequirement={onSelectRequirement} />);
    const chip = screen.getAllByRole('button', { name: 'FR_01' }).at(0);
    expect(chip).toBeDefined();
    fireEvent.click(chip as HTMLElement);
    expect(onSelectRequirement).toHaveBeenCalledWith('FR_01');
  });
});
