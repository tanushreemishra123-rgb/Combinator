import { fireEvent, render, screen } from '@testing-library/react';
import { createDefaultEstimationConfig } from '../../../seed';
import { CommercialConfigCard } from './CommercialConfigCard';

describe('CommercialConfigCard blank fields', () => {
  it('keeps the last valid team size and shows a Required hint instead of silently defaulting to 1', () => {
    const config = createDefaultEstimationConfig();
    const onChange = vi.fn();
    render(<CommercialConfigCard config={config} disabled={false} onChange={onChange} />);

    const teamSizeInput = screen.getByLabelText('Team size') as HTMLInputElement;
    fireEvent.change(teamSizeInput, { target: { value: '' } });

    expect(onChange).not.toHaveBeenCalled();
    expect(teamSizeInput.value).toBe('');
    expect(screen.getByText(`Required - the estimate keeps using ${config.teamSize} until a value is entered.`)).toBeTruthy();
  });

  it('commits a re-entered contingency percentage and clears the Required hint', () => {
    const config = createDefaultEstimationConfig();
    const onChange = vi.fn();
    render(<CommercialConfigCard config={config} disabled={false} onChange={onChange} />);

    const contingencyInput = screen.getByLabelText('Contingency %') as HTMLInputElement;
    fireEvent.change(contingencyInput, { target: { value: '' } });
    fireEvent.change(contingencyInput, { target: { value: '12' } });

    expect(onChange).toHaveBeenCalledWith({ contingencyPct: 12 });
    expect(screen.queryByText(/^Required/)).toBeNull();
  });
});

describe('CommercialConfigCard currency hint', () => {
  it('warns that changing currency relabels the rate card instead of converting it', () => {
    render(<CommercialConfigCard config={createDefaultEstimationConfig()} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByText(/changing it relabels the rate card - it does not convert the figures/)).toBeTruthy();
  });
});
