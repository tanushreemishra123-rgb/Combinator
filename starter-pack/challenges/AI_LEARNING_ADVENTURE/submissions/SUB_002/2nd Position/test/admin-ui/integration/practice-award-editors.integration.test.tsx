import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  AdminAwardDoc,
  AdminFlashcardDoc,
  AdminQuestionDoc,
  AwardRule,
} from '@ai-learning-adventure/types';
import { getContent } from './helpers/api.ts';
import { fillField, saveDraft, waitForInventory } from './helpers/drivers.ts';
import {
  firstAward,
  firstFlashcard,
  firstMission,
  firstQuestion,
  secondMission,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();

describe('question editor', () => {
  it('QST-01 creates and saves a valid multiple-choice question', async () => {
    const runtime = await testContext.create({ route: '/questions' });
    const user = userEvent.setup();
    await waitForInventory('question');
    await user.click(screen.getByRole('button', { name: 'New' }));
    await screen.findByLabelText('Question stem');

    await user.selectOptions(screen.getByLabelText('Mission'), firstMission.id);
    await fillField(user, 'Question stem', 'What does this question integration test?');
    await fillField(user, 'Option 1 text', 'A complete admin data flow');
    await fillField(user, 'Option 2 text', 'Only static presentation');
    await fillField(user, 'Correct-answer explanation', 'It exercises the complete data flow.');
    await fillField(user, 'Incorrect-answer explanation', 'The test includes persistence.');
    await fillField(user, 'Concept tags', 'integration, admin');
    await saveDraft(user);

    const id = runtime.currentPath.slice(runtime.currentPath.lastIndexOf('/') + 1);
    expect((await getContent<AdminQuestionDoc>(runtime, 'question', id)).doc).toMatchObject({
      missionId: firstMission.id,
      type: 'multiple_choice',
      stem: 'What does this question integration test?',
      selectionMode: 'single',
      correctExplanation: 'It exercises the complete data flow.',
      incorrectExplanation: 'The test includes persistence.',
      conceptTags: ['integration', 'admin'],
    });
  });

  it('QST-02 adds and removes options and persists the final set', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Add option' });

    await user.click(screen.getByRole('button', { name: 'Add option' }));
    await fillField(user, 'Option 4 text', 'A fourth integration option');
    await user.click(screen.getByRole('button', { name: 'Remove option 2' }));
    await saveDraft(user);

    const options = (await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc.options;
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.text)).toContain('A fourth integration option');
  });

  it('QST-03 persists exactly one changed correct answer in single-answer mode', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Option 2 is correct');

    await user.click(screen.getByLabelText('Option 2 is correct'));
    await saveDraft(user);

    const correct = (await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc.options.filter(
      (option) => option.isCorrect,
    );
    expect(correct).toHaveLength(1);
    expect(correct[0]?.id).toBe('b');
  });

  it('QST-04 persists multiple correct answers in multi-answer mode', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Selection mode');

    await user.selectOptions(screen.getByLabelText('Selection mode'), 'multiple');
    await user.click(screen.getByLabelText('Option 2 is correct'));
    await saveDraft(user);

    const doc = (await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc;
    expect(doc.selectionMode).toBe('multiple');
    expect(doc.options.filter((option) => option.isCorrect)).toHaveLength(2);
  });

  it('QST-05 creates canonical True and False options when type changes', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Question type');

    await user.selectOptions(screen.getByLabelText('Question type'), 'true_false');
    await user.click(screen.getByRole('radio', { name: 'False' }));
    await saveDraft(user);

    const doc = (await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc;
    expect(doc.type).toBe('true_false');
    expect(doc.options.map((option) => option.text)).toEqual(['True', 'False']);
    expect(doc.options.find((option) => option.isCorrect)?.text).toBe('False');
  });

  it('QST-06 persists scenario text and written-reasoning preference', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Question type');

    await user.selectOptions(screen.getByLabelText('Question type'), 'scenario');
    await fillField(user, 'Scenario', 'A learner reviews an AI-generated answer before use.');
    await user.click(screen.getByLabelText('Allow written reasoning'));
    await saveDraft(user);

    expect((await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc).toMatchObject({
      type: 'scenario',
      scenario: 'A learner reviews an AI-generated answer before use.',
      allowsReasoning: true,
    });
  });

  it('QST-07 persists mission assignment, tags, and difficulty', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Mission');

    await user.selectOptions(screen.getByLabelText('Mission'), secondMission.id);
    await fillField(user, 'Concept tags', 'changed-tag, second-tag');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'advanced');
    await saveDraft(user);

    expect((await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc).toMatchObject({
      missionId: secondMission.id,
      conceptTags: ['changed-tag', 'second-tag'],
      difficulty: 'advanced',
    });
  });

  it('QST-08 reorders answer options through the pointer drag control', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    const handles = await screen.findAllByRole('button', { name: /Reorder option/ });
    const source = handles[0]!;
    handles.forEach((handle, index) => {
      const row = handle.parentElement!;
      const top = index * 80;
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: top,
        top,
        left: 0,
        right: 400,
        bottom: top + 60,
        width: 400,
        height: 60,
        toJSON: () => ({}),
      } as DOMRect);
    });

    fireEvent.pointerDown(source, { button: 0, clientX: 20, clientY: 20, pointerId: 1, isPrimary: true });
    fireEvent.pointerMove(document, { clientX: 20, clientY: 120, pointerId: 1, isPrimary: true });
    fireEvent.pointerMove(document, { clientX: 20, clientY: 120, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(document, { clientX: 20, clientY: 120, pointerId: 1, isPrimary: true });
    await waitFor(() => {
      const optionFields = screen.getAllByLabelText(/Option \d text/).map((field) => field as HTMLInputElement);
      expect(optionFields[1]?.value).toBe(
        'A computer system designed to perform tasks that can require human-like judgment',
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    await saveDraft(user);

    expect((await getContent<AdminQuestionDoc>(runtime, 'question', firstQuestion.id)).doc.options[1]?.id).toBe('a');
  });

  it('QST-09 updates the learner preview from unsaved question edits', async () => {
    await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Question stem');
    const previewHeading = screen.getByText('Learner preview');
    const preview = previewHeading.parentElement;
    if (preview === null) throw new Error('Question learner preview was not rendered.');

    await fillField(user, 'Question stem', 'Unsaved learner preview question');
    await fillField(user, 'Option 1 text', 'Unsaved preview option');

    expect(preview.textContent).toContain('Unsaved learner preview question');
    expect(preview.textContent).toContain('Unsaved preview option');
    expect(screen.getByText('Unsaved changes')).toBeDefined();
  });

  it('QST-11 cancels question editing and navigates back to /questions', async () => {
    const runtime = await testContext.create({ route: `/questions/${firstQuestion.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Question type');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(runtime.currentPath).toBe('/questions');
  });
});

describe('flashcard editor', () => {
  it('FLC-01 creates and saves a complete flashcard', async () => {
    const runtime = await testContext.create({ route: '/flashcards' });
    const user = userEvent.setup();
    await waitForInventory('flashcard');
    await user.click(screen.getByRole('button', { name: 'New' }));
    await screen.findByLabelText('Concept');

    await user.selectOptions(screen.getByLabelText('Mission'), firstMission.id);
    await fillField(user, 'Concept', 'Created integration card');
    await fillField(user, 'Definition', 'A card created through the real admin form.');
    await fillField(user, 'Example', 'The form saves the card into the API database.');
    await fillField(user, 'Learning tip', 'Verify persisted data after saving.');
    await fillField(user, 'Concept tags', 'integration, persistence');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'intermediate');
    await saveDraft(user);

    const id = runtime.currentPath.slice(runtime.currentPath.lastIndexOf('/') + 1);
    expect((await getContent<AdminFlashcardDoc>(runtime, 'flashcard', id)).doc).toMatchObject({
      missionId: firstMission.id,
      concept: 'Created integration card',
      definition: 'A card created through the real admin form.',
      example: 'The form saves the card into the API database.',
      learningTip: 'Verify persisted data after saving.',
      conceptTags: ['integration', 'persistence'],
      difficulty: 'intermediate',
    });
  });

  it('FLC-02 FLC-03 assigns and then unassigns a flashcard', async () => {
    const runtime = await testContext.create({ route: `/flashcards/${firstFlashcard.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Mission');

    await user.selectOptions(screen.getByLabelText('Mission'), secondMission.id);
    await saveDraft(user);
    expect((await getContent<AdminFlashcardDoc>(runtime, 'flashcard', firstFlashcard.id)).doc.missionId).toBe(
      secondMission.id,
    );

    await user.selectOptions(screen.getByLabelText('Mission'), '');
    await saveDraft(user);
    expect((await getContent<AdminFlashcardDoc>(runtime, 'flashcard', firstFlashcard.id)).doc.missionId).toBeNull();
  });

  it('FLC-04 updates both sides of the unsaved card preview', async () => {
    await testContext.create({ route: `/flashcards/${firstFlashcard.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Concept');

    await fillField(user, 'Concept', 'Unsaved preview concept');
    expect(screen.getAllByText('Unsaved preview concept').length).toBeGreaterThan(0);
    await fillField(user, 'Definition', 'Unsaved preview definition');
    await user.click(screen.getByRole('button', { name: 'Flip card' }));

    expect(screen.getAllByText('Unsaved preview concept').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unsaved preview definition').length).toBeGreaterThan(0);
  });

  it('FLC-05 blocks saving when common mistake and learning tip are both omitted', async () => {
    const runtime = await testContext.create({ route: `/flashcards/${firstFlashcard.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Common mistake');
    const before = await getContent(runtime, 'flashcard', firstFlashcard.id);

    await user.clear(screen.getByLabelText('Common mistake'));
    await user.clear(screen.getByLabelText('Learning tip'));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Fix the blocking validation issues before saving.',
    );
    expect((await getContent(runtime, 'flashcard', firstFlashcard.id)).revision).toBe(before.revision);
  });

  it('FLC-06 cancels flashcard editing and navigates back to /flashcards', async () => {
    const runtime = await testContext.create({ route: `/flashcards/${firstFlashcard.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Concept');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(runtime.currentPath).toBe('/flashcards');
  });
});

describe('award editor', () => {
  it('AWD-01 creates a badge linked to a mission', async () => {
    const runtime = await testContext.create({ route: '/badges' });
    const user = userEvent.setup();
    await waitForInventory('award');
    await user.click(screen.getByRole('button', { name: 'New' }));
    await screen.findByLabelText('Name');

    await fillField(user, 'Name', 'Created integration badge');
    await fillField(user, 'Icon key', 'badge-created-integration');
    await fillField(user, 'Description', 'Created through the award editor integration flow.');
    await user.selectOptions(screen.getByLabelText('Linked mission'), firstMission.id);
    await saveDraft(user);

    const id = runtime.currentPath.slice(runtime.currentPath.lastIndexOf('/') + 1);
    expect((await getContent<AdminAwardDoc>(runtime, 'award', id)).doc).toMatchObject({
      kind: 'badge',
      name: 'Created integration badge',
      icon: 'badge-created-integration',
      description: 'Created through the award editor integration flow.',
      missionId: firstMission.id,
      rule: { type: 'mission_completed', missionId: firstMission.id },
    });
  });

  it('AWD-02 changes a badge to a milestone and clears badge-only linkage', async () => {
    const runtime = await testContext.create({ route: `/badges/${firstAward.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Kind');

    await user.selectOptions(screen.getByLabelText('Kind'), 'milestone');
    expect(screen.queryByLabelText('Linked mission')).toBeNull();
    expect(screen.getByLabelText('Rule')).toBeDefined();
    await saveDraft(user);

    const doc = (await getContent<AdminAwardDoc>(runtime, 'award', firstAward.id)).doc;
    expect(doc.kind).toBe('milestone');
    expect(doc.missionId).toBeUndefined();
    expect(doc.rule).toEqual({ type: 'percent_complete', minPercent: 100 });
  });

  const ruleCases: ReadonlyArray<{
    id: string;
    ruleType: AwardRule['type'];
    configure: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
    expected: AwardRule;
  }> = [
    {
      id: 'AWD-03',
      ruleType: 'mission_completed',
      configure: async (user) => user.selectOptions(screen.getByLabelText('Mission'), secondMission.id),
      expected: { type: 'mission_completed', missionId: secondMission.id as never },
    },
    {
      id: 'AWD-04',
      ruleType: 'track_completed',
      configure: async (user) => user.selectOptions(screen.getByLabelText('Track'), 'responsible_use'),
      expected: { type: 'track_completed', levelTrack: 'responsible_use' },
    },
    {
      id: 'AWD-05',
      ruleType: 'score_threshold',
      configure: async (user) => {
        await fillField(user, 'Minimum score (%)', '88');
        await user.selectOptions(screen.getByLabelText('Mission (optional)'), secondMission.id);
      },
      expected: { type: 'score_threshold', minScorePercent: 88, missionId: secondMission.id as never },
    },
    {
      id: 'AWD-06',
      ruleType: 'streak',
      configure: async (user) => fillField(user, 'Streak length', '6'),
      expected: { type: 'streak', length: 6 },
    },
    {
      id: 'AWD-07',
      ruleType: 'percent_complete',
      configure: async (user) => fillField(user, 'Minimum percent', '75'),
      expected: { type: 'percent_complete', minPercent: 75 },
    },
  ];

  it.each(ruleCases)('$id persists the $ruleType milestone rule', async ({ ruleType, configure, expected }) => {
    const runtime = await testContext.create({ route: `/badges/${firstAward.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Kind');
    await user.selectOptions(screen.getByLabelText('Kind'), 'milestone');
    await user.selectOptions(screen.getByLabelText('Rule'), ruleType);

    await configure(user);
    await saveDraft(user);

    expect((await getContent<AdminAwardDoc>(runtime, 'award', firstAward.id)).doc.rule).toEqual(expected);
  });

  it('AWD-08 blocks a badge save when its required mission relationship is omitted', async () => {
    const runtime = await testContext.create({ route: '/badges' });
    const user = userEvent.setup();
    await waitForInventory('award');
    await user.click(screen.getByRole('button', { name: 'New' }));
    await screen.findByLabelText('Name');
    await fillField(user, 'Name', 'Badge without a mission');
    await fillField(user, 'Icon key', 'badge-no-mission');
    await fillField(user, 'Description', 'This otherwise complete badge has no linked mission.');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Fix the blocking validation issues before saving.',
    );
  });

  it('AWD-09 saves an existing seeded badge without validation errors', async () => {
    const runtime = await testContext.create({ route: `/badges/${firstAward.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Name');

    await fillField(user, 'Description', 'Updated seeded badge description');
    await saveDraft(user);

    expect(screen.queryByRole('alert')).toBeNull();
    const doc = (await getContent<AdminAwardDoc>(runtime, 'award', firstAward.id)).doc;
    expect(doc.description).toBe('Updated seeded badge description');
    expect(doc.rule).toEqual({ type: 'mission_completed', missionId: firstAward.missionId });
  });

  it('AWD-10 cancels badge editing and navigates back to /badges', async () => {
    const runtime = await testContext.create({ route: `/badges/${firstAward.id}` });
    const user = userEvent.setup();
    await screen.findByLabelText('Name');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(runtime.currentPath).toBe('/badges');
  });
});
