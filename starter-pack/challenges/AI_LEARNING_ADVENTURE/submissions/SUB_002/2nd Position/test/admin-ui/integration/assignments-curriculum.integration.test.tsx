import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type {
  AdminFlashcardDoc,
  AdminMissionDoc,
  AdminQuestionDoc,
} from '@ai-learning-adventure/types';
import {
  apiErrorResponse,
  createValidDraft,
  getContent,
  installApiInterceptor,
  listContent,
  saveContent,
} from './helpers/api.ts';
import {
  firstFlashcard,
  firstMission,
  firstQuestion,
  makeFlashcardDoc,
  makeQuestionDoc,
  secondMission,
  secondQuestion,
  seededMissions,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();

async function waitForBoard(): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: 'Practice assignment board' });
  await screen.findByRole('region', { name: `Mission ${firstMission.title}` });
}

describe('practice assignment board', () => {
  it.each([
    {
      id: 'ASN-01',
      entityType: 'question' as const,
      title: 'Unassigned question for assignment',
      makeDoc: (id: string) => makeQuestionDoc(id, { missionId: null, stem: 'Unassigned question for assignment' }),
      tab: 'Questions',
    },
    {
      id: 'ASN-02',
      entityType: 'flashcard' as const,
      title: 'Unassigned card for assignment',
      makeDoc: (id: string) => makeFlashcardDoc(id, { missionId: null, concept: 'Unassigned card for assignment' }),
      tab: 'Flashcards',
    },
  ])('$id assigns an unassigned $entityType through its mission select', async ({ entityType, title, makeDoc, tab }) => {
    const runtime = await testContext.create({ route: '/missions/assignments', deferRender: true });
    const item = await createValidDraft<AdminQuestionDoc | AdminFlashcardDoc>(
      runtime,
      entityType,
      makeDoc,
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await waitForBoard();
    if (tab === 'Flashcards') await user.click(screen.getByRole('tab', { name: tab }));

    await user.selectOptions(screen.getByLabelText(`Assign ${title} to mission`), firstMission.id);

    await waitFor(async () => {
      const persisted = await getContent<AdminQuestionDoc | AdminFlashcardDoc>(runtime, entityType, item.id);
      expect(persisted.doc.missionId).toBe(firstMission.id);
    });
    const zone = screen.getByRole('region', { name: `Mission ${firstMission.title}` });
    expect(await within(zone).findByText(title)).toBeDefined();
  });

  it('ASN-03 moves practice content between missions', async () => {
    const runtime = await testContext.create({ route: '/missions/assignments' });
    const user = userEvent.setup();
    await waitForBoard();

    await user.selectOptions(screen.getByLabelText(`Move ${firstQuestion.stem} to`), secondMission.id);

    await waitFor(async () => {
      expect((await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc.missionId).toBe(
        secondMission.id,
      );
    });
    expect(within(screen.getByRole('region', { name: `Mission ${secondMission.title}` })).getByText(firstQuestion.stem)).toBeDefined();
    expect(within(screen.getByRole('region', { name: `Mission ${firstMission.title}` })).queryByText(firstQuestion.stem)).toBeNull();
  });

  it('ASN-04 moves assigned practice content back to Unassigned', async () => {
    const runtime = await testContext.create({ route: '/missions/assignments' });
    const user = userEvent.setup();
    await waitForBoard();

    await user.selectOptions(screen.getByLabelText(`Move ${firstQuestion.stem} to`), '__unassigned__');

    await waitFor(async () => {
      expect((await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc.missionId).toBeNull();
    });
    expect(await screen.findByLabelText(`Assign ${firstQuestion.stem} to mission`)).toBeDefined();
  });

  it('ASN-05 moves assigned content down and persists display order', async () => {
    const runtime = await testContext.create({ route: '/missions/assignments' });
    const user = userEvent.setup();
    await waitForBoard();
    const zone = screen.getByRole('region', { name: `Mission ${firstMission.title}` });
    const firstChip = within(zone).getByText(firstQuestion.stem).closest('li');
    if (firstChip === null) throw new Error('First question assignment chip was not rendered.');

    await user.click(within(firstChip).getByRole('button', { name: 'Move down' }));

    await waitFor(async () => {
      const first = await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id);
      const second = await getContent<AdminQuestionDoc>(runtime, 'question', secondQuestion.id);
      expect(first.doc.displayOrder).toBeGreaterThan(second.doc.displayOrder);
    });
  });

  it('ASN-06 searches only the unassigned library', async () => {
    const runtime = await testContext.create({ route: '/missions/assignments', deferRender: true });
    await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { missionId: null, stem: 'Library search alpha' }),
    );
    await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { missionId: null, stem: 'Library search beta' }),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await waitForBoard();

    await user.type(screen.getByLabelText('Search library'), 'alpha');

    expect(screen.getByText('Library search alpha')).toBeDefined();
    expect(screen.queryByText('Library search beta')).toBeNull();
  });

  it('ASN-07 switches between independent question and flashcard board data', async () => {
    await testContext.create({ route: '/missions/assignments' });
    const user = userEvent.setup();
    await waitForBoard();
    const questionsTab = screen.getByRole('tab', { name: 'Questions' });
    const flashcardsTab = screen.getByRole('tab', { name: 'Flashcards' });
    expect(questionsTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(firstQuestion.stem)).toBeDefined();

    await user.click(flashcardsTab);

    expect(flashcardsTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(firstFlashcard.concept)).toBeDefined();
  });

  it('ASN-08 reorders assigned content with the keyboard drag sensor', async () => {
    const runtime = await testContext.create({ route: '/missions/assignments' });
    const user = userEvent.setup();
    await waitForBoard();
    const handle = screen.getByRole('button', { name: `Drag ${firstQuestion.stem}` });
    handle.focus();

    await user.keyboard('[Space][ArrowDown][Space]');

    await waitFor(async () => {
      const first = await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id);
      const second = await getContent<AdminQuestionDoc>(runtime, 'question', secondQuestion.id);
      expect(first.doc.displayOrder).toBeGreaterThan(second.doc.displayOrder);
    });
  });

  it('ASN-09 reports an assignment failure and restores backend state', async () => {
    const runtime = await testContext.create({ route: '/missions/assignments', deferRender: true });
    const item = await createValidDraft(runtime, 'question', (id) =>
      makeQuestionDoc(id, { missionId: null, stem: 'Assignment failure question' }),
    );
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.endsWith('/api/v1/admin/practice-assignments') && init?.method === 'PATCH',
      () => apiErrorResponse(503, 'assignment_unavailable', 'Assignments are temporarily unavailable.'),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await waitForBoard();

    await user.selectOptions(
      screen.getByLabelText('Assign Assignment failure question to mission'),
      firstMission.id,
    );

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Assignments are temporarily unavailable.',
    );
    expect((await getContent<AdminQuestionDoc>(runtime, 'question', item.id)).doc.missionId).toBeNull();
    expect(screen.getByLabelText('Assign Assignment failure question to mission')).toBeDefined();
  });
});

describe('curriculum', () => {
  it('CUR-01 renders matrix totals from the seeded mission catalog', async () => {
    await testContext.create({ route: '/curriculum' });
    const table = await screen.findByRole('table');
    const beginnerMissions = seededMissions.filter((mission) => mission.levelTrack === 'beginner');
    const beginnerRow = within(table)
      .getAllByRole('row')
      .find((row) => within(row).queryByRole('rowheader', { name: 'Beginner' }) !== null);
    if (beginnerRow === undefined) throw new Error('Beginner curriculum matrix row was not rendered.');

    const cells = within(beginnerRow).getAllByRole('cell');
    expect(cells.at(-1)?.textContent).toBe(String(beginnerMissions.length));
    expect(screen.getByRole('region', { name: 'Beginner' })).toBeDefined();
  });

  it('CUR-02 warns when a track has an ordering gap', async () => {
    const runtime = await testContext.create({ route: '/curriculum', deferRender: true });
    const item = await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id);
    await saveContent(runtime, 'mission', item.id, { ...item.doc, trackOrder: 8 }, item.revision);
    testContext.mount(runtime);

    const warnings = await screen.findByLabelText('Progression warnings');
    expect(warnings.textContent).toContain('Beginner: Ordering has gaps');
  });

  it('CUR-03 warns when a track mixes difficulty levels', async () => {
    const runtime = await testContext.create({ route: '/curriculum', deferRender: true });
    const item = await getContent<AdminMissionDoc>(runtime, 'mission', secondMission.id);
    await saveContent(runtime, 'mission', item.id, { ...item.doc, difficulty: 'intermediate' }, item.revision);
    testContext.mount(runtime);

    const warnings = await screen.findByLabelText('Progression warnings');
    expect(warnings.textContent).toContain('Beginner: Track mixes difficulty levels.');
  });

  it('CUR-04 reorders missions within a track and persists contiguous order', async () => {
    const runtime = await testContext.create({ route: '/curriculum' });
    const user = userEvent.setup();
    await screen.findByRole('table');
    const handle = screen.getByRole('button', { name: `Drag ${secondMission.title}` });
    handle.focus();

    await user.keyboard('[Space][ArrowUp][Space]');

    await waitFor(async () => {
      expect((await getContent<AdminMissionDoc>(runtime, 'mission', secondMission.id)).doc.trackOrder).toBe(1);
      expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.trackOrder).toBe(2);
    });
  });

  it('CUR-05 reports a failed reorder and restores server ordering', async () => {
    const runtime = await testContext.create({ route: '/curriculum' });
    const user = userEvent.setup();
    await screen.findByRole('table');
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.endsWith('/api/v1/admin/missions/reorder') && init?.method === 'PATCH',
      () => apiErrorResponse(503, 'reorder_unavailable', 'Curriculum ordering is temporarily unavailable.'),
    );
    const handle = screen.getByRole('button', { name: `Drag ${secondMission.title}` });
    handle.focus();

    await user.keyboard('[Space][ArrowUp][Space]');

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Curriculum ordering is temporarily unavailable.',
    );
    expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.trackOrder).toBe(1);
    expect((await getContent<AdminMissionDoc>(runtime, 'mission', secondMission.id)).doc.trackOrder).toBe(2);
  });

  it('CUR-06 opens a selected curriculum mission in its editor', async () => {
    const runtime = await testContext.create({ route: '/curriculum' });
    const user = userEvent.setup();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: `1. ${firstMission.title}` }));

    expect(await screen.findByRole('heading', { level: 1, name: firstMission.title })).toBeDefined();
    expect(runtime.currentPath).toBe(`/missions/${firstMission.id}`);
  });
});
