import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MissionDetail } from '@ai-learning-adventure/types';
import {
  makeAttempt,
  makeMissionDetail,
  makeMissionProgress,
  makeSnapshot,
  scenarioExample,
  seedCatalog,
  sortCheckpoint,
  spotCheckpoint,
  writeResponseCheckpoint,
} from './fixtures.ts';
import { renderApp, scrollIntoViewMock } from './harness.tsx';

const catalog = seedCatalog();

function detailsFor(overrides: Record<string, MissionDetail> = {}): Record<string, MissionDetail> {
  return {
    'mission-1': makeMissionDetail({ id: 'mission-1', title: 'What Is AI?' }),
    'mission-2': makeMissionDetail({ id: 'mission-2', title: 'Generative AI' }),
    ...overrides,
  };
}

async function openFirstMission(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const cta = await screen.findByRole('button', { name: /Start the adventure/ });
  await user.click(cta);
  await screen.findByRole('heading', { level: 1, name: 'What Is AI?' });
}

function progressPutCalls(fetchMock: ReturnType<typeof renderApp>['fetchMock']) {
  return fetchMock.mock.calls.filter(
    (call) => String(call[0]).includes('/missions/mission-1/progress') && call[1]?.method === 'PUT',
  );
}

describe('Mission experience', () => {
  it('renders the mission header, objective, chips, and step dots', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openFirstMission(user);

    expect(screen.getByText('Mission 1')).toBeDefined();
    expect(screen.getByText('About 10 min')).toBeDefined();
    expect(screen.getByText(/By the end of this mission/)).toBeDefined();
    expect(screen.getByText('Objective for mission-1')).toBeDefined();
    expect(screen.getByText('Beginner', { selector: '.mission-chip--difficulty' })).toBeDefined();

    const currentDot = screen.getByRole('button', { name: /Step 1 of 5: Lesson \(current step\)/ });
    expect(currentDot.getAttribute('aria-current')).toBe('step');
    expect(
      screen.getByRole('button', { name: /Step 4 of 5: Quiz \(not unlocked yet\)/ }),
    ).toBeDefined();
  });

  it('renders lesson blocks and opens the key term flashcard popover', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openFirstMission(user);

    expect(screen.getByText('AI is a broad field of computer science.')).toBeDefined();
    expect(screen.getByText('AI learns from data')).toBeDefined();
    expect(screen.getByText('Key idea')).toBeDefined();
    expect(screen.getByText('Models are only as good as their data.')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'model' }));
    const dialog = await screen.findByRole('dialog', { name: 'Flashcard for model' });
    expect(within(dialog).getByText(/trained to recognize patterns/)).toBeDefined();
    expect(within(dialog).getByText(/spam filter/)).toBeDefined();

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('navigates steps with Next/Back, arrow keys, and persists furthest step', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openFirstMission(user);

    await user.click(screen.getByRole('button', { name: 'Next: Example' }));
    await screen.findByRole('heading', { level: 2, name: 'Example' });
    expect(screen.getByText('Step 2 of 5 · Example')).toBeDefined();

    const putBodies = progressPutCalls(fetchMock).map((call) => JSON.parse(String(call[1]?.body)));
    expect(putBodies.some((body) => body.furthestStep === 'example')).toBe(true);

    await user.keyboard('{ArrowLeft}');
    await screen.findByRole('heading', { level: 2, name: 'Lesson' });

    await user.keyboard('{ArrowRight}');
    await screen.findByRole('heading', { level: 2, name: 'Example' });
  });

  it('keeps unreached step dots locked and explains why', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openFirstMission(user);

    await user.click(screen.getByRole('button', { name: /Step 3 of 5: Checkpoint \(not unlocked yet\)/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
    expect(await screen.findByText(/Finish the earlier steps first/)).toBeDefined();
  });

  it('shows the scenario layout with a reveal-takeaway disclosure', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), {
      missionDetails: detailsFor({
        'mission-1': makeMissionDetail({
          id: 'mission-1',
          title: 'What Is AI?',
          example: scenarioExample(),
        }),
      }),
    });
    await openFirstMission(user);
    await user.click(screen.getByRole('button', { name: 'Next: Example' }));

    expect(
      await screen.findByText('A teammate pastes a customer email into a public chatbot.'),
    ).toBeDefined();
    expect(screen.getByText('What could go wrong here?')).toBeDefined();

    const disclosure = screen.getByText('Reveal the takeaway');
    await user.click(disclosure);
    expect(
      screen.getByText('Personal data should never be shared with tools that log it.'),
    ).toBeDefined();
  });

  it('submits a correct checkpoint, persists it, and hands off to the quiz', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openFirstMission(user);

    await user.click(screen.getByRole('button', { name: 'Next: Example' }));
    await screen.findByRole('heading', { level: 2, name: 'Example' });
    await user.click(screen.getByRole('button', { name: 'Next: Checkpoint' }));
    await screen.findByRole('heading', { level: 2, name: 'Checkpoint' });

    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit.hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByLabelText('Write a 3-line summary for a beginner'));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/Nice work — that’s right!/)).toBeDefined();
    expect(screen.getByText('Specific prompts give the model a clear goal.')).toBeDefined();

    const putBodies = progressPutCalls(fetchMock).map((call) => JSON.parse(String(call[1]?.body)));
    expect(
      putBodies.some((body) => body.furthestStep === 'checkpoint' && body.checkpointCompleted === true),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Next: Quiz' }));
    await screen.findByRole('heading', { level: 1, name: 'What Is AI? quiz' });
    const putSteps = progressPutCalls(fetchMock).map(
      (call) => (JSON.parse(String(call[1]?.body)) as { furthestStep: string }).furthestStep,
    );
    expect(putSteps).toContain('quiz');
  });

  it('lets the learner retry an incorrect checkpoint answer', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openFirstMission(user);

    await user.click(screen.getByRole('button', { name: 'Next: Example' }));
    await screen.findByRole('heading', { level: 2, name: 'Example' });
    await user.click(screen.getByRole('button', { name: 'Next: Checkpoint' }));
    await screen.findByRole('heading', { level: 2, name: 'Checkpoint' });

    await user.click(screen.getByLabelText('Write something'));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/Not quite — take another look/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next: Quiz' }).hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('button', { name: 'Submit' }).hasAttribute('disabled')).toBe(false);
  });

  it('acknowledges a written response without grading it', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), {
      missionDetails: detailsFor({
        'mission-1': makeMissionDetail({
          id: 'mission-1',
          title: 'What Is AI?',
          checkpoint: writeResponseCheckpoint(),
        }),
      }),
    });
    await openFirstMission(user);

    await user.click(screen.getByRole('button', { name: 'Next: Example' }));
    await screen.findByRole('heading', { level: 2, name: 'Example' });
    await user.click(screen.getByRole('button', { name: 'Next: Checkpoint' }));
    await screen.findByRole('heading', { level: 2, name: 'Checkpoint' });

    await user.type(screen.getByLabelText('Your response'), 'A program that learns from data.');
    expect(screen.getByText(/\/ 2000 characters/)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText(/Thanks for putting that into words/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next: Quiz' }).hasAttribute('disabled')).toBe(false);
  });

  it('reports misplaced items in the sorting checkpoint', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), {
      missionDetails: detailsFor({
        'mission-1': makeMissionDetail({
          id: 'mission-1',
          title: 'What Is AI?',
          checkpoint: sortCheckpoint(),
        }),
      }),
    });
    await openFirstMission(user);

    await user.click(screen.getByRole('button', { name: 'Next: Example' }));
    await screen.findByRole('heading', { level: 2, name: 'Example' });
    await user.click(screen.getByRole('button', { name: 'Next: Checkpoint' }));
    await screen.findByRole('heading', { level: 2, name: 'Checkpoint' });

    await user.selectOptions(
      screen.getByLabelText('Place "Names a clear goal" into a bucket'),
      'strong',
    );
    await user.selectOptions(
      screen.getByLabelText('Place "Says “do the thing”" into a bucket'),
      'strong',
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/1 item is in the wrong bucket/)).toBeDefined();
    expect(screen.getByText('Misplaced')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await user.selectOptions(
      screen.getByLabelText('Place "Says “do the thing”" into a bucket'),
      'weak',
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText(/Every item landed in the right bucket/)).toBeDefined();
  });

  it('reveals the intended span in the spot-the-problem checkpoint', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), {
      missionDetails: detailsFor({
        'mission-1': makeMissionDetail({
          id: 'mission-1',
          title: 'What Is AI?',
          checkpoint: spotCheckpoint(),
        }),
      }),
    });
    await openFirstMission(user);

    await user.click(screen.getByRole('button', { name: 'Next: Example' }));
    await screen.findByRole('heading', { level: 2, name: 'Example' });
    await user.click(screen.getByRole('button', { name: 'Next: Checkpoint' }));
    await screen.findByRole('heading', { level: 2, name: 'Checkpoint' });

    await user.click(screen.getByRole('button', { name: 'my' }));
    await user.click(screen.getByRole('button', { name: 'password' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/You found it: “my password”/)).toBeDefined();
  });

  it('opens the tutor panel and returns a safe mock hint', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openFirstMission(user);

    await user.click(screen.getByRole('button', { name: 'Ask the tutor' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'AI Tutor' })).toBeDefined();
    expect(screen.getByText(/AI can make mistakes/)).toBeDefined();
    const explainLikeNew = screen.getByRole('checkbox', { name: /Explain like I’m new/ });
    await user.click(explainLikeNew);
    expect(screen.getByRole('radio', { name: 'Simple' }).hasAttribute('checked')).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'Deeper' }));
    expect((explainLikeNew as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('radio', { name: 'Deeper' }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Next: Example' }));
    await screen.findByRole('heading', { level: 2, name: 'Example' });
    await user.click(screen.getByRole('button', { name: 'Next: Checkpoint' }));
    await screen.findByRole('heading', { level: 2, name: 'Checkpoint' });

    await user.click(screen.getByRole('button', { name: 'Get a hint' }));
    expect(await screen.findByText(/Start by identifying the concept/)).toBeDefined();
    expect(screen.getByText(/AI can make mistakes — check the mission content/)).toBeDefined();

    // 2nd hint
    await user.click(screen.getByRole('button', { name: 'Get another hint' }));
    expect(await screen.findByText(/Focus on the words in the question/)).toBeDefined();

    // 3rd hint
    await user.click(screen.getByRole('button', { name: 'Get another hint' }));
    expect(await screen.findByText(/Look closely at the goal in the prompt/)).toBeDefined();

    // After 3 hints (3/3), the button must be disabled
    const hintButton = screen.getByRole('button', { name: 'Get another hint' });
    expect((hintButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears messages when the clear button is clicked in the inline tutor panel', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openFirstMission(user);

    await user.click(screen.getByRole('button', { name: 'Ask the tutor' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'AI Tutor' })).toBeDefined();

    const clearButton = screen.getByRole('button', { name: 'Clear' });
    expect((clearButton as HTMLButtonElement).disabled).toBe(true);

    const composer = screen.getByLabelText('Ask the tutor');
    await user.type(composer, 'Explain this concept{Enter}');

    expect(await screen.findByText('Explain this concept')).toBeDefined();
    expect(clearButton.hasAttribute('disabled')).toBe(false);
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith({ block: 'end', behavior: 'auto' });

    await user.click(clearButton);

    expect(screen.queryByText('Explain this concept')).toBeNull();
    expect(screen.getByText(/Ask about the current learning content\./)).toBeDefined();
    expect((clearButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('resumes an in-progress mission at the persisted step with the quiz unlocked', async () => {
    const user = userEvent.setup();
    const snapshot = makeSnapshot({
      missions: {
        'mission-1': makeMissionProgress('mission-1', {
          status: 'in_progress',
          furthestStep: 'checkpoint',
          checkpointCompleted: true,
        }),
      },
    });
    renderApp(catalog, snapshot, { missionDetails: detailsFor() });

    await user.click(await screen.findByRole('button', { name: /Continue your adventure/ }));
    await screen.findByRole('heading', { level: 2, name: 'Checkpoint' });
    expect(screen.getByRole('button', { name: 'Next: Quiz' }).hasAttribute('disabled')).toBe(false);
  });

  it('shows the completion panel with badges, score, and next mission', async () => {
    const user = userEvent.setup();
    const snapshot = makeSnapshot({
      missions: {
        'mission-1': makeMissionProgress('mission-1', {
          status: 'completed',
          furthestStep: 'result',
          checkpointCompleted: true,
        }),
      },
      attempts: [makeAttempt('attempt-1', 'mission-1', 80)],
      earnedAwardIds: ['award-mission-1'],
    });
    renderApp(catalog, snapshot, { missionDetails: detailsFor() });

    const shortcuts = await screen.findByRole('navigation', { name: 'More ways to learn' });
    await user.click(within(shortcuts).getByRole('button', { name: 'Explore missions' }));
    await user.click(await screen.findByRole('button', { name: /Mission 1: What Is AI\?/ }));
    await screen.findByRole('heading', { level: 1, name: 'What Is AI?' });

    await user.click(screen.getByRole('button', { name: 'Step 5 of 5: Result' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Mission complete!' })).toBeDefined();
    expect(screen.getByText('Badge for mission-1')).toBeDefined();
    expect(screen.getByText(/Best quiz score: 80%/)).toBeDefined();

    expect(screen.getByText('Why this next')).toBeDefined();
    expect(screen.getByText('Generative AI', { selector: '.recommendation-card__title' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Start mission' }));
    await screen.findByRole('heading', { level: 1, name: 'Generative AI' });
  });

  it('lists what is missing on the result step of an incomplete mission', async () => {
    const user = userEvent.setup();
    const snapshot = makeSnapshot({
      missions: {
        'mission-1': makeMissionProgress('mission-1', {
          status: 'in_progress',
          furthestStep: 'result',
        }),
      },
    });
    renderApp(catalog, snapshot, { missionDetails: detailsFor() });

    await user.click(await screen.findByRole('button', { name: /Continue your adventure/ }));
    await screen.findByRole('heading', { level: 2, name: 'Almost there' });
    expect(screen.getByText(/Checkpoint submitted/)).toBeDefined();
    expect(screen.getByText(/Quiz passed/)).toBeDefined();
  });
});
