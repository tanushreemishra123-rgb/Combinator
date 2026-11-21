import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminEntityType } from '@ai-learning-adventure/types';

export type User = ReturnType<typeof userEvent.setup>;

const HEADINGS: Record<AdminEntityType, string> = {
  mission: 'Missions',
  question: 'Questions',
  flashcard: 'Flashcards',
  award: 'Badges & Milestones',
};

export async function waitForInventory(entityType: AdminEntityType): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: HEADINGS[entityType] }); // nosemgrep: gitlab.eslint.detect-object-injection
  await screen.findByRole('table');
  if (entityType === 'question' || entityType === 'flashcard') {
    await waitFor(() => {
      const select = screen.queryByLabelText('Filter by mission') as HTMLSelectElement | null;
      if (select && select.options.length <= 2) {
        throw new Error('Mission filter options still loading');
      }
    });
  }
}

export function rowFor(title: string): HTMLTableRowElement {
  const titleButton = screen.getByRole('button', { name: title });
  const row = titleButton.closest('tr');
  if (row === null) throw new Error(`No inventory row contains "${title}".`);
  return row as HTMLTableRowElement;
}

export async function openActions(user: User, title: string): Promise<HTMLElement> {
  await user.click(within(rowFor(title)).getByRole('button', { name: `Actions for ${title}` }));
  return screen.findByRole('menu');
}

export async function chooseAction(user: User, title: string, action: string): Promise<void> {
  const menu = await openActions(user, title);
  await user.click(within(menu).getByRole('menuitem', { name: action }));
}

export async function fillField(user: User, label: string, value: string): Promise<void> {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  await user.type(field, value);
}

export async function chooseOption(user: User, label: string, value: string): Promise<void> {
  await user.selectOptions(screen.getByLabelText(label), value);
}

export async function saveDraft(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => {
    if (screen.queryByText('Unsaved changes') !== null) throw new Error('Draft is still marked unsaved.');
  });
}

export async function openPublishDialog(user: User): Promise<HTMLElement> {
  const btn = screen.getByRole('button', { name: /Publish(?: changes|…)?$/ });
  fireEvent.click(btn);
  return screen.findByRole('dialog', { name: 'Publish content' });
}

export async function publishFromDialog(user: User, dialog: HTMLElement): Promise<void> {
  await within(dialog).findByText('No blocking issues.');
  await user.click(within(dialog).getByLabelText('I have reviewed and validated this content.'));
  await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
  await waitFor(() => {
    if (screen.queryByRole('dialog', { name: 'Publish content' }) !== null) {
      throw new Error('Publish dialog is still open.');
    }
  });
}

export async function publishCurrentItem(user: User): Promise<void> {
  await publishFromDialog(user, await openPublishDialog(user));
}
