import { fireEvent, render, screen } from '@testing-library/react';
import { RefChips } from './RefChips';

describe('RefChips', () => {
  it('shows an empty-state message when there are no references', () => {
    render(<RefChips refs={[]} />);
    expect(screen.getByText('No references')).toBeInTheDocument();
  });

  it('renders every ref as a chip when the count is at or below the max', () => {
    render(<RefChips refs={['FR_01', 'FR_02']} max={6} />);
    expect(screen.getByText('FR_01')).toBeInTheDocument();
    expect(screen.getByText('FR_02')).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('collapses beyond max behind a "+k more" expander instead of truncating silently', () => {
    render(<RefChips refs={['FR_01', 'FR_02', 'FR_03', 'FR_04']} max={2} />);
    expect(screen.getByText('FR_01')).toBeInTheDocument();
    expect(screen.getByText('FR_02')).toBeInTheDocument();
    expect(screen.queryByText('FR_03')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('expands to show every ref once the expander is clicked, and every one is still present', () => {
    render(<RefChips refs={['FR_01', 'FR_02', 'FR_03', 'FR_04']} max={2} />);
    fireEvent.click(screen.getByText('+2 more'));
    expect(screen.getByText('FR_03')).toBeInTheDocument();
    expect(screen.getByText('FR_04')).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('calls onSelect with the chip id when a chip is clicked', () => {
    const onSelect = vi.fn();
    render(<RefChips refs={['FR_01']} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('FR_01'));
    expect(onSelect).toHaveBeenCalledWith('FR_01');
  });

  it('disables the chips when no onSelect handler is given', () => {
    render(<RefChips refs={['FR_01']} />);
    expect(screen.getByText('FR_01').closest('button')).toBeDisabled();
  });
});
