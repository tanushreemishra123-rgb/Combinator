import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getMission, getProgress, importProgress } from './helpers/api.ts';
import {
  advanceToCheckpoint,
  completeQuiz,
  continueJourney,
  dismissAllAwardDialogs,
  escapeRegExp,
  openCurrentMissionQuiz,
  openProgressDashboard,
  startJourney,
  startQuizFromCheckpoint,
  submitCorrectCheckpoint,
} from './helpers/drivers.ts';
import {
  FIXED_TIME,
  makeCompletedProgress,
  makeMissionProgress,
  makePortableProgress,
  makeQuizAttempt,
  seededMissions,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();
const firstMission = seededMissions[0]!;
const secondMission = seededMissions[1]!;

async function completeFirstMission(
  runtime: Awaited<ReturnType<typeof testContext.create>>,
  user: ReturnType<typeof userEvent.setup>,
) {
  const mission = await getMission(runtime, firstMission.id);
  await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
  await startJourney(user);
  await screen.findByRole('heading', { level: 1, name: firstMission.title });
  await advanceToCheckpoint(user);
  await submitCorrectCheckpoint(user, mission);
  await startQuizFromCheckpoint(user);
  await screen.findByRole('heading', { level: 1, name: `${firstMission.title} quiz` });
  await completeQuiz(user, mission, true);
  return mission;
}

function beginnerTrackReadyProgress() {
  const progress = makeCompletedProgress([firstMission.id]);
  progress.missions[secondMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ = makeMissionProgress(secondMission.id, {
    status: 'in_progress',
    furthestStep: 'quiz',
    checkpointCompleted: true,
  });
  return progress;
}

async function completeSecondMission(
  runtime: Awaited<ReturnType<typeof testContext.create>>,
  user: ReturnType<typeof userEvent.setup>,
) {
  const mission = await getMission(runtime, secondMission.id);
  await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
  await continueJourney(user);
  await screen.findByRole('heading', { level: 1, name: secondMission.title });
  await openCurrentMissionQuiz(user);
  await completeQuiz(user, mission, true);
  return mission;
}

function missionNode(title: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^Mission \\d+: ${escapeRegExp(title)}\\.`) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ });
}

describe('completion, progress, and awards', () => {
  it('PRG-01 shows mission completion and increments global completion', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await completeFirstMission(runtime, user);
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.status).toBe('completed');
    });
    await dismissAllAwardDialogs(user);
    await user.click(screen.getByRole('button', { name: 'Back to mission' }));
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await user.click(screen.getByRole('button', { name: /Step 5 of 5: Result/ }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Mission complete!' })).toBeDefined();
    expect(screen.getByRole('progressbar', { name: `1 of ${seededMissions.length} missions complete` }).getAttribute('aria-valuenow')).toBe('10');
  });

  it('PRG-02 reveals the earned mission badge once and persists it', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await completeFirstMission(runtime, user);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Badge earned!')).toBeDefined();
    expect(within(dialog).getByText('AI Explorer')).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Nice!' }));
    await dismissAllAwardDialogs(user);

    await waitFor(async () => {
      const awards = (await getProgress(runtime)).earnedAwards;
      expect(awards.filter((entry) => entry.awardId === 'award-ai-basics')).toHaveLength(1);
    });
  });

  it('PRG-03 reflects a newly completed mission and badge on the map', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await completeFirstMission(runtime, user);
    await dismissAllAwardDialogs(user);
    await user.click(screen.getByRole('button', { name: 'Explore missions' }));
    await screen.findByRole('heading', { level: 1, name: 'Mission map' });

    const node = missionNode(firstMission.title);
    expect(node.getAttribute('data-state')).toBe('completed');
    expect(node.closest('.mission-node')?.querySelector('.mission-node__badge')).not.toBeNull();
  });

  it('PRG-04 projects backend completion, scores, weak topics, level, and awards on Progress', async () => {
    const runtime = await testContext.create({ deferRender: true });
    const mission = await getMission(runtime, firstMission.id);
    const progress = makeCompletedProgress([firstMission.id]);
    progress.missions[secondMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ = makeMissionProgress(secondMission.id, {
      status: 'in_progress',
      furthestStep: 'example',
    });
    progress.flashcardRatings[mission.flashcards[0]!.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ = {
      rating: 'needs_work',
      reviewCount: 1,
      updatedAt: FIXED_TIME,
    };
    await importProgress(runtime, progress);
    testContext.mount(runtime);
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openProgressDashboard(user);

    const summary = screen.getByRole('region', { name: 'Progress summary' });
    expect(within(summary).getByText('10%', { selector: '.progress-summary__ring-label' })).toBeDefined();
    expect(summary.textContent).toContain(`1 / ${seededMissions.length}`);
    expect(summary.textContent).toContain('Beginner');
    expect(summary.textContent).toContain('Badges earned');

    const missionProgress = screen.getByRole('region', { name: 'Mission progress' });
    expect(within(missionProgress).getByText('AI Explorer')).toBeDefined();
    expect(within(missionProgress).getAllByText('100%').length).toBeGreaterThan(0);
    const nextSteps = screen.getByRole('region', { name: 'Next steps' });
    expect(within(nextSteps).getByRole('list', { name: 'Weak topics' })).toBeDefined();
  });

  it('PRG-05 advances the current level after the last Beginner mission is completed', async () => {
    const runtime = await testContext.createWithProgress(beginnerTrackReadyProgress());
    const user = userEvent.setup();

    await completeSecondMission(runtime, user);

    const banner = await screen.findByText(/You've reached/, { selector: '.level-up-banner__text' });
    expect(banner.textContent).toContain('Basic Understanding');
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[secondMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.status).toBe('completed');
    });
  });

  it('PRG-06 reveals and persists the Beginner track milestone', async () => {
    const runtime = await testContext.createWithProgress(beginnerTrackReadyProgress());
    const user = userEvent.setup();

    await completeSecondMission(runtime, user);
    let sawTrackMilestone = false;
    for (let index = 0; index < 6; index += 1) {
      const dialog = await screen.findByRole('dialog');
      if (dialog.textContent?.includes('Beginner Track Complete')) sawTrackMilestone = true;
      await user.click(within(dialog).getByRole('button', { name: 'Nice!' }));
      if (sawTrackMilestone) break;
    }

    expect(sawTrackMilestone).toBe(true);
    await waitFor(async () => {
      expect(
        (await getProgress(runtime)).earnedAwards.some(
          (entry) => entry.awardId === 'milestone-track-beginner',
        ),
      ).toBe(true);
    });
  });

  it('PRG-07 starts the recommended next mission from Home', async () => {
    await testContext.createWithProgress(makeCompletedProgress([firstMission.id]));
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    const recommendation = document.querySelector('.home-recommendation .recommendation-card');
    if (!(recommendation instanceof HTMLElement)) throw new Error('Home recommendation was not rendered.');
    expect(within(recommendation).getByText(secondMission.title)).toBeDefined();
    await user.click(within(recommendation).getByRole('button', { name: 'Start mission' }));

    expect(await screen.findByRole('heading', { level: 1, name: secondMission.title })).toBeDefined();
  });

  it('PRG-08 opens the recommended weak topic as a filtered review deck', async () => {
    const attempt = makeQuizAttempt(firstMission.id, false, 'recommendation');
    await testContext.createWithProgress(
      makePortableProgress({
        missions: {
          [firstMission.id]: makeMissionProgress(firstMission.id, {
            status: 'in_progress',
            furthestStep: 'quiz',
            checkpointCompleted: true,
          }),
        },
        attempts: [attempt],
      }),
    );
    const user = userEvent.setup();
    const topic = attempt.weakTopics[0]!;

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    const reviewBanner = screen.getByRole('note');
    expect(within(reviewBanner).getByText(`Review ${topic}`)).toBeDefined();
    await user.click(within(reviewBanner).getByRole('button', { name: 'Review this topic' }));

    expect(await screen.findByRole('heading', { level: 1, name: `Review · ${topic}` })).toBeDefined();
  });

  it('PRG-09 replaces next-mission guidance with journey-complete review guidance', async () => {
    await testContext.createWithProgress(
      makeCompletedProgress(seededMissions.map((mission) => mission.id)),
    );
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    expect(screen.getByText('You finished every mission!')).toBeDefined();
    expect(screen.queryByText('Why this next')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open review mode' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Review' })).toBeDefined();
  });
});
