import { fireEvent, render, screen } from '@testing-library/react';
import { createDefaultEstimationConfig } from '../../../seed';
import { BaseEffortTable } from './BaseEffortTable';

describe('BaseEffortTable blank cells', () => {
  it('keeps the last valid value and shows a Required hint instead of silently pricing the cell at 0', () => {
    const rows = createDefaultEstimationConfig().baseEffort;
    const onChange = vi.fn();
    render(<BaseEffortTable rows={rows} disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Base effort/ }));

    const firstCell = screen.getAllByRole('spinbutton').at(0);
    if (firstCell === undefined) {
      throw new Error('expected at least one base-effort cell');
    }
    const committed = (firstCell as HTMLInputElement).value;

    fireEvent.change(firstCell, { target: { value: '' } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(`Required - kept at ${committed}.`)).toBeTruthy();
    expect((firstCell as HTMLInputElement).value).toBe('');
  });

  it('commits a re-entered number and clears the Required hint', () => {
    const rows = createDefaultEstimationConfig().baseEffort;
    const onChange = vi.fn();
    render(<BaseEffortTable rows={rows} disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Base effort/ }));

    const firstCell = screen.getAllByRole('spinbutton').at(0);
    if (firstCell === undefined) {
      throw new Error('expected at least one base-effort cell');
    }

    fireEvent.change(firstCell, { target: { value: '' } });
    fireEvent.change(firstCell, { target: { value: '7' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^Required/)).toBeNull();
  });
});
