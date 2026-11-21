import { fireEvent, render, screen } from '@testing-library/react';
import { fixtureConfig } from '../../../test/fixtures';
import { SolutionAssumptionsCard } from './SolutionAssumptionsCard';

const STATED = { weeks: 39, sourceId: 'CON_01', statedAs: 'nine months' };

describe('SolutionAssumptionsCard deadline suggestion', () => {
  it('offers the customer-stated deadline while the field is empty and applies it on request', () => {
    const onChange = vi.fn();
    render(<SolutionAssumptionsCard config={fixtureConfig({ deliveryDeadlineWeeks: null })} disabled={false} statedDeadline={STATED} onChange={onChange} />);
    expect(screen.getByText(/CON_01 states a delivery window of nine months \(about 39 weeks\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use 39 weeks' }));
    expect(onChange).toHaveBeenCalledWith({ deliveryDeadlineWeeks: 39 });
  });

  it('does not suggest anything once a deadline is entered or when none is stated', () => {
    const { rerender } = render(<SolutionAssumptionsCard config={fixtureConfig({ deliveryDeadlineWeeks: 30 })} disabled={false} statedDeadline={STATED} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Use / })).toBeNull();
    rerender(<SolutionAssumptionsCard config={fixtureConfig({ deliveryDeadlineWeeks: null })} disabled={false} statedDeadline={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Use / })).toBeNull();
  });
});
