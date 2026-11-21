import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  apiErrorResponse,
  getMission,
  getProgress,
  installApiInterceptor,
  updateMissionProgress,
} from './helpers/api.ts';
import {
  completeQuiz,
  currentQuizQuestion,
  openCurrentMissionQuiz,
  selectOptionsByText,
} from './helpers/drivers.ts';
import {
  makeCompletedProgress,
  makeMissionProgress,
  makePortableProgress,
  seededMissions,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();
const firstMission = seededMissions[0]!;
const secondMission = seededMissions[1]!;

async function expectHome(): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
}

async function goHome(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const navigation = screen.getByRole('navigation', { name: 'Screen navigation' });
  await user.click(within(navigation).getByRole('button', { name: 'Home' }));
  await expectHome();
}

function quizReadyProgress() {
  return makePortableProgress({
    missions: {
      [firstMission.id]: makeMissionProgress(firstMission.id, {
        status: 'in_progress',
        furthestStep: 'quiz',
        checkpointCompleted: true,
      }),
    },
  });
}

describe('progress reset and learner isolation', () => {
  it('SET-01 confirms Start over, clears backend progress, and restores the fresh CTA', async () => {
    const runtime = await testContext.createWithProgress(makeCompletedProgress([firstMission.id]));
    const user = userEvent.setup();

    await expectHome();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Confirm progress reset' });
    expect(within(dialog).getByText(/cannot be undone/)).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Yes, reset' }));

    expect(await screen.findByRole('button', { name: 'Start the adventure' })).toBeDefined();
    await waitFor(async () => {
      const progress = await getProgress(runtime);
      expect(progress.missions).toEqual({});
      expect(progress.attempts).toEqual([]);
      expect(progress.earnedAwards).toEqual([]);
    });
  });

  it('SET-02 cancels Start over without changing persisted progress', async () => {
    const runtime = await testContext.createWithProgress(makeCompletedProgress([firstMission.id]));
    const user = userEvent.setup();

    await expectHome();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Confirm progress reset' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: /Continue your adventure/ })).toBeDefined();
    expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.status).toBe('completed');
  });

  it.todo('SET-03 exports progress through a learner-facing download control');
  it.todo('SET-04 imports a valid progress snapshot through the learner UI');
  it.todo('SET-05 rejects an invalid imported snapshot without changing progress');
  it.todo('SET-06 loads the optional sample learner progress state');

  it('SET-07 isolates two learner IDs using the same in-process API', async () => {
    const runtime = await testContext.create({ learnerId: 'integration-learner-a' });
    const user = userEvent.setup();

    await expectHome();
    await user.click(screen.getByRole('button', { name: 'Start the adventure' }));
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await waitFor(async () => {
      expect((await getProgress(runtime, 'integration-learner-a')).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */).toBeDefined();
    });
    expect((await getProgress(runtime, 'integration-learner-b')).missions).toEqual({});

    await updateMissionProgress(
      runtime,
      secondMission.id,
      { furthestStep: 'example' },
      'integration-learner-b',
    );
    expect((await getProgress(runtime, 'integration-learner-a')).missions[secondMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */).toBeUndefined();
    expect((await getProgress(runtime, 'integration-learner-b')).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */).toBeUndefined();
  });

  it('SET-08 resets one learner without changing another learner in the same database', async () => {
    const runtime = await testContext.create({
      learnerId: 'integration-reset-a',
      deferRender: true,
    });
    await updateMissionProgress(runtime, firstMission.id, { furthestStep: 'lesson' }, 'integration-reset-a');
    await updateMissionProgress(runtime, firstMission.id, { furthestStep: 'example' }, 'integration-reset-b');
    testContext.mount(runtime);
    const user = userEvent.setup();

    await expectHome();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Confirm progress reset' })).getByRole(
        'button',
        { name: 'Yes, reset' },
      ),
    );

    await waitFor(async () => {
      expect((await getProgress(runtime, 'integration-reset-a')).missions).toEqual({});
    });
    expect((await getProgress(runtime, 'integration-reset-b')).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */).toMatchObject({
      status: 'in_progress',
      furthestStep: 'example',
    });
  });
});

describe('failure recovery', () => {
  it('RES-01 presents a bootstrap error and recovers when catalog retry succeeds', async () => {
    const runtime = await testContext.create({ deferRender: true });
    const interceptor = installApiInterceptor(runtime);
    let catalogUnavailable = true;
    interceptor.block(
      (url) => url === '/api/v1/catalog',
      (url, init) =>
        catalogUnavailable
          ? apiErrorResponse(503, 'catalog_unavailable', 'Catalog temporarily unavailable.')
          : runtime.apiFetch(url, init),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Something went wrong' })).toBeDefined();
    expect(screen.getByText('Catalog temporarily unavailable.')).toBeDefined();
    catalogUnavailable = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await expectHome();
  });

  it('RES-02 reports mission loading failure without recording false completion', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    await expectHome();
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url) => url === `/api/v1/missions/${firstMission.id}`,
      () => apiErrorResponse(503, 'mission_unavailable', 'Mission temporarily unavailable.'),
    );

    await user.click(screen.getByRole('button', { name: 'Start the adventure' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'This mission could not be loaded' })).toBeDefined();
    expect(screen.getByText('Mission temporarily unavailable.')).toBeDefined();
    await waitFor(async () => {
      const progress = await getProgress(runtime);
      expect(progress.missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.status).toBe('in_progress');
      expect(progress.missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.checkpointCompleted).toBe(false);
      expect(progress.attempts).toEqual([]);
    });
  });

  it('RES-03 rolls back a failed progress mutation and announces the save failure', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    await expectHome();
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) =>
        url.includes(`/missions/${firstMission.id}/progress`) && init?.method === 'PUT',
      () => apiErrorResponse(503, 'progress_unavailable', 'Progress temporarily unavailable.'),
    );

    await user.click(screen.getByRole('button', { name: 'Start the adventure' }));
    await screen.findByRole('heading', { level: 1, name: firstMission.title });

    expect(await screen.findByText(/progress could not be saved/i)).toBeDefined();
    await waitFor(async () => expect((await getProgress(runtime)).missions).toEqual({}));
    expect(screen.getByRole('progressbar', { name: `0 of ${seededMissions.length} missions complete` })).toBeDefined();
  });

  it('RES-04 retries a failed mission request and performs one successful backend load', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    await expectHome();
    const interceptor = installApiInterceptor(runtime);
    let failNextLoad = true;
    interceptor.block(
      (url) => url === `/api/v1/missions/${firstMission.id}`,
      (url, init) => {
        if (failNextLoad) {
          failNextLoad = false;
          return apiErrorResponse(503, 'mission_unavailable', 'Try this mission again.');
        }
        return runtime.apiFetch(url, init);
      },
    );

    await user.click(screen.getByRole('button', { name: 'Start the adventure' }));
    await screen.findByRole('heading', { level: 1, name: 'This mission could not be loaded' });
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { level: 1, name: firstMission.title })).toBeDefined();
    expect(
      runtime.serverLog.filter((entry) => entry === `GET /api/v1/missions/${firstMission.id}`),
    ).toHaveLength(1);
  });
});

describe('keyboard and accessibility interactions', () => {
  it('A11Y-01 completes the primary mission path using keyboard activation', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await expectHome();
    const start = screen.getByRole('button', { name: 'Start the adventure' });
    start.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 1, name: firstMission.title });

    let next = screen.getByRole('button', { name: 'Next: Example' });
    next.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 2, name: 'Example' });
    next = screen.getByRole('button', { name: 'Next: Checkpoint' });
    next.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 2, name: 'Checkpoint' });

    if (mission.checkpoint.kind !== 'single_question') throw new Error('Keyboard case needs a single-question checkpoint.');
    const checkpointOption = screen.getByLabelText(
      mission.checkpoint.options.find((option) => option.isCorrect)!.text,
    );
    await waitFor(() => {
      checkpointOption.focus();
      expect(document.activeElement).toBe(checkpointOption);
    });
    await user.keyboard('{Space}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit' }).hasAttribute('disabled')).toBe(false);
    });
    const submitCheckpoint = screen.getByRole('button', { name: 'Submit' });
    await waitFor(() => {
      submitCheckpoint.focus();
      expect(document.activeElement).toBe(submitCheckpoint);
    });
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next: Quiz' }).hasAttribute('disabled')).toBe(false);
    });
    const openQuiz = screen.getByRole('button', { name: 'Next: Quiz' });
    openQuiz.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 1, name: `${firstMission.title} quiz` });

    for (let index = 0; index < mission.questions.length; index += 1) {
      const question = currentQuizQuestion(mission);
      const correctOptions = question.options.filter((option) => option.isCorrect);
      for (const option of correctOptions) {
        const button = screen.queryByRole('button', { name: option.text });
        const control = button ?? screen.getByLabelText(option.text);
        control.focus();
        await user.keyboard(button === null ? '{Space}' : '{Enter}');
      }
      const submit = screen.getByRole('button', { name: 'Submit answer' });
      submit.focus();
      await user.keyboard('{Enter}');
      await screen.findByText(question.correctExplanation);
      const advance = screen.getByRole('button', {
        name: index === mission.questions.length - 1 ? 'See results' : 'Next question',
      });
      advance.focus();
      await user.keyboard('{Enter}');
    }

    expect(await screen.findByText('Passed', { selector: '.result-pill' })).toBeDefined();
  });

  it('A11Y-02 moves focus into a dialog and restores it to the trigger on close', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);
    const keyTerm = mission.lesson.find((block) => block.type === 'key_term');
    if (keyTerm === undefined || keyTerm.type !== 'key_term') throw new Error('A key term is required.');

    await expectHome();
    await user.click(screen.getByRole('button', { name: 'Start the adventure' }));
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    const trigger = screen.getByRole('button', { name: keyTerm.term });
    trigger.focus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: `Flashcard for ${keyTerm.term}` });
    expect(document.activeElement).toBe(dialog);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('A11Y-03 announces an award when mission completion changes learner progress', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await expectHome();
    await user.click(screen.getByRole('button', { name: /Continue your adventure/ }));
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await openCurrentMissionQuiz(user);
    await completeQuiz(user, mission, true);

    expect(await screen.findByText(/Badge earned: AI Explorer/)).toBeDefined();
    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion?.textContent).toContain('AI Explorer');
  });

  it('A11Y-04 gives every primary learner view one identifying level-one heading', async () => {
    await testContext.create();
    const user = userEvent.setup();

    const expectSingleH1 = (name: string | RegExp) => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name })).toBeDefined();
    };

    await expectHome();
    expectSingleH1(/Learn AI fundamentals/);
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Explore missions' }));
    await screen.findByRole('heading', { level: 1, name: 'Mission map' });
    expectSingleH1('Mission map');
    await goHome(user);

    await user.click(within(screen.getByRole('navigation', { name: 'More ways to learn' })).getByRole('button', { name: 'Review' }));
    await screen.findByRole('heading', { level: 1, name: 'Review' });
    expectSingleH1('Review');
    await goHome(user);

    await user.click(screen.getByRole('button', { name: /Open the progress dashboard/ }));
    await screen.findByRole('heading', { level: 1, name: 'Progress' });
    expectSingleH1('Progress');
    await goHome(user);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expectSingleH1('Settings');
    await goHome(user);

    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'AI Only Mode' }));
    await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' });
    expectSingleH1('AI Only Mode');
  });

  it.todo('A11Y-05 enables presentation mode without mutating learner progress');
});
