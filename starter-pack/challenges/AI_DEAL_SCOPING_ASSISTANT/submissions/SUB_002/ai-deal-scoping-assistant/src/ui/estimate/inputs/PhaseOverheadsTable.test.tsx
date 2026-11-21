import { fireEvent, render, screen } from '@testing-library/react';
import { createDefaultEstimationConfig } from '../../../seed';
import { PhaseOverheadsTable } from './PhaseOverheadsTable';

describe('PhaseOverheadsTable blank cells', () => {
  it('keeps the last valid overhead percentage and shows a Required hint instead of silently zeroing it', () => {
    const rows = createDefaultEstimationConfig().phaseOverheads;
    const onChange = vi.fn();
    render(<PhaseOverheadsTable rows={rows} disabled={false} onChange={onChange} />);

    const firstCell = screen.getAllByRole('spinbutton').at(0);
    if (firstCell === undefined) {
      throw new Error('expected at least one phase-overhead cell');
    }
    const committed = rows.at(0)?.pctOfBuild;

    fireEvent.change(firstCell, { target: { value: '' } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(`Required - kept at ${committed}%.`)).toBeTruthy();
  });
});
