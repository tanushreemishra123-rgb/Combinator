# AI Learning Adventure

AI Learning Adventure teaches the basics of artificial intelligence through short missions, quizzes, flashcards, and guided conversations with an AI tutor.

The application has two parts:

- **Learner application:** Complete missions and track your learning.
- **Content management:** Create, review, and publish learning material.

No learner account is required. Your progress is associated with this application in your current browser and is not shared between devices.

## Table of contents

- [Demo](#demo)
- [How to run the application](#how-to-run-the-application)
- [How to start the learning journey](#how-to-start-the-learning-journey)
- [How to use the AI tutor](#how-to-use-the-ai-tutor)
- [How AI Only Mode works](#how-ai-only-mode-works)
- [How to take quizzes](#how-to-take-quizzes)
- [How to review flashcards](#how-to-review-flashcards)
- [How progress tracking works](#how-progress-tracking-works)
- [How to access content management](#how-to-access-content-management)
- [How to create or edit missions](#how-to-create-or-edit-missions)
- [How to publish content](#how-to-publish-content)
- [How AI fallback and mock mode work](#how-ai-fallback-and-mock-mode-work)
- [Known limitations and assumptions](#known-limitations-and-assumptions)

## Demo

<video src="ai-learning-adventure-demo.webm" controls title="AI Learning Adventure demo"></video>

[Download or watch the demo video](ai-learning-adventure-demo.webm)

## How to run the application

You need:

- Node.js 24 or newer and pnpm 11 for local runs
- Docker with Docker Compose for containerized runs

### Development

From the project folder, install dependencies and start all services in development mode:

```bash
pnpm install
pnpm run dev
```

### Production build

To build all services and run the production builds locally:

```bash
pnpm install
pnpm build
pnpm start
```

### Docker Compose

To build and start all services with Docker Compose:

```bash
docker compose up --build
```

Keep the selected command running while you use the application. Then open the area you need:

- Learner application: [http://localhost:5173](http://localhost:5173)
- Content management: [http://localhost:6173](http://localhost:6173)
- Supporting API: [http://localhost:4000](http://localhost:4000)

All three services start together. If a page does not load, check that the command you used to start the application is still running.

## How to start the learning journey

1. Open the [learner application](http://localhost:5173).
2. Select **Start your adventure**. If you have already begun, select **Continue your adventure** instead.
3. Follow the mission through its objective, lesson, example, checkpoint, quiz, and result.
4. Complete the mission to unlock the next mission in its learning path.

Select **Explore missions** if you want to browse the full mission map or list. A locked mission shows which earlier mission you need to complete first.

## How to use the AI tutor

The AI tutor can help while you learn. Depending on where you are in the application, you can:

- Ask a question about the learning material.
- Request a simpler explanation or another example.
- Ask for a hint without revealing the answer.
- Submit a written response for constructive feedback.
- Request a summary or a recommended next step.

AI responses may appear gradually. You can stop a request if it is taking too long. If live AI is not set up, the application provides a clearly labeled sample response so that you can continue learning.

To choose or configure an AI service, open **Settings**, then **AI provider**. Live AI is optional; see [How AI fallback and mock mode work](#how-ai-fallback-and-mock-mode-work).

## How AI Only Mode works

Select **AI Only Mode** on the learner home screen to learn through conversation instead of starting with the normal mission player.

Use **Learning scope** to choose what the conversation should cover:

- Choose the general scope to ask about the available mission collection.
- Choose an unlocked mission to focus the conversation on that mission.

Locked missions cannot be selected until you complete their prerequisites. Each scope keeps a separate conversation, so you can switch away and return later. Select **Clear** to remove the messages in the current conversation.

AI Only Mode also provides quick actions to:

- Find out what to learn next.
- Summarize a mission and add the summary to review.
- Get feedback on your own answer.
- Request a safe hint for a question.
- Walk through a mission conversationally.

A conversational walkthrough can explain the objective, lesson, example, and checkpoint. Its checkpoint and practice question do not count as the official mission checkpoint or quiz. To complete the mission and save a formal quiz result, select **Take the full quiz**.

## How to take quizzes

The full quiz becomes available when you reach the quiz step of a mission.

1. Select **Open the quiz**.
2. Read the question and choose your answer. Some questions ask you to select every answer that applies.
3. Add your reasoning when an optional reasoning box is shown.
4. Select **Submit answer** to see whether the answer is correct and read the explanation.
5. Continue until you can select **See results**.

The result screen shows your score, whether you passed, topics that need review, and a recap of your answers. You can retry the quiz or follow the recommended next step. An unfinished quiz resumes from the same place after a page reload in the same browser.

## How to review flashcards

You can open flashcards from a completed mission or select **Review** on the learner home screen.

1. Read the concept on the front of the card.
2. Select the card to reveal its definition and example.
3. Rate it **Got it** or **Needs work**.
4. Select **Next** to continue.

You can shuffle or restart a deck. The left and right arrow keys also move between cards. At the end, the summary shows how many cards received each rating, and **Review needs-work only** starts a shorter deck containing the cards that need more practice.

The main **Review** area combines quiz mistakes and **Needs work** ratings to identify weak topics. Select a topic to study only its related cards, or select **Start review** to review everything currently recommended.

## How progress tracking works

Progress is saved automatically as you move through missions, submit quizzes, and rate flashcards. The learner header provides access to the **Progress** dashboard.

The dashboard shows:

- Overall journey completion.
- Missions that are not started, in progress, or completed.
- Quiz scores and score history.
- Topics that need more practice.
- Earned badges and the requirements for locked badges.
- Progress toward milestones.
- A recommended next mission or review activity.

The application also announces newly earned badges and level progression. When every mission is complete, the dashboard offers review mode so that you can keep practicing.

Progress is associated with the current browser and learner used by the application. It does not automatically follow you to another browser or device. Clearing application or browser data may remove access to saved progress.

## How to access content management

Open [http://localhost:6173](http://localhost:6173) while the application is running.

Content management is separate from the learner application and includes:

- **Missions:** Create and organize lessons.
- **Questions:** Create quiz questions and explanations.
- **Flashcards:** Create concepts, definitions, and examples.
- **Badges:** Define mission awards and milestones.
- **Assignment board:** Assign questions and flashcards to missions.
- **Curriculum:** Review learning tracks and reorder missions.
- **Settings:** Check content data and import or export content.

The current content management area does not have a sign-in screen. Do not expose it or its admin API publicly without adding external access protection, such as a protected reverse proxy.

## How to create or edit missions

1. Open **Missions** in content management.
2. Select an existing mission, or create a new mission.
3. Complete the editor sections:
   - **Basics:** Add the title, learning objective, difficulty, level track, order, estimated time, pass score, and any prerequisite.
   - **Lesson:** Add paragraphs, lists, callouts, or linked key terms. Use the arrow controls to reorder lesson blocks.
   - **Example:** Add a worked example or scenario.
   - **Checkpoint:** Choose a checkpoint style and provide its prompt and answer details.
   - **Practice:** Review the questions and flashcards assigned to the mission.
   - **Award:** Review any badge or milestone linked to the mission.
4. Select **Save draft**.

Use the **assignment board** to drag questions and flashcards onto a mission or move them between missions. The editor also lets you remove an assignment directly.

Select **Preview** to view the current draft in the learner interface at desktop or mobile width. The learner application must be running for preview to work. Preview activity never changes saved learner progress.

Saving a draft does not make it visible to learners. You must publish it separately.

## How to publish content

Content is never published automatically.

1. Save your draft.
2. Select **Publish** in the editor.
3. Wait for the validation report.
4. Fix every blocking issue. Review any warnings before continuing.
5. For a mission, choose whether to publish its linked draft questions, flashcards, and awards at the same time.
6. Select **I have reviewed and validated this content**.
7. Optionally add a review note for the publish history.
8. Select **Publish**.

Linked drafts that fail validation prevent the group from being published. If content changes while the publish window is open, close it, review the latest version, and publish again.

Editing already published content does not immediately change what learners see. Learners continue to receive the last published version until the updated draft passes validation and is published. Quiz attempts already in progress continue to use the content version on which they started.

Unpublishing a mission removes it and its practice content from learner access, but existing learner progress is retained.

## How AI fallback and mock mode work

Live AI is optional. Open **Settings > AI provider** in the learner application and select **Mock only** to use every learning flow without an API key, paid account, model download, or AI network request.

Mock mode provides consistent sample output for tutor questions, explanations, examples, hints, written-answer feedback, summaries, recommendations, and AI Only Mode. Each result is marked **Sample / mock AI response** and has a dashed border so that it cannot be mistaken for a live response.

The same fallback protects your learning session when a live provider fails. The application shows the problem and supplies a task-matched sample response when it encounters:

- Missing setup or rejected credentials.
- Provider usage or rate limits.
- Network, firewall, or browser connection problems.
- A request that takes longer than 30 seconds.
- An unsupported or unsafe provider response.

Authored lessons, standard quiz grading, flashcards, progress, and other non-AI features continue to work normally.

Advanced users can instead configure OpenAI, Ollama Cloud, or an OpenAI-compatible local model under **Settings > AI provider**. Provider keys are stored in the browser profile, which is not encrypted secret storage. Use a limited development key and clear it when you finish.

## Known limitations and assumptions

- Learner progress does not automatically synchronize between browsers or devices.
- Clearing browser or application data may remove locally associated sessions and settings.
- API keys saved in browser storage can be read by anyone with access to that browser profile or its developer tools.
- Live AI availability, speed, cost, and response quality depend on the selected provider.
- AI responses can be inaccurate. Treat them as learning support, not professional or expert advice.
- Mock responses are predefined examples rather than unique live AI responses.
- AI Only Mode walkthroughs and practice questions do not complete official checkpoints or quizzes.
- Later missions remain locked until their prerequisite missions are complete.
- Draft content is invisible to learners until it is explicitly published.
- The learner application must be running for content previews.
- Content management and admin API routes do not include authentication and require protection before public deployment.
- A local AI service may need extra browser-origin or CORS configuration before the learner application can connect to it.
