import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  makeMissionDetail,
  makeMissionProgress,
  makeSnapshot,
  seedCatalog,
} from './fixtures.ts';
import { renderApp } from './harness.tsx';

const catalog = seedCatalog();

const missionDetails = {
  'mission-1': makeMissionDetail({ id: 'mission-1', title: 'What Is AI?' }),
  'mission-2': makeMissionDetail({ id: 'mission-2', title: 'Generative AI' }),
};

async function clickHomeShortcut(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
): Promise<void> {
  const shortcuts = await screen.findByRole('navigation', { name: 'More ways to learn' });
  await user.click(within(shortcuts).getByRole('button', { name }));
}

async function clickExploreMissions(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await clickHomeShortcut(user, 'Explore missions');
}

describe('Learning adventure shell', () => {
  it('shows the landing page and starts the first mission for a fresh learner', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails });

    const cta = await screen.findByRole('button', { name: /Start the adventure/ });
    expect(screen.getByText(/4 short missions/)).toBeDefined();
    expect(screen.getByText(/No account needed/)).toBeDefined();

    await user.click(cta);
    expect(await screen.findByRole('heading', { level: 1, name: 'What Is AI?' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
  });

  it('continues an in-progress mission at its furthest step', async () => {
    const user = userEvent.setup();
    const snapshot = makeSnapshot({
      missions: {
        'mission-1': makeMissionProgress('mission-1', { status: 'completed' }),
        'mission-2': makeMissionProgress('mission-2', {
          status: 'in_progress',
          furthestStep: 'checkpoint',
        }),
      },
    });
    renderApp(catalog, snapshot, { missionDetails });

    const cta = await screen.findByRole('button', { name: /Continue your adventure/ });
    expect(within(cta).getByText('Mission 2 · Generative AI')).toBeDefined();
    expect(screen.getByText('1 of 4 missions · 25%')).toBeDefined();

    await user.click(cta);
    expect(await screen.findByRole('heading', { level: 1, name: 'Generative AI' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Checkpoint' })).toBeDefined();
  });

  it('explores missions and shows every mission node on the map', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    await clickExploreMissions(user);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mission map' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Mission 1: What Is AI\?/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Mission 4: Prompt Engineering Basics/ })).toBeDefined();
  });

  it('opens AI Only Mode from the landing page', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    await clickHomeShortcut(user, 'AI Only Mode');
    expect(await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' })).toBeDefined();
  });

  it('provides Home and Back navigation that clears history on Home without scrolling focused content into view', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    expect(await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Screen navigation' })).toBeNull();
    expect(screen.queryByText('Previous screen')).toBeNull();

    const main = document.getElementById('app-main-content') as HTMLElement;
    const focusSpy = vi.spyOn(main, 'focus');
    await clickExploreMissions(user);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mission map' })).toBeDefined();
    const navigation = screen.getByRole('navigation', { name: 'Screen navigation' });
    expect(within(navigation).getByRole('button', { name: 'Home' })).toBeDefined();
    expect(within(navigation).getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(false);
    expect(navigation.closest('.app-screen')?.className).toContain('app-screen--missions');
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    focusSpy.mockRestore();

    await user.click(within(navigation).getByRole('button', { name: 'Home' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Screen navigation' })).toBeNull();

    await clickExploreMissions(user);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mission map' })).toBeDefined();
    await user.click(within(screen.getByRole('navigation', { name: 'Screen navigation' })).getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Screen navigation' })).toBeNull();
  });

  it('offers Explore missions and AI Only Mode icons in the top header', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    const header = await screen.findByRole('banner');
    await user.click(within(header).getByRole('button', { name: 'Explore missions' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Mission map' })).toBeDefined();

    await user.click(within(header).getByRole('button', { name: 'AI Only Mode' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' })).toBeDefined();
  });

  it('persists the map/list preference across the session', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    await clickExploreMissions(user);
    await user.click(await screen.findByRole('button', { name: 'List' }));

    expect(await screen.findByRole('table')).toBeDefined();
    const persisted = JSON.parse(
      localStorage.getItem('learner-ui.preferences.v1') ?? '{}',
    ) as { missionDisplay?: string };
    expect(persisted.missionDisplay).toBe('list');
  });

  it('dims map nodes that do not match intersected filters', async () => {
    const user = userEvent.setup();
    const snapshot = makeSnapshot({
      missions: {
        'mission-1': makeMissionProgress('mission-1', { status: 'completed' }),
      },
    });
    renderApp(catalog, snapshot);

    await clickExploreMissions(user);
    await screen.findByRole('button', { name: /Mission 1: What Is AI\?/ });

    await user.click(screen.getByRole('button', { name: 'Intermediate' }));
    let dimmed = document.querySelectorAll('.mission-node--dimmed');
    expect(dimmed.length).toBe(2);

    await user.click(screen.getByRole('button', { name: 'Completed' }));
    dimmed = document.querySelectorAll('.mission-node--dimmed');
    expect(dimmed.length).toBe(4);

    await user.click(screen.getByRole('button', { name: /Clear all/ }));
    dimmed = document.querySelectorAll('.mission-node--dimmed');
    expect(dimmed.length).toBe(0);
  });

  it('does not open locked missions', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    await clickExploreMissions(user);
    const locked = await screen.findByRole('button', { name: /Mission 2: Generative AI/ });
    expect(locked.getAttribute('aria-disabled')).toBe('true');

    await user.click(locked);
    expect(screen.getByRole('heading', { level: 1, name: 'Mission map' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Generative AI' })).toBeNull();
  });

  it('sorts the mission list by title', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    await clickExploreMissions(user);
    await user.click(await screen.findByRole('button', { name: 'List' }));
    const table = await screen.findByRole('table');

    await user.selectOptions(screen.getByLabelText('Sort by'), 'title');

    const firstRow = within(table).getAllByRole('row')[1];
    expect(firstRow !== undefined && within(firstRow).getByText('Generative AI')).toBeDefined();
  });

  it('shows global progress, level, and badge count in the header', async () => {
    const user = userEvent.setup();
    const snapshot = makeSnapshot({
      missions: {
        'mission-1': makeMissionProgress('mission-1', { status: 'completed' }),
        'mission-2': makeMissionProgress('mission-2', { status: 'completed' }),
      },
      earnedAwardIds: ['award-mission-1', 'award-mission-2'],
    });
    renderApp(catalog, snapshot);

    const progressbar = await screen.findByRole('progressbar', { name: '2 of 4 missions complete' });
    expect(progressbar.getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText('50%')).toBeDefined();
    expect(within(screen.getByRole('banner')).getByText('Basic Understanding')).toBeDefined();

    const badgeButton = screen.getByRole('button', {
      name: 'Badges earned: 2. Open the progress dashboard.',
    });
    await user.click(badgeButton);
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress' })).toBeDefined();
  });

  it('moves focus between map nodes with arrow keys', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    await clickExploreMissions(user);
    const first = await screen.findByRole('button', { name: /Mission 1: What Is AI\?/ });
    first.focus();

    await user.keyboard('{ArrowRight}');
    const second = screen.getByRole('button', { name: /Mission 2: Generative AI/ });
    expect(document.activeElement).toBe(second);
  });
});
