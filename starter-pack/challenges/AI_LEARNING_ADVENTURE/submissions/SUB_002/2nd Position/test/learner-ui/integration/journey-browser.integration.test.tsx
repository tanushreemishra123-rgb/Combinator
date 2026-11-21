import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getProgress } from './helpers/api.ts';
import {
  advanceToCheckpoint,
  continueJourney,
  escapeRegExp,
  openMissionsBrowser,
  startJourney,
} from './helpers/drivers.ts';
import {
  makeCompletedProgress,
  makeMissionProgress,
  seededMissions,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();
const firstMission = seededMissions[0]!;
const secondMission = seededMissions[1]!;
const thirdMission = seededMissions[2]!;

async function expectHome(): Promise<void> {
  await screen.findByRole('heading', {
    level: 1,
    name: 'Learn AI fundamentals on a guided adventure',
  });
}

async function goHome(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const navigation = screen.getByRole('navigation', { name: 'Screen navigation' });
  await user.click(within(navigation).getByRole('button', { name: 'Home' }));
  await expectHome();
}

function missionNode(title: string): HTMLElement {
  return screen.getByRole('button', {
    name: new RegExp(`^Mission \\d+: ${escapeRegExp(title)}\\.`) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */,
  });
}

function listRow(title: string): HTMLTableRowElement {
  const titleElement = screen.getByText(title, { selector: '.mission-list__title' });
  const row = titleElement.closest('tr');
  if (row === null) throw new Error(`No mission-list row contains "${title}".`);
  return row as HTMLTableRowElement;
}

describe('journey entry and navigation', () => {
  it('JRN-01 starts a fresh learner in the first mission and persists in-progress state', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await expectHome();
    expect(screen.getByText(`${seededMissions.length} short missions`, { exact: false })).toBeDefined();
    await startJourney(user);

    expect(await screen.findByRole('heading', { level: 1, name: firstMission.title })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */).toMatchObject({
        status: 'in_progress',
        furthestStep: 'lesson',
        checkpointCompleted: false,
      });
    });
  });

  it('JRN-02 resumes the same mission at its persisted furthest step', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await expectHome();
    await startJourney(user);
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await advanceToCheckpoint(user);
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.furthestStep).toBe('checkpoint');
    });

    await goHome(user);
    expect(screen.getByRole('button', { name: /Continue your adventure/ })).toBeDefined();
    await continueJourney(user);

    expect(await screen.findByRole('heading', { level: 1, name: firstMission.title })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Checkpoint' })).toBeDefined();
  });

  it('JRN-03 continues a returning learner into the recommended next mission', async () => {
    await testContext.createWithProgress(makeCompletedProgress([firstMission.id]));
    const user = userEvent.setup();

    await expectHome();
    const continueButton = screen.getByRole('button', { name: /Continue your adventure/ });
    expect(within(continueButton).getByText(new RegExp(escapeRegExp(secondMission.title)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */)).toBeDefined();
    await user.click(continueButton);

    expect(await screen.findByRole('heading', { level: 1, name: secondMission.title })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
  });

  it('JRN-04 explores the mission map without mutating progress', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await expectHome();
    await openMissionsBrowser(user);
    expect(missionNode(firstMission.title)).toBeDefined();
    expect((await getProgress(runtime)).missions).toEqual({});
  });

  it('JRN-05 navigates Home, Missions, Review, Progress, and AI Only Mode with app history', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await expectHome();
    await openMissionsBrowser(user);
    await user.click(within(screen.getByRole('navigation', { name: 'Screen navigation' })).getByRole('button', { name: 'Back' }));
    await expectHome();

    const shortcuts = screen.getByRole('navigation', { name: 'More ways to learn' });
    await user.click(within(shortcuts).getByRole('button', { name: 'Review' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Review' })).toBeDefined();
    await goHome(user);

    await user.click(screen.getByRole('button', { name: /Open the progress dashboard/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress' })).toBeDefined();
    await goHome(user);

    await user.click(within(screen.getByRole('navigation', { name: 'More ways to learn' })).getByRole('button', { name: 'AI Only Mode' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' })).toBeDefined();
    await user.click(within(screen.getByRole('navigation', { name: 'Screen navigation' })).getByRole('button', { name: 'Back' }));
    await expectHome();
  });

  it('JRN-06 restores the persisted mission and step after a frontend remount', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await expectHome();
    await startJourney(user);
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await user.click(screen.getByRole('button', { name: 'Next: Example' }));
    await screen.findByRole('heading', { level: 2, name: 'Example' });
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.furthestStep).toBe('example');
    });

    testContext.mount(runtime);

    expect(await screen.findByRole('heading', { level: 1, name: firstMission.title })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Example' })).toBeDefined();
  });
});

describe('mission browser', () => {
  it('BRW-01 shows completed, in-progress, available, and locked mission states', async () => {
    const progress = makeCompletedProgress([firstMission.id]);
    progress.missions[secondMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ = makeMissionProgress(secondMission.id, {
      status: 'in_progress',
      furthestStep: 'example',
    });
    await testContext.createWithProgress(progress);
    const user = userEvent.setup();

    await openMissionsBrowser(user);

    expect(missionNode(firstMission.title).getAttribute('data-state')).toBe('completed');
    expect(missionNode(secondMission.title).getAttribute('data-state')).toBe('in_progress');
    expect(missionNode(thirdMission.title).getAttribute('data-state')).toBe('locked');
    expect(missionNode(thirdMission.title).getAttribute('aria-disabled')).toBe('true');
  });

  it('BRW-02 opens an available mission node', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await openMissionsBrowser(user);
    await user.click(missionNode(firstMission.title));

    expect(await screen.findByRole('heading', { level: 1, name: firstMission.title })).toBeDefined();
  });

  it('BRW-03 prevents locked mission navigation and names the prerequisite', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await openMissionsBrowser(user);
    const locked = missionNode(secondMission.title);
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    expect(locked.getAttribute('aria-label')).toContain(firstMission.title);
    await user.click(locked);

    expect(screen.getByRole('heading', { level: 1, name: 'Mission map' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: secondMission.title })).toBeNull();
  });

  it('BRW-04 toggles to List and starts a mission through its row action', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await openMissionsBrowser(user);
    await user.click(screen.getByRole('button', { name: 'List' }));
    const table = await screen.findByRole('table', { name: 'Missions with status and best scores' });
    expect(table).toBeDefined();
    await user.click(within(listRow(firstMission.title)).getByRole('button', { name: 'Start' }));

    expect(await screen.findByRole('heading', { level: 1, name: firstMission.title })).toBeDefined();
  });

  it('BRW-05 and BRW-06 intersect difficulty, track, and status filters and clear them', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await openMissionsBrowser(user);
    await user.click(screen.getByRole('button', { name: 'List' }));
    await screen.findByRole('table');
    await user.click(within(screen.getByRole('group', { name: 'Difficulty' })).getByRole('button', { name: 'Intermediate' }));
    await user.click(within(screen.getByRole('group', { name: 'Level track' })).getByRole('button', { name: 'Basic Understanding' }));
    await user.click(within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: 'Not started' }));

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Tokens and Context', { selector: '.mission-list__title' })).toBeDefined();
    expect(screen.queryByText(firstMission.title, { selector: '.mission-list__title' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear all (3)' }));
    expect(screen.getAllByRole('row')).toHaveLength(seededMissions.length + 1);
  });

  it('BRW-07 keeps active filters while switching between Map and List', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await openMissionsBrowser(user);
    await user.click(within(screen.getByRole('group', { name: 'Difficulty' })).getByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Map' }));

    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeDefined();
    expect(document.querySelectorAll('.mission-node--dimmed')).toHaveLength(seededMissions.length - 2);

    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('BRW-08 sorts the mission list by every supported sort option', async () => {
    const progress = makeCompletedProgress([firstMission.id]);
    progress.missions[secondMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ = makeMissionProgress(secondMission.id, {
      status: 'in_progress',
    });
    await testContext.createWithProgress(progress);
    const user = userEvent.setup();

    await openMissionsBrowser(user);
    await user.click(screen.getByRole('button', { name: 'List' }));
    const sort = screen.getByLabelText('Sort by');
    const expectations = [
      ['track_order', firstMission.title],
      ['title', 'Bias and Responsible AI'],
      ['difficulty', firstMission.title],
      ['progress', firstMission.title],
    ] as const;

    for (const [value, expectedFirstTitle] of expectations) {
      await user.selectOptions(sort, value);
      const firstDataRow = screen.getAllByRole('row')[1];
      expect(firstDataRow).toBeDefined();
      expect(within(firstDataRow!).getByText(expectedFirstTitle)).toBeDefined();
    }
  });

  it('BRW-09 restores the List preference after a frontend remount', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await openMissionsBrowser(user);
    await user.click(screen.getByRole('button', { name: 'List' }));
    await screen.findByRole('table');

    testContext.mount(runtime);

    expect(await screen.findByRole('table', { name: 'Missions with status and best scores' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('BRW-10 opens a completed mission with its result and prior score available', async () => {
    await testContext.createWithProgress(makeCompletedProgress([firstMission.id]));
    const user = userEvent.setup();

    await openMissionsBrowser(user);
    await user.click(missionNode(firstMission.title));
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await user.click(screen.getByRole('button', { name: /Step 5 of 5: Result/ }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Mission complete!' })).toBeDefined();
    expect(screen.getByText('Best quiz score: 100%')).toBeDefined();
  });
});
