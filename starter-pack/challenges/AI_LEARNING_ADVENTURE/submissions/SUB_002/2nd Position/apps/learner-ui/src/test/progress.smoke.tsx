import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AwardDefinition, AwardId, CatalogDto, MissionDetail } from '@ai-learning-adventure/types';
import {
  makeAttempt,
  makeCatalog,
  makeMission,
  makeMissionDetail,
  makeMissionProgress,
  makeSnapshot,
  seedCatalog,
} from './fixtures.ts';
import { renderApp } from './harness.tsx';

const catalog = seedCatalog();

function detailsFor(overrides: Record<string, MissionDetail> = {}): Record<string, MissionDetail> {
  return {
    'mission-1': makeMissionDetail({ id: 'mission-1', title: 'What Is AI?' }),
    'mission-2': makeMissionDetail({
      id: 'mission-2',
      title: 'Generative AI',
      prerequisiteMissionId: 'mission-1',
    }),
    ...overrides,
  };
}

function passedAttempt(missionIdValue: string, scorePercent = 80) {
  return makeAttempt(`attempt-${missionIdValue}`, missionIdValue, scorePercent);
}

async function openDashboard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: /Open the progress dashboard/ }),
  );
  await screen.findByRole('heading', { level: 1, name: 'Progress' });
}

describe('progress dashboard', () => {
  it('shows hero stats and mission rows, and opens a mission from its row', async () => {
    const user = userEvent.setup();
    renderApp(
      catalog,
      makeSnapshot({
        missions: {
          'mission-1': makeMissionProgress('mission-1', {
            status: 'completed',
            furthestStep: 'result',
            checkpointCompleted: true,
          }),
          'mission-2': makeMissionProgress('mission-2', { status: 'in_progress' }),
        },
        attempts: [passedAttempt('mission-1')],
        earnedAwardIds: ['award-mission-1'],
      }),
      { missionDetails: detailsFor() },
    );
    await openDashboard(user);

    expect(screen.getByText('25%', { selector: '.progress-summary__ring-label' })).toBeDefined();
    expect(screen.getByText('Missions completed')).toBeDefined();
    expect(screen.getByText('Badges earned')).toBeDefined();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Completed')).toBeDefined();
    expect(within(table).getAllByText('80%').length).toBeGreaterThan(0);
    const missionProgress = screen.getByRole('region', { name: 'Mission progress' });
    expect(missionProgress.parentElement?.classList.contains('progress-view__grid')).toBe(true);
    expect(document.querySelectorAll('.progress-view__column')).toHaveLength(2);

    await user.click(within(table).getByRole('button', { name: 'Generative AI' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Generative AI' })).toBeDefined();
  });

  it('shows score history points with keyboard-focusable tooltips', async () => {
    const user = userEvent.setup();
    renderApp(
      catalog,
      makeSnapshot({
        attempts: [
          { ...makeAttempt('attempt-a', 'mission-1', 60), completedAt: '2026-08-01T00:00:00.000Z' as never },
          { ...makeAttempt('attempt-b', 'mission-1', 90), completedAt: '2026-08-02T00:00:00.000Z' as never },
        ],
      }),
    );
    await openDashboard(user);

    expect(
      screen.getByRole('img', { name: /Score history: 2 attempts, best score 90%/ }),
    ).toBeDefined();

    const points = document.querySelectorAll('.score-history__point');
    expect(points).toHaveLength(2);
    (points[0] as HTMLElement).focus();
    expect(await screen.findByText(/60%/, { selector: '.score-history__tooltip' })).toBeDefined();
  });

  it('opens a topic-filtered review deck from a weak topic chip', async () => {
    const user = userEvent.setup();
    const failedAttempt = {
      ...makeAttempt('attempt-failed', 'mission-1', 0),
      answers: [
        {
          questionId: 'mission-1-q1' as never,
          selectedOptionIds: ['q1-guesses'],
          isCorrect: false,
          conceptTags: ['ai-basics'],
        },
      ],
      result: 'needs_review' as const,
      weakTopics: ['ai-basics'],
    };
    renderApp(catalog, makeSnapshot({ attempts: [failedAttempt] }), {
      missionDetails: detailsFor(),
    });
    await openDashboard(user);

    const chips = screen.getByRole('list', { name: 'Weak topics' });
    await user.click(within(chips).getByRole('button', { name: /ai-basics/ }));
    expect(await screen.findByText('Review · ai-basics')).toBeDefined();
  });

  it('shows earned badges in colour and locked badges with unlock conditions', async () => {
    const user = userEvent.setup();
    renderApp(
      catalog,
      makeSnapshot({
        missions: {
          'mission-1': makeMissionProgress('mission-1', { status: 'completed' }),
        },
        earnedAwardIds: ['award-mission-1'],
      }),
    );
    await openDashboard(user);

    const collection = screen.getByRole('region', { name: 'Badge collection' });
    const earned = within(collection).getByText('Badge for mission-1');
    expect(earned).toBeDefined();
    expect(within(collection).getByText(/Earned/)).toBeDefined();

    const locked = within(collection).getByRole('listitem', {
      name: /Locked badge: Badge for mission-2/,
    });
    expect(locked.getAttribute('aria-label')).toContain('Complete the Generative AI mission');
  });

  it('shows milestone progress bars toward their thresholds', async () => {
    const user = userEvent.setup();
    const milestone: AwardDefinition = {
      id: 'milestone-half' as AwardId,
      kind: 'milestone',
      name: 'Halfway There',
      icon: 'milestone-half',
      description: 'Reached 50% of the journey complete.',
      rule: { type: 'percent_complete', minPercent: 50 },
    };
    const catalogWithMilestone: CatalogDto = {
      ...catalog,
      awards: [...catalog.awards, milestone],
    };
    renderApp(
      catalogWithMilestone,
      makeSnapshot({
        missions: {
          'mission-1': makeMissionProgress('mission-1', { status: 'completed' }),
        },
      }),
    );
    await openDashboard(user);

    const bar = screen.getByRole('progressbar', { name: /Halfway There/ });
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText('25% of 50% complete')).toBeDefined();
  });

  it('shows the next mission recommendation with a start action', async () => {
    const user = userEvent.setup();
    renderApp(
      catalog,
      makeSnapshot({
        missions: {
          'mission-1': makeMissionProgress('mission-1', {
            status: 'completed',
            furthestStep: 'result',
            checkpointCompleted: true,
          }),
        },
        attempts: [passedAttempt('mission-1')],
      }),
      { missionDetails: detailsFor() },
    );
    await openDashboard(user);

    const nextSteps = screen.getByRole('region', { name: 'Next steps' });
    expect(within(nextSteps).getByText('Why this next')).toBeDefined();
    expect(
      within(nextSteps).getByText('Generative AI', { selector: '.recommendation-card__title' }),
    ).toBeDefined();

    await user.click(within(nextSteps).getByRole('button', { name: 'Start mission' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Generative AI' })).toBeDefined();
  });

  it('offers review mode when the journey is complete', async () => {
    const user = userEvent.setup();
    const completedMissions = Object.fromEntries(
      catalog.missions.map((mission) => [
        mission.id as string,
        makeMissionProgress(mission.id as string, { status: 'completed', checkpointCompleted: true }),
      ]),
    );
    renderApp(
      catalog,
      makeSnapshot({
        missions: completedMissions,
        attempts: [passedAttempt('mission-4', 100)],
        earnedAwardIds: catalog.awards.map((award) => award.id as string),
      }),
    );
    await openDashboard(user);

    expect(screen.getByText('You finished every mission!')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Open review mode' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Review' })).toBeDefined();
  });
});

describe('award dialog and level progression', () => {
  function quizReadySnapshot() {
    return makeSnapshot({
      missions: {
        'mission-1': makeMissionProgress('mission-1', {
          status: 'in_progress',
          furthestStep: 'quiz',
          checkpointCompleted: true,
        }),
      },
    });
  }

  async function passQuiz(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /Continue your adventure/ }));
    await screen.findByRole('heading', { level: 2, name: 'Quiz' });
    await user.click(screen.getByRole('button', { name: 'Open the quiz' }));
    await screen.findByRole('heading', { level: 1, name: /quiz/ });

    await user.click(screen.getByLabelText('Data'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await user.click(screen.getByRole('button', { name: 'See results' }));
    await screen.findByText('Passed', { selector: '.result-pill' });
  }

  it('reveals earned awards one after another after the server confirms them', async () => {
    const user = userEvent.setup();
    const milestone: AwardDefinition = {
      id: 'milestone-first-steps' as AwardId,
      kind: 'milestone',
      name: 'First Steps',
      icon: 'milestone-first-steps',
      description: 'Reached 10% of the journey complete.',
      rule: { type: 'percent_complete', minPercent: 10 },
    };
    const catalogWithMilestone: CatalogDto = {
      ...catalog,
      awards: [...catalog.awards, milestone],
    };
    renderApp(catalogWithMilestone, quizReadySnapshot(), { missionDetails: detailsFor() });
    await passQuiz(user);

    const firstDialog = await screen.findByRole('dialog');
    expect(within(firstDialog).getByText('Badge earned!')).toBeDefined();
    expect(within(firstDialog).getByText('Badge for mission-1')).toBeDefined();
    await user.click(within(firstDialog).getByRole('button', { name: 'Nice!' }));

    const secondDialog = await screen.findByRole('dialog');
    expect(within(secondDialog).getByText('Milestone reached!')).toBeDefined();
    expect(within(secondDialog).getByText('First Steps')).toBeDefined();
    await user.click(within(secondDialog).getByRole('button', { name: 'Nice!' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the level-up banner once the whole track is complete', async () => {
    const user = userEvent.setup();
    const snapshot = makeSnapshot({
      missions: {
        'mission-1': makeMissionProgress('mission-1', {
          status: 'completed',
          furthestStep: 'result',
          checkpointCompleted: true,
        }),
        'mission-2': makeMissionProgress('mission-2', {
          status: 'in_progress',
          furthestStep: 'quiz',
          checkpointCompleted: true,
        }),
      },
      attempts: [passedAttempt('mission-1')],
      earnedAwardIds: ['award-mission-1'],
    });
    renderApp(catalog, snapshot, { missionDetails: detailsFor() });

    await user.click(await screen.findByRole('button', { name: /Continue your adventure/ }));
    await screen.findByRole('heading', { level: 1, name: 'Generative AI' });
    await user.click(screen.getByRole('button', { name: 'Open the quiz' }));
    await screen.findByRole('heading', { level: 1, name: /quiz/ });

    await user.click(screen.getByLabelText('Data'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await user.click(screen.getByRole('button', { name: 'See results' }));

    const bannerText = await screen.findByText(/You've reached/, {
      selector: '.level-up-banner__text',
    });
    expect(bannerText.textContent).toContain('Basic Understanding');
  });
});

describe('recommendations on home', () => {
  it('shows the next mission card for a returning learner', async () => {
    const user = userEvent.setup();
    renderApp(
      catalog,
      makeSnapshot({
        missions: {
          'mission-1': makeMissionProgress('mission-1', {
            status: 'completed',
            furthestStep: 'result',
            checkpointCompleted: true,
          }),
        },
        attempts: [passedAttempt('mission-1')],
      }),
      { missionDetails: detailsFor() },
    );

    const card = await screen.findByText('Why this next');
    expect(card).toBeDefined();
    expect(
      screen.getByText('Generative AI', { selector: '.recommendation-card__title' }),
    ).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Start mission' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Generative AI' })).toBeDefined();
  });
});
