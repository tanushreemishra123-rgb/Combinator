import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AdminQuestionDoc } from '@ai-learning-adventure/types';
import {
  apiErrorResponse,
  createValidDraft,
  getContent,
  installApiInterceptor,
} from './helpers/api.ts';
import { chooseAction, fillField, rowFor, waitForInventory } from './helpers/drivers.ts';
import {
  firstMission,
  firstQuestion,
  makeQuestionDoc,
  secondQuestion,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();

describe('failure recovery and network isolation', () => {
  it('RES-01 RES-02 presents an inventory load error and recovers through Retry', async () => {
    const runtime = await testContext.create({ route: '/missions', deferRender: true });
    let unavailable = true;
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url) => url.includes('/api/v1/admin/content') && url.includes('type=mission'),
      (url, init) =>
        unavailable
          ? apiErrorResponse(503, 'inventory_unavailable', 'Mission inventory is temporarily unavailable.')
          : runtime.apiFetch(url, init),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();

    const loadAlert = await screen.findByRole('alert');
    expect(loadAlert.textContent).toContain('Failed to load content');
    expect(loadAlert.textContent).toContain('Mission inventory is temporarily unavailable.');
    unavailable = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitForInventory('mission');
    expect(rowFor(firstMission.title)).toBeDefined();
  });

  it('RES-03 presents a recoverable editor loading error and return action', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}`, deferRender: true });
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) =>
        url.endsWith(`/api/v1/admin/content/question/${firstQuestion.id}`) && (init?.method ?? 'GET') === 'GET',
      () => apiErrorResponse(503, 'editor_unavailable', 'Question editor is temporarily unavailable.'),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Question editor is temporarily unavailable.',
    );
    await user.click(screen.getByRole('button', { name: 'Back to questions' }));
    await waitForInventory('question');
    expect(runtime.currentPath).toBe('/questions');
  });

  it('RES-04 keeps inventory state consistent when create and delete requests fail', async () => {
    const runtime = await testContext.create({ route: '/questions' });
    const user = userEvent.setup();
    await waitForInventory('question');
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.endsWith('/api/v1/admin/content/question') && init?.method === 'POST',
      () => apiErrorResponse(503, 'create_unavailable', 'Question creation is temporarily unavailable.'),
    );
    interceptor.block(
      (url, init) => url.endsWith(`/api/v1/admin/content/question/${firstQuestion.id}`) && init?.method === 'DELETE',
      () => apiErrorResponse(503, 'delete_unavailable', 'Question deletion is temporarily unavailable.'),
    );

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Question creation is temporarily unavailable.',
    );
    expect(runtime.currentPath).toBe('/questions');

    await chooseAction(user, firstQuestion.stem, 'Delete');
    const dialog = await screen.findByRole('dialog', { name: `Delete ${firstQuestion.stem}?` });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Question deletion is temporarily unavailable.',
    );
    expect(rowFor(firstQuestion.stem)).toBeDefined();
    expect(await getContent(runtime, 'question', firstQuestion.id)).toBeDefined();
  });

  it('RES-05 reports duplicate and bulk failures without changing persisted data', async () => {
    const runtime = await testContext.create({ route: '/questions' });
    const user = userEvent.setup();
    await waitForInventory('question');
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.endsWith(`/api/v1/admin/content/question/${firstQuestion.id}/duplicate`) && init?.method === 'POST',
      () => apiErrorResponse(503, 'duplicate_unavailable', 'Duplicate is temporarily unavailable.'),
    );
    interceptor.block(
      (url, init) => url.endsWith('/api/v1/admin/content/bulk') && init?.method === 'POST',
      () => apiErrorResponse(503, 'bulk_unavailable', 'Bulk actions are temporarily unavailable.'),
    );

    await chooseAction(user, firstQuestion.stem, 'Duplicate');
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Duplicate is temporarily unavailable.');
    expect(screen.queryByRole('button', { name: `${firstQuestion.stem} (copy)` })).toBeNull();

    await user.click(screen.getByLabelText(`Select ${firstQuestion.stem}`));
    await user.click(screen.getByRole('button', { name: 'Disable' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Bulk actions are temporarily unavailable.');
    expect((await getContent(runtime, 'question', firstQuestion.id)).enabled).toBe(true);
  });

  it('RES-06 reconciles an assignment failure with backend state', async () => {
    const runtime = await testContext.create({ route: '/missions/assignments', deferRender: true });
    const draft = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { missionId: null, stem: 'Resilience assignment question' }),
    );
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.endsWith('/api/v1/admin/practice-assignments') && init?.method === 'PATCH',
      () => apiErrorResponse(503, 'assignment_failed', 'The assignment could not be saved.'),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Practice assignment board' });
    await screen.findByRole('region', { name: `Mission ${firstMission.title}` });

    await user.selectOptions(
      screen.getByLabelText('Assign Resilience assignment question to mission'),
      firstMission.id,
    );

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The assignment could not be saved.');
    expect((await getContent<AdminQuestionDoc>(runtime, 'question', draft.id)).doc.missionId).toBeNull();
    expect(screen.getByLabelText('Assign Resilience assignment question to mission')).toBeDefined();
  });

  it('RES-07 rejects an unexpected external request immediately', async () => {
    await testContext.create({ route: '/missions' });

    expect(() => fetch('https://example.com/admin-integration-leak')).toThrow(
      'Unexpected external request in admin integration test: https://example.com/admin-integration-leak',
    );
  });
});

describe('keyboard and accessibility behavior', () => {
  it('A11Y-01 completes create, edit, publish, and delete with keyboard activation', async () => {
    const runtime = await testContext.create({ route: '/flashcards' });
    const user = userEvent.setup();
    await waitForInventory('flashcard');
    const create = screen.getByRole('button', { name: 'New' });
    create.focus();
    await user.keyboard('{Enter}');
    await screen.findByLabelText('Concept');

    await user.selectOptions(screen.getByLabelText('Mission'), firstMission.id);
    await fillField(user, 'Concept', 'Keyboard managed flashcard');
    await fillField(user, 'Definition', 'Managed without pointer activation.');
    await fillField(user, 'Example', 'Keyboard input creates and edits this card.');
    await fillField(user, 'Learning tip', 'Keep focus visible.');
    const save = screen.getByRole('button', { name: 'Save draft' });
    save.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
    const id = runtime.currentPath.slice(runtime.currentPath.lastIndexOf('/') + 1);

    const publish = screen.getByRole('button', { name: 'Publish…' });
    publish.focus();
    await user.keyboard('{Enter}');
    const publishDialog = await screen.findByRole('dialog', { name: 'Publish content' });
    await within(publishDialog).findByText('No blocking issues.');
    const acknowledgement = within(publishDialog).getByLabelText('I have reviewed and validated this content.');
    acknowledgement.focus();
    await user.keyboard('{Space}');
    const confirmPublish = within(publishDialog).getByRole('button', { name: 'Publish' });
    confirmPublish.focus();
    await user.keyboard('{Enter}');
    await waitFor(async () => expect((await getContent(runtime, 'flashcard', id)).status).toBe('published'));

    const inventoryLink = screen.getByRole('link', { name: 'Flashcards' });
    inventoryLink.focus();
    await user.keyboard('{Enter}');
    await waitForInventory('flashcard');
    const actions = screen.getByRole('button', { name: 'Actions for Keyboard managed flashcard' });
    actions.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    const deleteAction = within(menu).getByRole('menuitem', { name: 'Delete' });
    deleteAction.focus();
    await user.keyboard('{Enter}');
    const deleteDialog = await screen.findByRole('dialog', { name: 'Delete Keyboard managed flashcard?' });
    const confirmDelete = within(deleteDialog).getByRole('button', { name: 'Delete' });
    confirmDelete.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Keyboard managed flashcard' })).toBeNull());
  });

  it('A11Y-02 moves focus into a dialog and restores it to the action trigger', async () => {
    await testContext.create({ route: '/questions' });
    const user = userEvent.setup();
    await waitForInventory('question');
    const trigger = screen.getByRole('button', { name: `Actions for ${firstQuestion.stem}` });
    trigger.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: `Delete ${firstQuestion.stem}?` });

    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('A11Y-03 gives inventory search, filters, selection, and actions accessible names', async () => {
    await testContext.create({ route: '/missions' });
    await waitForInventory('mission');

    expect(screen.getByRole('textbox', { name: 'Search' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Filter by difficulty' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Filter by track' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: `Select ${firstMission.title}` })).toBeDefined();
    expect(screen.getByRole('button', { name: `Actions for ${firstMission.title}` })).toBeDefined();
  });

  it('A11Y-04 exposes mutation failures through an alert role', async () => {
    const runtime = await testContext.create({ route: '/questions' });
    const user = userEvent.setup();
    await waitForInventory('question');
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.endsWith('/api/v1/admin/content/question') && init?.method === 'POST',
      () => apiErrorResponse(503, 'create_failed', 'Accessible mutation error.'),
    );

    await user.click(screen.getByRole('button', { name: 'New' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Accessible mutation error.');
  });

  it.each([
    ['/missions', 'Missions'],
    ['/questions', 'Questions'],
    ['/flashcards', 'Flashcards'],
    ['/badges', 'Badges & Milestones'],
    ['/missions/assignments', 'Practice assignment board'],
    ['/curriculum', 'Curriculum'],
    ['/settings', 'Settings'],
  ] as const)('A11Y-05 gives %s one identifying heading and admin navigation', async (route, heading) => {
    await testContext.create({ route });

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Admin sections' })).toBeDefined();
  });

  it('A11Y-06 reassigns and reorders practice content without pointer input', async () => {
    const runtime = await testContext.create({ route: '/missions/assignments', deferRender: true });
    const draft = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { missionId: null, stem: 'Keyboard assignment item' }),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Practice assignment board' });
    await screen.findByRole('region', { name: `Mission ${firstMission.title}` });
    const assign = screen.getByLabelText('Assign Keyboard assignment item to mission');
    assign.focus();
    await user.selectOptions(assign, firstMission.id);
    await waitFor(async () => {
      expect((await getContent<AdminQuestionDoc>(runtime, 'question', draft.id)).doc.missionId).toBe(firstMission.id);
    });

    const zone = screen.getByRole('region', { name: `Mission ${firstMission.title}` });
    expect(await within(zone).findByText('Keyboard assignment item')).toBeDefined();
    const existingChip = within(zone).getByText(firstQuestion.stem).closest('li');
    if (existingChip === null) throw new Error('Existing keyboard assignment chip was not rendered.');
    const moveDown = within(existingChip).getByRole('button', { name: 'Move down' });
    moveDown.focus();
    await user.keyboard('{Enter}');

    await waitFor(async () => {
      const first = await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id);
      const second = await getContent<AdminQuestionDoc>(runtime, 'question', secondQuestion.id);
      expect(first.doc.displayOrder).toBeGreaterThan(second.doc.displayOrder);
    });
  });
});
