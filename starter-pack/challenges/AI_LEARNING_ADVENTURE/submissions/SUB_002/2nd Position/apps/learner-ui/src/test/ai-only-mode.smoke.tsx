import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MissionDetail } from '@ai-learning-adventure/types';
import {
  makeMissionDetail,
  makeMissionProgress,
  makeSnapshot,
  seedCatalog,
} from './fixtures.ts';
import { renderApp, scrollIntoViewMock } from './harness.tsx';

const catalog = seedCatalog();

function detailsFor(): Record<string, MissionDetail> {
  return Object.fromEntries(
    catalog.missions.map((mission, index) => [
      mission.id,
      makeMissionDetail({
        id: mission.id,
        title: mission.title,
        levelTrack: mission.levelTrack,
        trackOrder: mission.trackOrder,
        ...(mission.prerequisiteMissionId !== undefined
          ? { prerequisiteMissionId: mission.prerequisiteMissionId }
          : {}),
        questions: [
          {
            id: `${mission.id}-question` as never,
            missionId: mission.id,
            type: 'multiple_choice',
            stem: `What is the main idea in ${mission.title}?`,
            selectionMode: 'single',
            options: [
              { id: `${mission.id}-correct`, text: `Use evidence for ${mission.title}`, isCorrect: true },
              { id: `${mission.id}-wrong`, text: 'Ignore the learning goal', isCorrect: false },
            ],
            correctExplanation: 'The mission connects its goal to the available evidence.',
            incorrectExplanation: 'Ignoring the learning goal misses the mission reasoning.',
            conceptTags: [index === 0 ? 'ai-basics' : `topic-${index + 1}`],
          },
        ],
      }),
    ]),
  );
}

async function openAiOnly(user: ReturnType<typeof userEvent.setup>) {
  const shortcuts = await screen.findByRole('navigation', { name: 'More ways to learn' });
  await user.click(within(shortcuts).getByRole('button', { name: 'AI Only Mode' }));
  await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' });
  await screen.findByRole('heading', { level: 2, name: 'Where should we begin?' });
}

function aiProgressPuts(fetchMock: ReturnType<typeof renderApp>['fetchMock']) {
  return fetchMock.mock.calls.filter(
    (call) => String(call[0]).includes('/missions/mission-1/progress') && call[1]?.method === 'PUT',
  );
}

describe('AI Only Mode shell and Q&A', () => {
  it('opens the conversation-first shell and sends grounded mock Q&A with source navigation', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    expect(screen.getByRole('navigation', { name: 'AI learning scopes' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Explain simply' }).length).toBeGreaterThan(0);
    expect((screen.getByLabelText('Learning scope') as HTMLSelectElement).options).toHaveLength(
      catalog.missions.length + 1,
    );
    expect(document.querySelector('.ai-only-rail__topics')).toBeNull();
    expect(window.location.pathname).toBe('/');

    const composer = screen.getByLabelText('Ask about the mission collection');
    await user.type(composer, 'What is an AI model?{Enter}');

    expect(await screen.findByText(/This sample tutor response is scoped to/)).toBeDefined();
    expect(screen.getByText('Sample / mock AI response')).toBeDefined();
    const sources = screen.getByLabelText('Sources');
    await user.click(within(sources).getByRole('button', { name: /What Is AI\?/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'What Is AI?' })).toBeDefined();
    expect(window.location.pathname).toBe('/');

    const navigation = screen.getByRole('navigation', { name: 'Screen navigation' });
    await user.click(within(navigation).getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' })).toBeDefined();
    expect(screen.getByText('What is an AI model?')).toBeDefined();
  });

  it('auto-scrolls the conversation to the latest message as it streams', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Ask about the mission collection'), 'Scroll to me{Enter}');
    await screen.findByText(/This sample tutor response is scoped to/);

    const end = document.querySelector('.ai-only-conversation__end');
    expect(end).not.toBeNull();
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith({ block: 'end', behavior: 'auto' });
  });

  it('keeps separate conversations per scope and restores them when switching back', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    await user.selectOptions(screen.getByLabelText('Learning scope'), 'mission:mission-1');
    expect(await screen.findByRole('heading', { level: 2, name: /Walk through What Is AI\?/ })).toBeDefined();
    await user.type(screen.getByLabelText('Ask about What Is AI?'), 'Explain this mission{Enter}');
    expect(await screen.findByText('Explain this mission')).toBeDefined();

    await user.selectOptions(screen.getByLabelText('Learning scope'), 'general');
    expect(await screen.findByRole('heading', { level: 2, name: 'Where should we begin?' })).toBeDefined();
    expect(screen.queryByText('Explain this mission')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Learning scope'), 'mission:mission-1');
    expect(await screen.findByText('Explain this mission')).toBeDefined();
  });

  it('disables locked mission scopes until their prerequisites are complete', async () => {
    const user = userEvent.setup();
    const initial = renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    const scopes = screen.getByRole('navigation', { name: 'AI learning scopes' });
    expect(within(scopes).getByRole('button', { name: 'What Is AI?' }).hasAttribute('disabled')).toBe(false);
    expect(within(scopes).getByRole('button', { name: 'Generative AI' }).hasAttribute('disabled')).toBe(true);
    expect(within(scopes).getByRole('button', { name: 'What Is an LLM?' }).hasAttribute('disabled')).toBe(true);
    expect((screen.getByLabelText('Learning scope') as HTMLSelectElement).options[2]?.disabled).toBe(true);

    const completed = makeSnapshot({
      missions: {
        'mission-1': makeMissionProgress('mission-1', { status: 'completed' }),
      },
    });
    initial.unmount();

    renderApp(catalog, completed, { missionDetails: detailsFor() });
    await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' });
    const updatedScopes = screen.getByRole('navigation', { name: 'AI learning scopes' });
    expect(within(updatedScopes).getByRole('button', { name: 'Generative AI' }).hasAttribute('disabled')).toBe(false);
    expect(within(updatedScopes).getByRole('button', { name: 'What Is an LLM?' }).hasAttribute('disabled')).toBe(true);
  });

  it('persists the active scope, draft, and completed conversation across reload', async () => {
    const user = userEvent.setup();
    const first = renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);
    await user.selectOptions(screen.getByLabelText('Learning scope'), 'mission:mission-1');
    await user.type(screen.getByLabelText('Ask about What Is AI?'), 'What should I remember?{Enter}');
    await screen.findByText('What should I remember?');
    await screen.findByText(/This sample tutor response/);
    await user.type(screen.getByLabelText('Ask about What Is AI?'), 'My saved draft');
    first.unmount();

    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    expect(await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' })).toBeDefined();
    expect(await screen.findByText('What should I remember?')).toBeDefined();
    expect((screen.getByLabelText('Ask about What Is AI?') as HTMLTextAreaElement).value).toBe('My saved draft');
  });

  it('normalizes a previously persisted topic scope to all missions', async () => {
    sessionStorage.setItem(
      'learner-ui.ai-session.v1',
      JSON.stringify({ version: 1, aiOnlyScope: { kind: 'topic', topic: 'ai-basics' } }),
    );
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    expect((screen.getByLabelText('Learning scope') as HTMLSelectElement).value).toBe('general');
  });
});

describe('quick actions', () => {
  it('renders deterministic recommendations and starts their mission', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    await user.click(screen.getByRole('button', { name: /What should I learn next\?/ }));
    expect(await screen.findByText('Progress-aware next step')).toBeDefined();
    expect(screen.getByText('What Is AI?', { selector: '.ai-recommendation-card h3' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Start mission' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'What Is AI?' })).toBeDefined();
  });

  it('creates a structured summary through a target picker', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    await user.click(screen.getByRole('button', { name: 'Summarize a mission' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a mission to summarize' });
    await user.click(within(dialog).getByRole('button', { name: 'Create summary' }));

    expect(await screen.findByRole('heading', { level: 3, name: 'Key takeaways' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add to review' })).toBeDefined();
  });

  it('validates review text and renders the four-part coaching frame', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    await user.click(screen.getByRole('button', { name: 'Review my answer' }));
    let dialog = await screen.findByRole('dialog', { name: 'Share an answer for coaching' });
    await user.click(within(dialog).getByRole('button', { name: 'Get feedback' }));
    expect(await within(dialog).findByText('Write an answer before requesting feedback.')).toBeDefined();

    await user.type(within(dialog).getByLabelText('Your answer or reasoning'), 'AI learns patterns from examples and needs human review.');
    await user.click(within(dialog).getByRole('button', { name: 'Get feedback' }));
    dialog = screen.queryByRole('dialog', { name: 'Share an answer for coaching' }) as HTMLElement;
    await waitFor(() => expect(dialog).toBeNull());
    expect(await screen.findByText('What you got right')).toBeDefined();
    expect(screen.getByText("What's missing")).toBeDefined();
    expect(screen.getByText('One improvement')).toBeDefined();
    expect(screen.getByText('Encouragement')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Revise and resubmit' })).toBeDefined();
  });

  it('returns a safe hint without revealing the correct option', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    await user.click(screen.getByRole('button', { name: 'Give me a hint' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a question for your hint' });
    await user.click(within(dialog).getByRole('button', { name: 'Get hint' }));
    const response = await screen.findByText(/Start by identifying the concept/);
    expect(response.textContent).not.toContain('Use evidence for What Is AI?');
  });
});

describe('conversational walkthrough', () => {
  it('resumes authored turns and never marks the checkpoint or quiz complete', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);
    await user.selectOptions(screen.getByLabelText('Learning scope'), 'mission:mission-1');

    await user.click(await screen.findByRole('button', { name: 'Walk me through this mission' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Your objective' })).toBeDefined();
    expect(screen.getByText('Objective for mission-1')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'I get it - next' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'I get it - next' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Example' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'I get it - next' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Checkpoint' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Finish walkthrough' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'You covered the mission path' })).toBeDefined();

    const bodies = aiProgressPuts(fetchMock).map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies.some((body) => body.furthestStep === 'example')).toBe(true);
    expect(bodies.some((body) => body.furthestStep === 'checkpoint')).toBe(true);
    expect(bodies.every((body) => body.checkpointCompleted !== true && body.completed !== true)).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/quiz-attempts'))).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Take the full quiz' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Checkpoint' })).toBeDefined();
  });

  it('uses authored quiz grading inside the conversation without creating an attempt', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(
      catalog,
      makeSnapshot({
        missions: {
          'mission-1': makeMissionProgress('mission-1', { status: 'in_progress' }),
        },
      }),
      { missionDetails: detailsFor() },
    );
    await openAiOnly(user);
    await user.selectOptions(screen.getByLabelText('Learning scope'), 'mission:mission-1');
    await user.click(await screen.findByRole('button', { name: 'Walk me through this mission' }));
    await user.click(screen.getByRole('button', { name: 'Quiz me on this' }));

    await user.click(screen.getByLabelText('Use evidence for What Is AI?'));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByText('That reasoning fits.')).toBeDefined();
    expect(screen.getByText('The mission connects its goal to the available evidence.')).toBeDefined();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/quiz-attempts'))).toBe(false);
  });

  it('clears all current chat messages when clicking the Clear button', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    const clearButton = screen.getByRole('button', { name: 'Clear' });
    expect(clearButton).toBeDefined();
    expect((clearButton as HTMLButtonElement).disabled).toBe(true);

    const composer = screen.getByLabelText('Ask about the mission collection');
    await user.type(composer, 'Explain AI models{Enter}');

    expect(await screen.findByText(/This sample tutor response is scoped to/)).toBeDefined();
    expect(screen.queryByRole('heading', { level: 2, name: 'Where should we begin?' })).toBeNull();
    expect((clearButton as HTMLButtonElement).disabled).toBe(false);

    // Click Clear button
    await user.click(clearButton);

    // Conversation is cleared and welcome screen is back
    expect(await screen.findByRole('heading', { level: 2, name: 'Where should we begin?' })).toBeDefined();
    expect(screen.queryByText(/This sample tutor response is scoped to/)).toBeNull();
    expect((clearButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables locked mission source chips and keeps unlocked source chips interactive on AI guide cards', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    const composer = screen.getByLabelText('Ask about the mission collection');
    await user.type(composer, 'What are the missions about?{Enter}');

    expect(await screen.findByText(/This sample tutor response is scoped to/)).toBeDefined();
    const sources = screen.getByLabelText('Sources');

    // mission-1 is unlocked (available)
    const mission1Source = within(sources).getByRole('button', { name: /What Is AI\?/ });
    expect((mission1Source as HTMLButtonElement).disabled).toBe(false);

    // mission-2 is locked (prerequisite mission-1 not completed)
    const mission2Source = within(sources).getByRole('button', { name: /Generative AI/ });
    expect((mission2Source as HTMLButtonElement).disabled).toBe(true);
    expect(mission2Source.getAttribute('aria-disabled')).toBe('true');
    expect(mission2Source.getAttribute('title')).toContain('Complete "What Is AI?" first');

    // Clicking locked source should not change page / navigate
    await user.click(mission2Source);
    expect(screen.queryByRole('heading', { level: 1, name: 'Generative AI' })).toBeNull();

    // Clicking unlocked source navigates to mission
    await user.click(mission1Source);
    expect(await screen.findByRole('heading', { level: 1, name: 'What Is AI?' })).toBeDefined();
  });

  it('renders Question dropdown with multi-line items and allows question selection in quick actions picker', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: detailsFor() });
    await openAiOnly(user);

    await user.click(screen.getByRole('button', { name: 'Give me a hint' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a question for your hint' });

    // Question dropdown trigger is rendered
    const questionTrigger = within(dialog).getByRole('combobox', { name: /Question/i });
    expect(questionTrigger).toBeDefined();
    expect(questionTrigger.getAttribute('aria-expanded')).toBe('false');

    // Open dropdown
    await user.click(questionTrigger);
    expect(questionTrigger.getAttribute('aria-expanded')).toBe('true');

    // Listbox with options
    const listbox = within(dialog).getByRole('listbox');
    expect(listbox).toBeDefined();
    const options = within(listbox).getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);

    // Click an option to select it
    await user.click(options[0]!);
    expect(questionTrigger.getAttribute('aria-expanded')).toBe('false');

    // Submit hint
    await user.click(within(dialog).getByRole('button', { name: 'Get hint' }));
    expect(await screen.findByText(/Start by identifying the concept/)).toBeDefined();
  });
});
