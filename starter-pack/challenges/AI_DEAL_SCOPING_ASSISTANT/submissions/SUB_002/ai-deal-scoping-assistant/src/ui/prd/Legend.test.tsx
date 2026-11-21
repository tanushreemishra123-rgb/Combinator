/** The legend must explain all five grounding labels the spec calls out, every time. */
import { render, screen } from '@testing-library/react';
import { Legend } from './Legend';

describe('Legend', () => {
  it('explains all five grounding labels', () => {
    render(<Legend />);
    expect(screen.getByText('Customer-requested')).toBeInTheDocument();
    expect(screen.getByText('AI interpretation')).toBeInTheDocument();
    expect(screen.getByText('Recommended enhancement')).toBeInTheDocument();
    expect(screen.getByText('Assumption to confirm')).toBeInTheDocument();
    expect(screen.getByText('Out of scope')).toBeInTheDocument();
    expect(screen.getByText('Directly requested by the customer in the reviewed requirements.')).toBeInTheDocument();
  });
});
