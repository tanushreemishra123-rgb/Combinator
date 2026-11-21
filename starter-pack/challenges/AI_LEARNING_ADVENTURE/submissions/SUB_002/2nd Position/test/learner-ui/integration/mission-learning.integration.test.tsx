import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Checkpoint } from '@ai-learning-adventure/types';
import { getMission, getProgress } from './helpers/api.ts';
import { replaceMissionCheckpoint } from './helpers/database.ts';
import {
  advanceToCheckpoint,
  openMissionsBrowser,
  startJourney,
} from './helpers/drivers.ts';
import { seededMissions } from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();
const firstMission = seededMissions[0]!;

async function startFirstMission(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByRole('heading', {
    level: 1,
    name: 'Learn AI fundamentals on a guided adventure',
  });
  await startJourney(user);
  await screen.findByRole('heading', { level: 1, name: firstMission.title });
}

function firstMissionListRow(): HTMLTableRowElement {
  const title = screen.getByText(firstMission.title, { selector: '.mission-list__title' });
  const row = title.closest('tr');
  if (row === null) throw new Error('The first mission list row was not rendered.');
  return row as HTMLTableRowElement;
}

describe('mission learning flow', () => {
  it('MSN-01 renders mission identity, objective, metadata, and the Lesson step', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await startFirstMission(user);

    expect(screen.getByText('Mission 1')).toBeDefined();
    expect(screen.getByText(firstMission.objective, { exact: false })).toBeDefined();
    expect(screen.getByText('Beginner', { selector: '.mission-chip--difficulty' })).toBeDefined();
    expect(screen.getByText('Beginner', { selector: '.mission-chip--track' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Step 1 of 5: Lesson \(current step\)/ })).toBeDefined();
  });

  it('MSN-02 unlocks steps sequentially and persists the furthest step', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await startFirstMission(user);
    await advanceToCheckpoint(user);

    expect(screen.getByRole('heading', { level: 2, name: 'Checkpoint' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Step 3 of 5: Checkpoint \(current step\)/ })).toBeDefined();
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.furthestStep).toBe('checkpoint');
    });
  });

  it('MSN-03 navigates backward and reopens a previously visited step', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await startFirstMission(user);
    await advanceToCheckpoint(user);
    const stepBar = document.querySelector('.mission-step-bar');
    if (!(stepBar instanceof HTMLElement)) throw new Error('Mission step bar is not rendered.');
    await user.click(within(stepBar).getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Example' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: /Step 1 of 5: Lesson \(visited\)/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
  });

  it('MSN-04 keeps unreached steps locked and announces why', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await startFirstMission(user);
    const quizStep = screen.getByRole('button', { name: /Step 4 of 5: Quiz \(not unlocked yet\)/ });
    expect(quizStep.getAttribute('aria-disabled')).toBe('true');
    await user.click(quizStep);

    expect(screen.getByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
    expect(await screen.findByText(/Finish the earlier steps first/)).toBeDefined();
  });

  it('MSN-05 opens a key-term flashcard and follows it to the full deck', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);
    const keyTerm = mission.lesson.find((block) => block.type === 'key_term');
    if (keyTerm === undefined || keyTerm.type !== 'key_term') {
      throw new Error('The integration mission needs a lesson key term.');
    }
    const card = mission.flashcards.find((candidate) => candidate.id === keyTerm.flashcardId);
    if (card === undefined) throw new Error('The integration key term has no flashcard.');

    await startFirstMission(user);
    const trigger = screen.getByRole('button', { name: keyTerm.term });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: `Flashcard for ${keyTerm.term}` });
    expect(within(dialog).getByText(card.definition)).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Open the full deck' }));

    expect(await screen.findByRole('heading', { level: 1, name: `${firstMission.title} flashcards` })).toBeDefined();
    expect(screen.getByText(card.concept)).toBeDefined();
  });

  it('MSN-06 reveals the authored takeaway for a scenario example', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);
    if (mission.example.type !== 'scenario') {
      throw new Error('The first integration mission must use a scenario example.');
    }

    await startFirstMission(user);
    await user.click(screen.getByRole('button', { name: 'Next: Example' }));
    expect(await screen.findByText(mission.example.narrative)).toBeDefined();
    await user.click(screen.getByText('Reveal the takeaway'));

    expect(screen.getByText(mission.example.takeaway)).toBeDefined();
  });

  it('MSN-07 accepts the correct single-question checkpoint and unlocks Quiz', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);
    if (mission.checkpoint.kind !== 'single_question') {
      throw new Error('The first integration mission must use a single-question checkpoint.');
    }
    const correctOption = mission.checkpoint.options.find((option) => option.isCorrect);
    if (correctOption === undefined) throw new Error('The checkpoint has no correct option.');

    await startFirstMission(user);
    await advanceToCheckpoint(user);
    expect(screen.getByRole('button', { name: 'Submit' }).hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByLabelText(correctOption.text));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Nice work — that’s right!')).toBeDefined();
    expect(screen.getByText(mission.checkpoint.explanation)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next: Quiz' }).hasAttribute('disabled')).toBe(false);
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.checkpointCompleted).toBe(true);
    });
  });

  it('MSN-08 accepts a written checkpoint and returns labeled sample coaching', async () => {
    const runtime = await testContext.create({ deferRender: true });
    const checkpoint: Checkpoint = {
      kind: 'write_response',
      prompt: 'Explain artificial intelligence in your own words.',
    };
    replaceMissionCheckpoint(runtime, firstMission.id, checkpoint);
    testContext.mount(runtime);
    const user = userEvent.setup();

    await startFirstMission(user);
    await advanceToCheckpoint(user);
    await user.type(
      await screen.findByLabelText('Your response'),
      'AI systems use data or rules to perform a bounded task.',
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/Thanks for putting that into words/)).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));
    expect(await screen.findByRole('region', { name: 'AI coaching feedback' })).toBeDefined();
    expect(screen.getAllByText('Sample / mock AI response').length).toBeGreaterThan(0);
    expect(screen.getByText('What you got right')).toBeDefined();
  });

  it('MSN-09a reports misplaced items in a bucket-sorting checkpoint without a score', async () => {
    const runtime = await testContext.create({ deferRender: true });
    replaceMissionCheckpoint(runtime, firstMission.id, {
      kind: 'sort_into_buckets',
      prompt: 'Sort each prompt trait.',
      buckets: ['strong', 'weak'],
      items: [
        { id: 'clear', text: 'Names a clear goal', correctBucket: 'strong' },
        { id: 'vague', text: 'Says do the thing', correctBucket: 'weak' },
      ],
    });
    testContext.mount(runtime);
    const user = userEvent.setup();

    await startFirstMission(user);
    await advanceToCheckpoint(user);
    await user.selectOptions(await screen.findByLabelText('Place "Names a clear goal" into a bucket'), 'strong');
    await user.selectOptions(screen.getByLabelText('Place "Says do the thing" into a bucket'), 'strong');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/1 item is in the wrong bucket/)).toBeDefined();
    expect(screen.getByText('Misplaced')).toBeDefined();
    expect(document.querySelector('.score-dial')).toBeNull();
  });

  it('MSN-09b reveals the intended span in a spot-the-problem checkpoint without a score', async () => {
    const runtime = await testContext.create({ deferRender: true });
    replaceMissionCheckpoint(runtime, firstMission.id, {
      kind: 'spot_the_problem',
      prompt: 'Highlight the unsafe phrase.',
      passage: 'Never share my password with a chatbot.',
      answerRange: { start: 12, end: 23 },
    });
    testContext.mount(runtime);
    const user = userEvent.setup();

    await startFirstMission(user);
    await advanceToCheckpoint(user);
    await user.click(await screen.findByRole('button', { name: 'my' }));
    await user.click(screen.getByRole('button', { name: 'password' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/You found it: “my password”/)).toBeDefined();
    expect(document.querySelector('.score-dial')).toBeNull();
  });

  it('MSN-10 restores a submitted checkpoint and unlocked Quiz after remount', async () => {
    const runtime = await testContext.create();
    import('node:fs').then(({ writeFileSync }) => {
      writeFileSync('scratch_debug.txt', `requests: ${JSON.stringify(runtime.requestUrls)}\nserverLog: ${JSON.stringify(runtime.serverLog)}\nbody: ${document.body.innerHTML}`);
    });
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);
    if (mission.checkpoint.kind !== 'single_question') throw new Error('Expected a single-question checkpoint.');
    const correctOption = mission.checkpoint.options.find((option) => option.isCorrect)!;

    await startFirstMission(user);
    await advanceToCheckpoint(user);
    await user.click(await screen.findByLabelText(correctOption.text));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.checkpointCompleted).toBe(true);
    });

    testContext.mount(runtime);

    expect(await screen.findByRole('heading', { level: 2, name: 'Checkpoint' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next: Quiz' }).hasAttribute('disabled')).toBe(false);
  });

  it('MSN-11 returns to the prior List view and preserves started progress', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openMissionsBrowser(user);
    await user.click(screen.getByRole('button', { name: 'List' }));
    await user.click(within(firstMissionListRow()).getByRole('button', { name: 'Start' }));
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.status).toBe('in_progress');
    });

    await user.click(within(screen.getByRole('navigation', { name: 'Screen navigation' })).getByRole('button', { name: 'Back' }));

    expect(await screen.findByRole('table', { name: 'Missions with status and best scores' })).toBeDefined();
    expect(within(firstMissionListRow()).getByText('In progress')).toBeDefined();
  });
});
