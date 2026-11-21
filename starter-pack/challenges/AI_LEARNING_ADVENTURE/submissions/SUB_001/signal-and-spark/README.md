# Signal & Spark

Signal & Spark is a browser-based learning app for people who are new to AI. It turns the course into eight short missions instead of presenting one long lesson. Each mission combines an explanation, a worked example, a checkpoint, seven quiz questions, four flashcards, and a badge.

The demo runs locally. It does not need an account, API key, paid service, or network connection after installation.

## Run the app

Use Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:5173` in a browser. Vite will print a different port if 5173 is already in use.

To check the production build:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

The separate `signal-and-spark-demo.mp4` submission artifact is a 4 minute 24 second live walkthrough. It uses on-screen captions and covers the learner journey, answer feedback, local sample tutor, progress update, practice tools, content editing, and the incomplete-content publishing gate.

## A quick evaluation path

1. Start on Journey and open `Prompt Engineering`, the current mission.
2. Move through Learn and Try, then answer a checkpoint question. A wrong answer gives an explanation, a hint, and a review topic instead of ending the attempt.
3. Open Practice to switch between mixed quizzes and flashcards.
4. Open AI Tutor and ask for an example, a summary, a hint, or a recommendation. Turn on AI Only Mode to use the tutor without the lesson canvas.
5. Open Progress to review scores and badges or reset the demo.
6. Open Content manager from the footer. Edit a mission, its questions, or its flashcards. The manager refuses to publish a mission until it has complete lesson text, at least five questions, at least three flashcards, a checkpoint, and a badge.

## Course content

The seed course has eight missions across five difficulty levels:

1. What AI Can Do
2. Generative AI
3. How LLMs Work
4. Prompt Engineering
5. Tokens & Context
6. Hallucinations
7. Responsible AI
8. Retrieval

In total, the course includes 56 quiz questions and 32 flashcards. The tests enforce the content minimums, unique item IDs, and valid answer indices.

## How the tutor works

The tutor uses a small local retrieval layer over the selected mission. It classifies the request, selects relevant lesson passages, and returns a response with the source topic shown beside it. Difficulty controls the wording and amount of detail. The hint path deliberately withholds the answer.

This approach keeps the demo predictable and private while still supporting explanations, examples, summaries, hints, answer feedback, and next-mission recommendations. It is not a remote generative model, and it never sends learner text to a server.

## Fallback and sample mode

The committed local tutor is the app's fallback mode. The interface labels it as a local sample tutor, and every response is generated from reviewed mission fields and quiz feedback. There is no provider setup step and no silent switch to a network service. This means evaluators can use the tutor, AI Only Mode, hints, answer explanations, and recommendations immediately after `npm ci`.

## Content manager

The manager has separate editors for missions, quiz questions, and flashcards. Authors can search the mission list, create a draft, enable or disable content, preview it as a learner, save it locally, and publish it after the readiness checks pass.

Drafts and learner progress use two namespaced `localStorage` entries. Reset demo restores the reviewed seed content and the initial progress state. No learner profile or personal information is collected.

## Project structure

```text
src/
  components/       Shared interface and brand components
  data/seed.ts      Eight reviewed missions and practice content
  features/         Journey, mission, practice, tutor, progress, and admin views
  lib/storage.ts    Local content and progress store
  lib/tutor.ts      Grounded local tutor logic
```

The app uses React, TypeScript, Vite, and Lucide icons. There is no backend and no runtime third-party API. Dependency license notices are included in `THIRD_PARTY_NOTICES.txt`.

## Current boundaries

Content and progress belong to the current browser only. Clearing site data removes them. The local tutor answers from the included course material, so it does not handle open-domain questions. These boundaries are intentional for an offline demo and are visible in the interface.
