import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type {
  AdminAwardDoc,
  AdminEntityType,
  AdminFlashcardDoc,
  AdminMissionDoc,
  AdminQuestionDoc,
} from '@ai-learning-adventure/types';
import {
  apiErrorResponse,
  getContent,
  installApiInterceptor,
  saveContent,
} from './helpers/api.ts';
import { fillField, saveDraft } from './helpers/drivers.ts';
import {
  firstAward,
  firstFlashcard,
  firstMission,
  firstQuestion,
  secondFlashcard,
  secondMission,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();

const sharedEditorCases: ReadonlyArray<{
  entityType: AdminEntityType;
  id: string;
  route: string;
  label: string;
  value: string;
  persistedValue: (doc: unknown) => string;
  backLabel: string;
}> = [
  {
    entityType: 'mission',
    id: firstMission.id,
    route: `/missions/${firstMission.id}`,
    label: 'Title',
    value: 'Edited integration mission',
    persistedValue: (doc) => (doc as AdminMissionDoc).title,
    backLabel: 'Back to missions',
  },
  {
    entityType: 'question',
    id: firstQuestion.id,
    route: `/questions/${firstQuestion.id}`,
    label: 'Question stem',
    value: 'Edited integration question?',
    persistedValue: (doc) => (doc as AdminQuestionDoc).stem,
    backLabel: 'Back to questions',
  },
  {
    entityType: 'flashcard',
    id: firstFlashcard.id,
    route: `/flashcards/${firstFlashcard.id}`,
    label: 'Concept',
    value: 'Edited integration concept',
    persistedValue: (doc) => (doc as AdminFlashcardDoc).concept,
    backLabel: 'Back to flashcards',
  },
  {
    entityType: 'award',
    id: firstAward.id,
    route: `/badges/${firstAward.id}`,
    label: 'Name',
    value: 'Edited integration badge',
    persistedValue: (doc) => (doc as AdminAwardDoc).name,
    backLabel: 'Back to badges',
  },
];

describe('shared editor behavior', () => {
  it.each(sharedEditorCases)(
    'EDT-01 saves and remounts a required $entityType field',
    async ({ entityType, id, route, label, value, persistedValue }) => {
      const runtime = await testContext.create({ route, deferRender: entityType === 'award' });
      if (entityType === 'award') {
        const award = await getContent<AdminAwardDoc>(runtime, 'award', id);
        await saveContent(
          runtime,
          'award',
          id,
          {
            ...award.doc,
            rule: { type: 'mission_completed', missionId: firstMission.id as never },
          },
          award.revision,
        );
        testContext.mount(runtime, route);
      }
      const user = userEvent.setup();
      await screen.findByLabelText(label);

      await fillField(user, label, value);
      await saveDraft(user);
      testContext.mount(runtime);

      const remounted = (await screen.findByLabelText(label)) as HTMLInputElement | HTMLTextAreaElement;
      expect(remounted.value).toBe(value);
      expect(persistedValue((await getContent(runtime, entityType, id)).doc)).toBe(value);
    },
  );

  it('EDT-02 keeps dirty fields unsaved until manually selecting Save draft', async () => {
    const runtime = await testContext.create({ route: `/flashcards/${firstFlashcard.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Concept');

    await fillField(user, 'Concept', 'Manually saved integration concept');

    expect(screen.queryByText('Unsaved changes')).not.toBeNull();
    const itemBeforeSave = await getContent<AdminFlashcardDoc>(runtime, 'flashcard', firstFlashcard.id);
    expect(itemBeforeSave.doc.concept).not.toBe('Manually saved integration concept');

    await saveDraft(user);

    await waitFor(
      async () => {
        const item = await getContent<AdminFlashcardDoc>(runtime, 'flashcard', firstFlashcard.id);
        expect(item.doc.concept).toBe('Manually saved integration concept');
        expect(screen.queryByText('Unsaved changes')).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it.each(sharedEditorCases)(
    'EDT-03 rejects an invalid $entityType save without advancing its revision',
    async ({ entityType, id, route, label }) => {
      const runtime = await testContext.create({ route });
      const user = userEvent.setup();
      await screen.findByLabelText(label);
      const before = await getContent(runtime, entityType, id);

      await user.clear(screen.getByLabelText(label));
      await user.click(screen.getByRole('button', { name: 'Save draft' }));

      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        'Fix the blocking validation issues before saving.',
      );
      expect((await getContent(runtime, entityType, id)).revision).toBe(before.revision);
    },
  );

  it.each(sharedEditorCases)(
    'EDT-04 toggles and persists the enabled state for $entityType content',
    async ({ entityType, id, route, label }) => {
      const runtime = await testContext.create({ route });
      const user = userEvent.setup();
      await screen.findByLabelText(label);
      const enabled = screen.getByRole('switch', { name: 'Enabled' });
      expect((enabled as HTMLInputElement).checked).toBe(true);

      await user.click(enabled);

      await waitFor(async () => expect((await getContent(runtime, entityType, id)).enabled).toBe(false));
      await waitFor(() => expect((screen.getByRole('switch', { name: 'Enabled' }) as HTMLInputElement).checked).toBe(false));
    },
  );

  it.each(sharedEditorCases)(
    'EDT-05 shows a load error and working return action for an unknown $entityType',
    async ({ entityType, route, backLabel }) => {
      const base = route.slice(0, route.lastIndexOf('/'));
      const runtime = await testContext.create({ route: `${base}/does-not-exist` });
      const user = userEvent.setup();

      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        expect.stringContaining('was not found'),
      );
      await user.click(screen.getByRole('button', { name: backLabel }));

      await screen.findByRole('heading', {
        level: 1,
        name: entityType === 'award' ? 'Badges & Milestones' : `${entityType[0]!.toUpperCase()}${entityType.slice(1)}s`,
      });
      expect(runtime.currentPath).toBe(base);
    },
  );

  it('EDT-06 detects a stale revision and preserves the newer server document', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');
    const loaded = await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id);
    await saveContent(
      runtime,
      'question',
      firstQuestion.id,
      { ...loaded.doc, stem: 'Newer server revision' },
      loaded.revision,
    );

    await fillField(user, 'Question stem', 'Stale local revision');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This item was changed elsewhere. Reload to continue editing.',
    );
    expect((await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc.stem).toBe(
      'Newer server revision',
    );
  });

  it('EDT-07 retains unsaved input when a save request fails', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.includes(`/admin/content/question/${firstQuestion.id}`) && init?.method === 'PUT',
      () => apiErrorResponse(503, 'save_unavailable', 'Draft storage is temporarily unavailable.'),
    );

    await fillField(user, 'Question stem', 'Unsaved question retained in the editor');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Draft storage is temporarily unavailable.',
    );
    expect((screen.getByLabelText('Question stem') as HTMLTextAreaElement).value).toBe(
      'Unsaved question retained in the editor',
    );
  });

  it('EDT-08 returns to inventory with the saved title and changed status', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');
    await fillField(user, 'Question stem', 'Question visible after returning');
    await saveDraft(user);

    await user.click(screen.getByRole('link', { name: 'Questions' }));

    const title = await screen.findByRole('button', { name: 'Question visible after returning' });
    expect(title.closest('tr')?.textContent).toContain('Published · changes');
    expect(runtime.currentPath).toBe('/questions');
  });

  it('EDT-09 cancels mission editing and navigates back to /missions', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Title');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(runtime.currentPath).toBe('/missions');
  });
});

describe('mission editor', () => {
  it('MSN-01 saves all mission basics and their relationships', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Title');

    await fillField(user, 'Title', 'Mission basics integration');
    await fillField(user, 'Slug', 'mission-basics-integration');
    await fillField(user, 'Learning objective', 'Persist every mission basics field.');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'advanced');
    await user.selectOptions(screen.getByLabelText('Level track'), 'builder_mindset');
    await fillField(user, 'Order in track', '7');
    await fillField(user, 'Estimated minutes', '18');
    await fillField(user, 'Pass threshold (%)', '85');
    await user.selectOptions(screen.getByLabelText('Prerequisite mission'), secondMission.id);
    await saveDraft(user);

    expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc).toMatchObject({
      title: 'Mission basics integration',
      slug: 'mission-basics-integration',
      objective: 'Persist every mission basics field.',
      difficulty: 'advanced',
      levelTrack: 'builder_mindset',
      trackOrder: 7,
      estimatedMinutes: 18,
      passThreshold: 85,
      prerequisiteMissionId: secondMission.id,
    });
  });

  it('MSN-02 adds and persists an edited lesson block', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Add block' });

    await user.click(screen.getByRole('button', { name: 'Add block' }));
    const paragraphs = screen.getAllByLabelText('Paragraph text');
    await user.type(paragraphs.at(-1)!, 'New lesson block from the admin integration suite.');
    await saveDraft(user);

    const doc = (await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc;
    expect(doc.lesson.at(-1)).toEqual({
      type: 'paragraph',
      text: 'New lesson block from the admin integration suite.',
    });
  });

  it('MSN-03 removes a lesson block and persists the shorter lesson', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    const before = (await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.lesson.length;
    await screen.findByRole('button', { name: 'Add block' });

    await user.click(screen.getAllByRole('button', { name: 'Remove block' })[0]!);
    await saveDraft(user);

    expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.lesson).toHaveLength(
      before - 1,
    );
  });

  it('MSN-04 moves lesson blocks down and persists their order', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    const before = (await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.lesson;
    await screen.findByRole('button', { name: 'Add block' });

    await user.click(screen.getAllByRole('button', { name: 'Move block down' })[0]!);
    await saveDraft(user);

    const after = (await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.lesson;
    expect(after[0]).toEqual(before[1]);
    expect(after[1]).toEqual(before[0]);
  });

  it('MSN-05 switches lesson block types and persists type-specific key-term data', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    const type = (await screen.findAllByLabelText('Block type'))[0]!;

    await user.selectOptions(type, 'list');
    expect(screen.getAllByLabelText('List items (one per line)')[0]).toBeDefined();
    await user.selectOptions(type, 'callout');
    expect(screen.getAllByLabelText('Callout tone')[0]).toBeDefined();
    expect(screen.getAllByLabelText('Callout title')[0]).toBeDefined();
    await user.selectOptions(type, 'key_term');
    const keyTerm = screen.getAllByLabelText('Key term')[0]!;
    await user.clear(keyTerm);
    await user.type(keyTerm, 'Integration key term');
    await saveDraft(user);

    expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.lesson[0]).toMatchObject({
      type: 'key_term',
      term: 'Integration key term',
    });
  });

  it('MSN-06 links a key term to a flashcard', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    const links = await screen.findAllByLabelText('Linked flashcard');

    await user.selectOptions(links[0]!, secondFlashcard.id);
    await saveDraft(user);

    const doc = (await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc;
    const linked = doc.lesson.find((block) => block.type === 'key_term' && block.flashcardId === secondFlashcard.id);
    expect(linked).toBeDefined();
  });

  it('MSN-07 switches to a worked example and persists only that structure', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Example' });
    await user.click(screen.getByRole('button', { name: 'Example' }));

    await user.selectOptions(screen.getByLabelText('Example type'), 'worked_example');
    await fillField(user, 'Before', 'An unclear request.');
    await fillField(user, 'After', 'A focused request with constraints.');
    await fillField(user, 'Annotations (one per line)', 'Clear task\nUseful format');
    await saveDraft(user);

    expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.example).toEqual({
      type: 'worked_example',
      before: 'An unclear request.',
      after: 'A focused request with constraints.',
      annotations: ['Clear task', 'Useful format'],
    });
  });

  it('MSN-08 switches checkpoint kind and persists its fields', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Checkpoint' }));

    await user.selectOptions(screen.getByLabelText('Checkpoint kind'), 'write_response');
    await fillField(user, 'Prompt', 'Explain the integration workflow.');
    await saveDraft(user);

    expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.checkpoint).toEqual({
      kind: 'write_response',
      prompt: 'Explain the integration workflow.',
    });
  });

  it('MSN-09 adds, removes, and selects a correct checkpoint option', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Checkpoint' }));
    await user.click(screen.getByRole('button', { name: 'Add option' }));

    await fillField(user, 'Checkpoint option 4', 'A newly correct option');
    await user.click(screen.getByLabelText('Option 4 is correct'));
    await user.click(screen.getByRole('button', { name: 'Remove checkpoint option 2' }));
    await saveDraft(user);

    const checkpoint = (await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.checkpoint;
    if (checkpoint.kind !== 'single_question') throw new Error('Expected a single-question checkpoint.');
    expect(checkpoint.options).toHaveLength(3);
    expect(checkpoint.options.filter((option) => option.isCorrect).map((option) => option.text)).toEqual([
      'A newly correct option',
    ]);
  });

  it('MSN-10 MSN-11 accepts valid checkpoint JSON and retains it after invalid JSON input', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Checkpoint' }));
    await user.selectOptions(screen.getByLabelText('Checkpoint kind'), 'sort_into_buckets');
    const json = screen.getByLabelText('Checkpoint JSON');
    const valid = {
      kind: 'sort_into_buckets',
      prompt: 'Sort each item.',
      buckets: ['Helpful', 'Unhelpful'],
      items: [{ id: 'one', text: 'Review the output', correctBucket: 'Helpful' }],
    };

    fireEvent.change(json, { target: { value: JSON.stringify(valid, null, 2) } });
    expect(screen.queryByText('Not valid JSON yet.')).toBeNull();
    fireEvent.change(json, { target: { value: '{ invalid json' } });
    expect(screen.getByText('Not valid JSON yet.')).toBeDefined();
    await saveDraft(user);

    expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.checkpoint).toEqual(valid);
  });

  it('MSN-12 MSN-13 unassigns a question and flashcard from the Practice section', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    const questionLink = await screen.findByRole('link', { name: firstQuestion.stem });
    const questionRow = questionLink.closest('li');
    if (questionRow === null) throw new Error('Question practice row was not rendered.');

    await user.click(within(questionRow).getByRole('button', { name: 'Unassign from mission' }));
    await waitFor(async () => {
      expect((await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc.missionId).toBeNull();
    });

    const cardLink = await screen.findByRole('link', { name: firstFlashcard.concept });
    const cardRow = cardLink.closest('li');
    if (cardRow === null) throw new Error('Flashcard practice row was not rendered.');
    await user.click(within(cardRow).getByRole('button', { name: 'Unassign from mission' }));
    await waitFor(async () => {
      expect((await getContent<AdminFlashcardDoc>(runtime, 'flashcard', firstFlashcard.id)).doc.missionId).toBeNull();
    });
  });

  it('MSN-14 opens linked practice and award editors', async () => {
    const runtime = await testContext.create({ route: `/missions/${firstMission.id}` });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('link', { name: firstQuestion.stem }));
    await screen.findByRole('heading', { level: 1, name: firstQuestion.stem });
    expect(runtime.currentPath).toBe(`/questions/${firstQuestion.id}`);

    testContext.mount(runtime, `/missions/${firstMission.id}`);
    await user.click(await screen.findByRole('button', { name: 'Award' }));
    await user.click(await screen.findByRole('link', { name: firstAward.name }));
    await screen.findByRole('heading', { level: 1, name: firstAward.name });
    expect(runtime.currentPath).toBe(`/badges/${firstAward.id}`);
  });
});
