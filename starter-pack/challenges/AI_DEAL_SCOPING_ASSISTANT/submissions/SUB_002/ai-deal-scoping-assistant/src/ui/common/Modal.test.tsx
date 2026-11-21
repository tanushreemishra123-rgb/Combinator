import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} title="Hidden dialog" onClose={vi.fn()}>
        Body
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog with its title and description linked for accessibility', () => {
    render(
      <Modal open title="Confirm" description="Are you sure?" onClose={vi.fn()}>
        Body content
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Confirm' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('moves focus to the first focusable element in the dialog when it opens (the header close button)', () => {
    render(
      <Modal open title="Confirm" onClose={vi.fn()}>
        <button type="button">First focusable</button>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  it('keeps focus inside the dialog while it is open (Tab wraps at the last focusable element)', () => {
    render(
      <Modal open title="Confirm" onClose={vi.fn()}>
        <button type="button">Only body button</button>
      </Modal>,
    );
    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    const bodyButton = screen.getByRole('button', { name: 'Only body button' });
    bodyButton.focus();
    fireEvent.keyDown(bodyButton, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Confirm" onClose={onClose}>
        Body
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked but not when the dialog body is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Confirm" onClose={onClose}>
        <p>Dialog body</p>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByText('Dialog body'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closing via the header close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Confirm" onClose={onClose}>
        Body
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
