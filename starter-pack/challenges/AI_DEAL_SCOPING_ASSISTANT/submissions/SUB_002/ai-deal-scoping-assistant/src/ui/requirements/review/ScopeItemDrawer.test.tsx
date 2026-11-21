import { render, screen, within } from '@testing-library/react';
import type { ScopeItem } from '../../../domain';
import { fixtureScope } from '../../../test/fixtures';
import { ScopeItemDrawer } from './ScopeItemDrawer';

function itemById(id: string): ScopeItem {
  const item = fixtureScope().items.find((candidate) => candidate.id === id);
  if (item === undefined) {
    throw new Error(`Fixture item ${id} is missing`);
  }
  return item;
}

function provenanceOptionLabels(): string[] {
  const select = screen.getByLabelText('Provenance');
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

describe('ScopeItemDrawer provenance', () => {
  it('does not offer Customer-stated for an item without a verified customer source', () => {
    render(<ScopeItemDrawer open item={itemById('DEP_01')} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(provenanceOptionLabels()).not.toContain('Customer-stated');
    expect(screen.getByText(/needs a verified customer source/)).toBeInTheDocument();
  });

  it('offers Customer-stated for an item grounded in the customer text', () => {
    render(<ScopeItemDrawer open item={itemById('FR_01')} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(provenanceOptionLabels()).toContain('Customer-stated');
  });
});
