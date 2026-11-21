import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { buildMissionDeck } from '@ai-learning-adventure/learner';
import { getMission, getProgress, importProgress } from './helpers/api.ts';
import {
  escapeRegExp,
  openMissionDeckFromLesson,
  openReviewHub,
  startJourney,
} from './helpers/drivers.ts';
import {
  FIXED_TIME,
  makePortableProgress,
  makeQuizAttempt,
  seededMissions,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();
const firstMission = seededMissions[0]!;

async function openFirstMissionDeck(
  runtime: Awaited<ReturnType<typeof testContext.create>>,
  user: ReturnType<typeof userEvent.setup>,
) {
  const mission = await getMission(runtime, firstMission.id);
  const keyTerm = mission.lesson.find((block) => block.type === 'key_term');
  if (keyTerm === undefined || keyTerm.type !== 'key_term') {
    throw new Error('The first integration mission needs a key term.');
  }
  await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
  await startJourney(user);
  await screen.findByRole('heading', { level: 1, name: firstMission.title });
  await openMissionDeckFromLesson(user, keyTerm.term);
  await screen.findByRole('heading', { level: 1, name: `${firstMission.title} flashcards` });
  return mission;
}

function currentCardButton(): HTMLElement {
  return screen.getByRole('button', { name: /Card (front|back)/ });
}

describe('mission flashcard deck', () => {
  it('FLD-01 flips the first card and shows every authored learning field', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await openFirstMissionDeck(runtime, user);
    const card = mission.flashcards[0]!;

    expect(screen.getByText(`Card 1 of ${mission.flashcards.length}`)).toBeDefined();
    expect(screen.getByText(card.concept)).toBeDefined();
    await user.click(currentCardButton());

    expect(screen.getByText(card.definition)).toBeDefined();
    expect(screen.getByText(card.example)).toBeDefined();
    expect(screen.getByText(card.commonMistake!)).toBeDefined();
    expect(screen.getByText(card.learningTip!)).toBeDefined();
  });

  it('FLD-02 navigates Next and Prev while updating card content and counter', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await openFirstMissionDeck(runtime, user);
    const cards = buildMissionDeck(mission.flashcards);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(`Card 2 of ${cards.length}`)).toBeDefined();
    expect(screen.getByText(cards[1]!.concept)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Prev' }));
    expect(await screen.findByText(`Card 1 of ${cards.length}`)).toBeDefined();
    expect(screen.getByText(cards[0]!.concept)).toBeDefined();
  });

  it('FLD-03 marks a card Got it and persists the known rating', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await openFirstMissionDeck(runtime, user);
    const card = mission.flashcards[0]!;

    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(screen.getByRole('button', { name: 'Got it' }).className).toContain('flashcard-deck__rating--active');
    await waitFor(async () => {
      expect((await getProgress(runtime)).flashcardRatings[card.id] /* nosemgrep: gitlab.eslint.detect-object-injection */).toMatchObject({
        rating: 'got_it',
        reviewCount: 1,
      });
    });
  });

  it('FLD-04 marks a flipped card Needs work and adds its concepts to review', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await openFirstMissionDeck(runtime, user);
    const card = mission.flashcards[0]!;

    expect(screen.getByRole('button', { name: 'Needs work' }).hasAttribute('disabled')).toBe(true);
    await user.click(currentCardButton());
    await user.click(screen.getByRole('button', { name: 'Needs work' }));

    await waitFor(async () => {
      expect((await getProgress(runtime)).flashcardRatings[card.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.rating).toBe('needs_work');
    });
    const navigation = screen.getByRole('navigation', { name: 'Screen navigation' });
    await user.click(within(navigation).getByRole('button', { name: 'Home' }));
    await openReviewHub(user);
    const topics = screen.getByRole('list', { name: 'Weak topics' });
    expect(within(topics).getByRole('button', { name: new RegExp(escapeRegExp(card.conceptTags[0]!)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ })).toBeDefined();
  });

  it('FLD-05 finishes the deck with known, needs-work, and unrated totals', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await openFirstMissionDeck(runtime, user);

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(currentCardButton());
    await user.click(screen.getByRole('button', { name: 'Needs work' }));
    for (let index = 2; index < mission.flashcards.length; index += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Finish deck' }));

    const summary = await screen.findByRole('region', { name: 'Deck summary' });
    expect(summary.querySelector('.deck-summary__stat--known')?.textContent).toContain('1 got it');
    expect(summary.querySelector('.deck-summary__stat--needs')?.textContent).toContain('1 needs work');
    expect(summary.textContent).toContain(`${mission.flashcards.length - 2} not rated`);
  });

  it('FLD-06 starts a new pass containing only cards marked Needs work', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();
    const mission = await openFirstMissionDeck(runtime, user);
    const needsWorkCard = mission.flashcards[0]!;

    await user.click(currentCardButton());
    await user.click(screen.getByRole('button', { name: 'Needs work' }));
    for (let index = 1; index < mission.flashcards.length; index += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Finish deck' }));
    await user.click(screen.getByRole('button', { name: 'Review needs-work only' }));

    expect(await screen.findByText('Card 1 of 1')).toBeDefined();
    expect(screen.getByText(needsWorkCard.concept)).toBeDefined();
  });
});

describe('weak-topic review', () => {
  it('REV-01 ranks topics from quiz misses and Needs work ratings', async () => {
    const runtime = await testContext.create({ deferRender: true });
    const mission = await getMission(runtime, firstMission.id);
    const ratedCard = mission.flashcards[1]!;
    await importProgress(
      runtime,
      makePortableProgress({
        attempts: [makeQuizAttempt(firstMission.id, false, 'review')],
        flashcardRatings: {
          [ratedCard.id]: { rating: 'needs_work', reviewCount: 1, updatedAt: FIXED_TIME },
        },
      }),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openReviewHub(user);

    const topics = screen.getByRole('list', { name: 'Weak topics' });
    expect(within(topics).getByRole('button', { name: /^ai\s/ })).toBeDefined();
    expect(
      within(topics).getByRole('button', { name: new RegExp(escapeRegExp(ratedCard.conceptTags[0]!)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start review' })).toBeDefined();
  });

  it('REV-02 opens a topic-filtered deck from a weak-topic chip', async () => {
    const attempt = makeQuizAttempt(firstMission.id, false, 'topic');
    const runtime = await testContext.createWithProgress(
      makePortableProgress({ attempts: [attempt] }),
    );
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);
    const topic = attempt.weakTopics[0]!;

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openReviewHub(user);
    await user.click(within(screen.getByRole('list', { name: 'Weak topics' })).getByRole('button', { name: new RegExp(`^${escapeRegExp(topic)}\\s`) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ }));

    expect(await screen.findByRole('heading', { level: 1, name: `Review · ${topic}` })).toBeDefined();
    const matchingCards = mission.flashcards.filter((card) => card.conceptTags.includes(topic));
    expect(matchingCards.length).toBeGreaterThan(0);
    expect(screen.getByText(matchingCards[0]!.concept)).toBeDefined();
  });

  it('REV-03 clears rating-only weak topics after every review card is marked Got it', async () => {
    const runtime = await testContext.create({ deferRender: true });
    const mission = await getMission(runtime, firstMission.id);
    const ratedCard = mission.flashcards[0]!;
    await importProgress(
      runtime,
      makePortableProgress({
        flashcardRatings: {
          [ratedCard.id]: { rating: 'needs_work', reviewCount: 1, updatedAt: FIXED_TIME },
        },
      }),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openReviewHub(user);
    await user.click(screen.getByRole('button', { name: 'Start review' }));
    await screen.findByText(/Card 1 of \d+/);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'No cards to review' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Go back' }));

    expect(await screen.findByText(/Nothing to review yet/)).toBeDefined();
  });

  it('REV-04 shows an encouraging empty state when no weak topics exist', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openReviewHub(user);

    expect(await screen.findByText(/Nothing to review yet.*great work/)).toBeDefined();
    const section = screen.getByRole('region', { name: 'Review' });
    expect(within(section).getByRole('button', { name: 'Explore missions' })).toBeDefined();
  });
});
