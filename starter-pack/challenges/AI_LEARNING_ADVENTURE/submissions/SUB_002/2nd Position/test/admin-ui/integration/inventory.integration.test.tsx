import { screen, waitFor, within } from '@testing-library/react';
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
  createValidDraft,
  getContent,
  listContent,
} from './helpers/api.ts';
import {
  chooseAction,
  rowFor,
  waitForInventory,
} from './helpers/drivers.ts';
import {
  firstMission,
  firstQuestion,
  inventoryCases,
  makeFlashcardDoc,
  makeQuestionDoc,
  secondMission,
  seededFlashcards,
  seededMissions,
  seededQuestions,
  validDocFor,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();

function editorBase(entityType: AdminEntityType): string {
  return entityType === 'award' ? '/badges' : `/${entityType}s`;
}

function titleOf(entityType: AdminEntityType, doc: unknown): string {
  switch (entityType) {
    case 'mission':
      return (doc as AdminMissionDoc).title;
    case 'question':
      return (doc as AdminQuestionDoc).stem;
    case 'flashcard':
      return (doc as AdminFlashcardDoc).concept;
    case 'award':
      return (doc as AdminAwardDoc).name;
  }
}

function copyTitle(entityType: AdminEntityType, title: string): string {
  return `${title} (copy)`;
}

describe('content inventories', () => {
  it.each(inventoryCases)(
    'INV-01 opens the $entityType inventory with seeded rows and status',
    async ({ entityType, route, heading, seededTitle }) => {
      await testContext.create({ route });

      await waitForInventory(entityType);
      const row = rowFor(seededTitle);
      expect(within(row).getByText('Published')).toBeDefined();
      expect(within(row).getByRole('button', { name: `Actions for ${seededTitle}` })).toBeDefined();
    },
  );

  it.each(inventoryCases)(
    'INV-02 creates a new $entityType draft and opens its editor',
    async ({ entityType, route }) => {
      const runtime = await testContext.create({ route });
      const user = userEvent.setup();

      await waitForInventory(entityType);
      await user.click(screen.getByRole('button', { name: 'New' }));

      await waitFor(() => {
        const prefix = `${editorBase(entityType)}/`;
        expect(runtime.currentPath.startsWith(prefix)).toBe(true);
        expect(runtime.currentPath.slice(prefix.length)).not.toContain('/');
      });
      const id = decodeURIComponent(runtime.currentPath.slice(runtime.currentPath.lastIndexOf('/') + 1));
      expect((await getContent(runtime, entityType, id)).status).toBe('draft');
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/New|untitled/i));
    },
  );

  it.each(inventoryCases)(
    'INV-03 INV-04 searches the $entityType inventory with trimmed case-insensitive text',
    async ({ entityType, route, seededTitle, secondTitle }) => {
      await testContext.create({ route });
      const user = userEvent.setup();
      await waitForInventory(entityType);

      await user.type(screen.getByLabelText('Search'), `  ${seededTitle.toUpperCase()}  `);

      await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
      expect(rowFor(seededTitle)).toBeDefined();
      expect(screen.queryByRole('button', { name: secondTitle })).toBeNull();
    },
  );

  it.each(inventoryCases)(
    'INV-05 filters $entityType rows by publication status',
    async ({ entityType, route, seededTitle }) => {
      const runtime = await testContext.create({ route, deferRender: true });
      const draft = await createValidDraft(runtime, entityType, (id) => validDocFor(entityType, id));
      testContext.mount(runtime);
      const user = userEvent.setup();
      await waitForInventory(entityType);

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'draft');

      await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
      expect(rowFor(titleOf(entityType, draft.doc))).toBeDefined();
      expect(screen.queryByRole('button', { name: seededTitle })).toBeNull();
    },
  );

  it('INV-06 filters missions by difficulty and level track', async () => {
    await testContext.create({ route: '/missions' });
    const user = userEvent.setup();
    await waitForInventory('mission');

    await user.selectOptions(screen.getByLabelText('Filter by difficulty'), 'intermediate');
    await user.selectOptions(screen.getByLabelText('Filter by track'), 'basic_understanding');

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
      for (const row of rows.slice(1)) {
        expect(within(row).getByText('Intermediate')).toBeDefined();
        expect(within(row).getByText('Basic Understanding')).toBeDefined();
      }
    });
    expect(rowFor('Tokens and Context')).toBeDefined();
    expect(screen.queryByRole('button', { name: firstMission.title })).toBeNull();
  });

  it.each([
    { entityType: 'question' as const, route: '/questions', makeDoc: makeQuestionDoc },
    { entityType: 'flashcard' as const, route: '/flashcards', makeDoc: makeFlashcardDoc },
  ])(
    'INV-07 INV-08 filters $entityType content by mission and Unassigned',
    async ({ entityType, route, makeDoc }) => {
      const runtime = await testContext.create({ route, deferRender: true });
      const unassigned = await createValidDraft(runtime, entityType, (id) =>
        makeDoc(id, {
          missionId: null,
          ...(entityType === 'question'
            ? { stem: 'Unassigned integration practice' }
            : { concept: 'Unassigned integration practice' }),
        }),
      );
      testContext.mount(runtime);
      const user = userEvent.setup();
      await waitForInventory(entityType);

      await user.selectOptions(screen.getByLabelText('Filter by mission'), firstMission.id);
      await waitFor(() => expect(screen.queryByRole('button', { name: titleOf(entityType, unassigned.doc) })).toBeNull());
      expect(screen.getAllByText(firstMission.title).length).toBeGreaterThan(0);

      await user.selectOptions(screen.getByLabelText('Filter by mission'), '__unassigned__');
      await waitFor(() => expect(rowFor(titleOf(entityType, unassigned.doc))).toBeDefined());
      expect(screen.queryByRole('button', { name: entityType === 'question' ? firstQuestion.stem : seededFlashcards[0]!.concept })).toBeNull();
    },
  );

  it('INV-09 INV-10 intersects search and filters, then clears them', async () => {
    const runtime = await testContext.create({ route: '/missions' });
    const user = userEvent.setup();
    await waitForInventory('mission');
    const total = (await listContent(runtime, 'mission')).total;

    await user.type(screen.getByLabelText('Search'), 'tokens');
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'published');
    await user.selectOptions(screen.getByLabelText('Filter by difficulty'), 'intermediate');
    await user.selectOptions(screen.getByLabelText('Filter by track'), 'basic_understanding');

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    expect(rowFor('Tokens and Context')).toBeDefined();

    await user.clear(screen.getByLabelText('Search'));
    await user.selectOptions(screen.getByLabelText('Filter by status'), '');
    await user.selectOptions(screen.getByLabelText('Filter by difficulty'), '');
    await user.selectOptions(screen.getByLabelText('Filter by track'), '');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(total + 1));
  });

  it.each(inventoryCases)(
    'INV-11 opens the $entityType editor by selecting the item title',
    async ({ entityType, route, seededTitle }) => {
      const runtime = await testContext.create({ route });
      const user = userEvent.setup();
      await waitForInventory(entityType);

      await user.click(screen.getByRole('button', { name: seededTitle }));

      await screen.findByRole('heading', { level: 1, name: seededTitle });
      expect(runtime.currentPath.startsWith(`${editorBase(entityType)}/`)).toBe(true);
    },
  );

  it.each(inventoryCases)(
    'INV-12 opens the $entityType editor through its action menu',
    async ({ entityType, route, seededTitle }) => {
      const runtime = await testContext.create({ route });
      const user = userEvent.setup();
      await waitForInventory(entityType);

      await chooseAction(user, seededTitle, 'Edit');

      await screen.findByRole('heading', { level: 1, name: seededTitle });
      expect(runtime.currentPath.startsWith(`${editorBase(entityType)}/`)).toBe(true);
    },
  );

  it.each(inventoryCases)(
    'INV-13 duplicates $entityType content as a separate draft',
    async ({ entityType, route, seededTitle }) => {
      const runtime = await testContext.create({ route });
      const user = userEvent.setup();
      await waitForInventory(entityType);

      await chooseAction(user, seededTitle, 'Duplicate');

      const expectedCopyTitle = copyTitle(entityType, seededTitle);
      await waitFor(() => expect(rowFor(expectedCopyTitle)).toBeDefined());
      const items = (await listContent(runtime, entityType)).items;
      const copy = items.find((item) => titleOf(entityType, item.doc) === expectedCopyTitle);
      expect(copy?.status).toBe('draft');
      expect(items.find((item) => titleOf(entityType, item.doc) === seededTitle)?.status).toBe('published');
    },
  );

  it('INV-14 INV-15 cancels and then confirms deletion', async () => {
    const runtime = await testContext.create({ route: '/questions', deferRender: true });
    const draft = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { stem: 'Question to delete' }),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await waitForInventory('question');

    await chooseAction(user, 'Question to delete', 'Delete');
    let dialog = await screen.findByRole('dialog', { name: 'Delete Question to delete?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await getContent(runtime, 'question', draft.id)).toBeDefined();
    expect(rowFor('Question to delete')).toBeDefined();

    await chooseAction(user, 'Question to delete', 'Delete');
    dialog = await screen.findByRole('dialog', { name: 'Delete Question to delete?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Question to delete' })).toBeNull());
    const archived = (await listContent(runtime, 'question', { includeArchived: true })).items.find(
      (item) => item.id === draft.id,
    );
    expect(archived).toMatchObject({ archived: true, enabled: false });
  });

  it('INV-16 disables and re-enables non-mission content', async () => {
    const runtime = await testContext.create({ route: '/questions' });
    const user = userEvent.setup();
    await waitForInventory('question');

    await chooseAction(user, firstQuestion.stem, 'Disable');
    await waitFor(() => expect(within(rowFor(firstQuestion.stem)).getByText('Disabled')).toBeDefined());
    expect((await getContent(runtime, 'question', firstQuestion.id)).enabled).toBe(false);

    await chooseAction(user, firstQuestion.stem, 'Enable');
    await waitFor(() => expect(within(rowFor(firstQuestion.stem)).getByText('Published')).toBeDefined());
    expect((await getContent(runtime, 'question', firstQuestion.id)).enabled).toBe(true);
  });

  it('INV-17 INV-18 requires and honors the mission disable warning', async () => {
    const runtime = await testContext.create({ route: '/missions' });
    const user = userEvent.setup();
    await waitForInventory('mission');

    await chooseAction(user, firstMission.title, 'Disable');
    let dialog = await screen.findByRole('dialog', { name: `Disable ${firstMission.title}?` });
    expect(within(dialog).getByText(/hides the mission and its practice content/i)).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect((await getContent(runtime, 'mission', firstMission.id)).enabled).toBe(true);

    await chooseAction(user, firstMission.title, 'Disable');
    dialog = await screen.findByRole('dialog', { name: `Disable ${firstMission.title}?` });
    await user.click(within(dialog).getByRole('button', { name: 'Disable' }));
    await waitFor(() => expect(within(rowFor(firstMission.title)).getByText('Disabled')).toBeDefined());
    expect((await getContent(runtime, 'mission', firstMission.id)).enabled).toBe(false);
  });

  it('INV-19 INV-20 applies bulk actions to one row and all visible rows', async () => {
    const runtime = await testContext.create({ route: '/questions', deferRender: true });
    const first = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { stem: 'Bulk integration alpha' }),
    );
    const second = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { stem: 'Bulk integration beta' }),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await waitForInventory('question');
    await user.type(screen.getByLabelText('Search'), 'Bulk integration');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));

    await user.click(screen.getByLabelText('Select Bulk integration alpha'));
    expect(screen.getByText('1 selected')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Disable' }));
    await waitFor(() => expect(screen.queryByText('1 selected')).toBeNull());
    expect((await getContent(runtime, 'question', first.id)).enabled).toBe(false);
    expect((await getContent(runtime, 'question', second.id)).enabled).toBe(true);

    await user.click(screen.getByLabelText('Select all'));
    expect(screen.getByText('2 selected')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Disable' }));
    await waitFor(async () => {
      expect((await getContent(runtime, 'question', first.id)).enabled).toBe(false);
      expect((await getContent(runtime, 'question', second.id)).enabled).toBe(false);
    });
  });

  it('INV-21 INV-22 persists successful bulk publication changes and reports partial failures', async () => {
    const runtime = await testContext.create({ route: '/questions' });
    const user = userEvent.setup();
    await waitForInventory('question');
    await chooseAction(user, firstQuestion.stem, 'Duplicate');
    const copiedTitle = `${firstQuestion.stem} (copy)`;
    await waitFor(() => expect(rowFor(copiedTitle)).toBeDefined());

    await user.type(screen.getByLabelText('Search'), firstQuestion.stem);
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
    await user.click(screen.getByLabelText('Select all'));
    await user.click(screen.getByRole('button', { name: 'Unpublish' }));

    expect((await screen.findByRole('alert')).textContent).toContain('1 item(s) failed');
    await waitFor(async () => {
      expect((await getContent(runtime, 'question', firstQuestion.id)).status).toBe('draft');
    });

    await user.click(screen.getByLabelText('Select all'));
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(async () => {
      const matches = (await listContent(runtime, 'question', { q: firstQuestion.stem })).items;
      expect(matches).toHaveLength(2);
      expect(matches.every((item) => item.status === 'published')).toBe(true);
    });
  });

  it('INV-23 shows an empty result state with a working create action', async () => {
    const runtime = await testContext.create({ route: '/flashcards' });
    const user = userEvent.setup();
    await waitForInventory('flashcard');

    await user.type(screen.getByLabelText('Search'), 'no-content-has-this-title');
    expect(await screen.findByText('No flashcards found')).toBeDefined();
    await user.click(screen.getAllByRole('button', { name: 'New' })[0]!);

    await waitFor(() => expect(runtime.currentPath).toMatch(/^\/flashcards\//));
  });

  it('INV-24 refreshes mission practice counts after an assignment', async () => {
    const runtime = await testContext.create({ route: '/missions/assignments', deferRender: true });
    const unassigned = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { stem: 'Count refresh question', missionId: null }),
    );
    const initialQuestions = (await listContent<AdminQuestionDoc>(runtime, 'question')).items.filter(
      (item) => item.doc.missionId === firstMission.id,
    ).length;
    const initialCards = (await listContent<AdminFlashcardDoc>(runtime, 'flashcard')).items.filter(
      (item) => item.doc.missionId === firstMission.id,
    ).length;
    testContext.mount(runtime);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Practice assignment board' });

    await user.selectOptions(
      await screen.findByLabelText('Assign Count refresh question to mission'),
      firstMission.id,
    );
    await waitFor(async () => {
      expect((await getContent<AdminQuestionDoc>(runtime, 'question', unassigned.id)).doc.missionId).toBe(firstMission.id);
    });
    await user.click(screen.getByRole('link', { name: 'Missions' }));
    await waitForInventory('mission');

    expect(within(rowFor(firstMission.title)).getByText(`${initialQuestions + 1} q · ${initialCards} c`)).toBeDefined();
  });
});
