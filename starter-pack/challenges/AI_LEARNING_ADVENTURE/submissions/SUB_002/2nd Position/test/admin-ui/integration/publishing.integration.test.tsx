import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AdminQuestionDoc } from '@ai-learning-adventure/types';
import {
  createContent,
  createValidDraft,
  getContent,
  publishHistory,
  saveContent,
} from './helpers/api.ts';
import {
  fillField,
  openPublishDialog,
  publishCurrentItem,
  publishFromDialog,
  saveDraft,
} from './helpers/drivers.ts';
import {
  firstMission,
  firstQuestion,
  makeAwardDoc,
  makeFlashcardDoc,
  makeMissionDoc,
  makeQuestionDoc,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();

describe('publish lifecycle', () => {
  it('PUB-01 publishes a valid draft and refreshes its editor status', async () => {
    const runtime = await testContext.create({ route: '/questions', deferRender: true });
    const draft = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { stem: 'Publishable integration question' }),
    );
    testContext.mount(runtime, `/questions/${draft.id}`);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Publishable integration question' });

    await publishCurrentItem(user);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Unpublish' })).toBeDefined());
    expect((await getContent(runtime, 'question', draft.id)).status).toBe('published');
  });

  it('PUB-02 saves dirty content before opening the publish gate', async () => {
    const runtime = await testContext.create({ route: '/questions', deferRender: true });
    const draft = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { stem: 'Question before publish edit' }),
    );
    testContext.mount(runtime, `/questions/${draft.id}`);
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');

    await fillField(user, 'Question stem', 'Question saved before publish');
    const dialog = await openPublishDialog(user);

    expect((await getContent<AdminQuestionDoc>(runtime, 'question', draft.id)).doc.stem).toBe(
      'Question saved before publish',
    );
    await publishFromDialog(user, dialog);
    expect((await getContent(runtime, 'question', draft.id)).status).toBe('published');
  });

  it('PUB-03 blocks publication of invalid content and shows validation issues', async () => {
    const runtime = await testContext.create({ route: '/questions', deferRender: true });
    const draft = await createContent(runtime, 'question');
    testContext.mount(runtime, `/questions/${draft.id}`);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'New question' });

    const dialog = await openPublishDialog(user);
    const issues = await within(dialog).findByRole('region', { name: 'Blocking issues' });

    expect(issues.textContent).toContain('Question stem is required.');
    expect(within(dialog).getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(true);
    expect((await getContent(runtime, 'question', draft.id)).status).toBe('draft');
  });

  it('PUB-04 cancels the publish dialog without changing status', async () => {
    const runtime = await testContext.create({ route: '/questions', deferRender: true });
    const draft = await createValidDraft(runtime, 'question', makeQuestionDoc);
    testContext.mount(runtime, `/questions/${draft.id}`);
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');

    const dialog = await openPublishDialog(user);
    await within(dialog).findByText('No blocking issues.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Publish content' })).toBeNull();
    expect((await getContent(runtime, 'question', draft.id)).status).toBe('draft');
  });

  it('PUB-05 marks saved edits to published content as published with changes', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');

    await fillField(user, 'Question stem', 'Published question with a draft change');
    await saveDraft(user);

    expect((await getContent(runtime, 'question', firstQuestion.id)).status).toBe('published_changed');
    expect(screen.getByText('Published · changes')).toBeDefined();
  });

  it('PUB-06 republishes changed content and updates its published state', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');
    await fillField(user, 'Question stem', 'Republished integration question');
    await saveDraft(user);

    await publishCurrentItem(user);

    const persisted = await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id);
    expect(persisted.status).toBe('published');
    expect(persisted.publishedRevision).toBe(persisted.revision);
    expect(persisted.doc.stem).toBe('Republished integration question');
  });

  it('PUB-07 PUB-08 cancels and then confirms unpublishing', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Unpublish' });

    await user.click(screen.getByRole('button', { name: 'Unpublish' }));
    let dialog = await screen.findByRole('dialog', { name: 'Unpublish this question?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect((await getContent(runtime, 'question', firstQuestion.id)).status).toBe('published');

    await user.click(screen.getByRole('button', { name: 'Unpublish' }));
    dialog = await screen.findByRole('dialog', { name: 'Unpublish this question?' });
    await user.click(within(dialog).getByRole('button', { name: 'Unpublish' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish…' })).toBeDefined());
    expect((await getContent(runtime, 'question', firstQuestion.id)).status).toBe('draft');
  });

  it('PUB-09 publishes a mission and its eligible dependent drafts together', async () => {
    const runtime = await testContext.create({ route: '/missions', deferRender: true });
    const mission = await createValidDraft(runtime, 'mission', (id) =>
      makeMissionDoc(id, { title: 'Mission with dependent drafts' }),
    );
    const question = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { missionId: mission.id, stem: 'Dependent draft question' }),
    );
    const flashcard = await createValidDraft(runtime, 'flashcard', (id) =>
      makeFlashcardDoc(id, { missionId: mission.id, concept: 'Dependent draft card' }),
    );
    const award = await createValidDraft(runtime, 'award', (id) =>
      makeAwardDoc(id, {
        missionId: mission.id,
        name: 'Dependent draft badge',
        rule: { type: 'mission_completed', missionId: mission.id as never },
      }),
    );
    testContext.mount(runtime, `/missions/${mission.id}`);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Mission with dependent drafts' });

    const dialog = await openPublishDialog(user);
    expect(
      within(dialog).getByLabelText('Publish linked draft questions, flashcards, and awards together'),
    ).toBeDefined();
    await publishFromDialog(user, dialog);

    for (const [type, id] of [
      ['mission', mission.id],
      ['question', question.id],
      ['flashcard', flashcard.id],
      ['award', award.id],
    ] as const) {
      expect((await getContent(runtime, type, id)).status).toBe('published');
    }
  });

  it('PUB-10 leaves dependent drafts unpublished when their inclusion is cleared', async () => {
    const runtime = await testContext.create({ route: '/missions', deferRender: true });
    const mission = await createValidDraft(runtime, 'mission', (id) =>
      makeMissionDoc(id, { title: 'Mission without dependent publication' }),
    );
    const question = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { missionId: mission.id, stem: 'Draft remains unpublished' }),
    );
    const flashcard = await createValidDraft(runtime, 'flashcard', (id) =>
      makeFlashcardDoc(id, { missionId: mission.id, concept: 'Card remains unpublished' }),
    );
    testContext.mount(runtime, `/missions/${mission.id}`);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Mission without dependent publication' });

    const dialog = await openPublishDialog(user);
    await user.click(
      within(dialog).getByLabelText('Publish linked draft questions, flashcards, and awards together'),
    );
    await publishFromDialog(user, dialog);

    expect((await getContent(runtime, 'mission', mission.id)).status).toBe('published');
    expect((await getContent(runtime, 'question', question.id)).status).toBe('draft');
    expect((await getContent(runtime, 'flashcard', flashcard.id)).status).toBe('draft');
  });

  it('PUB-11 reports a revision conflict raised while the publish dialog is open', async () => {
    const runtime = await testContext.create({ route: '/questions', deferRender: true });
    const draft = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { stem: 'Publish conflict question' }),
    );
    testContext.mount(runtime, `/questions/${draft.id}`);
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');
    const dialog = await openPublishDialog(user);
    await within(dialog).findByText('No blocking issues.');

    const current = await getContent<AdminQuestionDoc>(runtime, 'question', draft.id);
    await saveContent(
      runtime,
      'question',
      draft.id,
      { ...current.doc, stem: 'Newer server-side question' },
      current.revision,
    );
    await user.click(within(dialog).getByLabelText('I have reviewed and validated this content.'));
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));

    expect(await within(dialog).findByRole('alert')).toHaveProperty(
      'textContent',
      'The content changed while the publish dialog was open. Close and reopen the editor.',
    );
    expect((await getContent(runtime, 'question', draft.id)).status).toBe('draft');
  });

  it('PUB-12 requests a preview token and renders the learner preview URL', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: firstMission.title });

    await user.click(screen.getByRole('button', { name: 'Preview' }));
    const dialog = await screen.findByRole('dialog', { name: 'Learner preview' });
    const frame = await within(dialog).findByTitle('Learner preview');

    expect(frame.getAttribute('src')).toMatch(/^http:\/\/localhost:5173\/\?preview=.+/);
    expect(runtime.serverLog.some((entry) => entry === 'POST /api/v1/admin/preview')).toBe(true);
  });

  it('PUB-13 records successive publish and unpublish events', async () => {
    const runtime = await testContext.create({ route: '/questions', deferRender: true });
    const draft = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { stem: 'Question with publish history' }),
    );
    testContext.mount(runtime, `/questions/${draft.id}`);
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');

    await publishCurrentItem(user);
    await user.click(await screen.findByRole('button', { name: 'Unpublish' }));
    const unpublishDialog = await screen.findByRole('dialog', { name: 'Unpublish this question?' });
    await user.click(within(unpublishDialog).getByRole('button', { name: 'Unpublish' }));
    await screen.findByRole('button', { name: 'Publish…' });
    await publishCurrentItem(user);

    expect((await publishHistory(runtime, 'question', draft.id)).map((entry) => entry.action)).toEqual([
      'publish',
      'unpublish',
      'publish',
    ]);
  });
});
