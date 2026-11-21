import { fireEvent, render, screen } from '@testing-library/react';
import { ProvenanceBadge } from './ProvenanceBadge';
import type { Provenance } from '../../domain';

describe('ProvenanceBadge', () => {
  it.each<[Provenance, string]>([
    ['customer-stated', 'Customer-stated'],
    ['ai-inferred', 'AI-inferred'],
    ['assumed', 'Assumed'],
  ])('labels %s as "%s"', (provenance, label) => {
    render(<ProvenanceBadge provenance={provenance} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('explains the term in a tooltip revealed on focus', () => {
    render(<ProvenanceBadge provenance="assumed" />);
    const trigger = screen.getByText('Assumed').closest('[tabindex]') as HTMLElement;
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/needs human validation/i);
  });

  it('hides the tooltip again on blur', () => {
    render(<ProvenanceBadge provenance="customer-stated" />);
    const trigger = screen.getByText('Customer-stated').closest('[tabindex]') as HTMLElement;
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
