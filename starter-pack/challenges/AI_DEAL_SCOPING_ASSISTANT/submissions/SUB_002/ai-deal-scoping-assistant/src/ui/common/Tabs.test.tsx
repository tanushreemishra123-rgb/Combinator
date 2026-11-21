import { useState } from 'react';
import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tabs } from './Tabs';
import type { TabItem } from './Tabs';

const ITEMS: TabItem[] = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two', disabled: true },
  { id: 'three', label: 'Three' },
];

function ControlledTabs(): ReactElement {
  const [activeId, setActiveId] = useState('one');
  return (
    <Tabs items={ITEMS} activeId={activeId} onChange={setActiveId} ariaLabel="Demo tabs">
      {(id) => <p>Panel: {id}</p>}
    </Tabs>
  );
}

describe('Tabs', () => {
  it('renders a tablist with one selected tab and its panel', () => {
    render(<ControlledTabs />);

    expect(screen.getByRole('tablist', { name: 'Demo tabs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel: one');
  });

  it('marks the disabled tab and never lets it become selected', () => {
    render(<ControlledTabs />);
    expect(screen.getByRole('tab', { name: 'Two' })).toBeDisabled();
  });

  it('selects a tab on click', () => {
    render(<ControlledTabs />);
    fireEvent.click(screen.getByRole('tab', { name: 'Three' }));
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel: three');
  });

  it('ArrowRight moves to the next enabled tab, skipping the disabled one', () => {
    render(<ControlledTabs />);
    const first = screen.getByRole('tab', { name: 'One' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus();
  });

  it('ArrowLeft from the first enabled tab wraps to the last enabled tab', () => {
    render(<ControlledTabs />);
    const first = screen.getByRole('tab', { name: 'One' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Home and End jump to the first and last enabled tabs', () => {
    render(<ControlledTabs />);
    const first = screen.getByRole('tab', { name: 'One' });
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true');

    const third = screen.getByRole('tab', { name: 'Three' });
    fireEvent.keyDown(third, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
  });

  it('only the selected tab is in the tab order (roving tabindex)', () => {
    render(<ControlledTabs />);
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('tabindex', '-1');
  });
});
