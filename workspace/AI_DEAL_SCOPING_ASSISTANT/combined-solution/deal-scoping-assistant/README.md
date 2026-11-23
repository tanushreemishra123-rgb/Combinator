# AI Deal Scoping Assistant

Turns customer requirements into a reviewed scope, a PRD, a cloud architecture, a data / integration / AI strategy, an explainable estimate, and an exportable scoping package.

- Every generated line points to a requirement id. Every requirement points to the customer's own words.
- All numbers come from visible rules, never from the AI.
- Runs fully **without any AI key** (mock mode with recorded answers).

## Run it

**Docker (recommended)**

```bash
docker compose up --build
```

- App: http://localhost:8080
- API docs: http://localhost:8000/docs
- Stop: `docker compose down`

**Local** (Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 22)

```bash
cd backend  && cp .env.example .env && uv sync && uv run uvicorn app.main:app --port 8000
cd frontend && cp .env.example .env && npm ci && npm run dev      # second terminal
```

- App: http://localhost:5173

**Port already in use**

If Docker or uvicorn stops with `bind: address already in use`, something else holds port 8000 (API), 8080 (Docker UI) or 5173 (local UI). Either free the port or move the app.

Find and stop what holds it:

```bash
# macOS / Linux
lsof -i :8000          # note the PID in the second column
kill <PID>

# Windows (PowerShell)
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

A leftover container from an earlier run also holds the port: `docker compose down` releases it.

Or move the app to other ports. For Docker, edit `docker-compose.yml`: change the port mapping (`"127.0.0.1:8000:8000"` to `"127.0.0.1:8001:8000"`) and, because the browser calls the API directly, change `BACKEND_URL` to `http://localhost:8001` and `CORS_ORIGINS` if you also moved 8080. Then run `docker compose up --build` again. For a local run, start uvicorn with `--port 8001`, set `VITE_API_BASE_URL=http://localhost:8001` in `frontend/.env`, and add the new UI origin to `CORS_ORIGINS` in `backend/.env` if you moved 5173.

## Try it in 2 minutes

1. Home page: open **Sample scenarios**, start **Policy Administration Platform Modernization**.
2. **Requirements**: run the analysis. Open any item to see its highlighted source quote. Answer a question, confirm an assumption, approve the scope.
3. **PRD & Scope**: generate both. Check the coverage matrix.
4. **Architecture**: pick AWS, Azure or Google Cloud, or ask for a recommendation. Generate.
5. **Data, Integration & AI**: generate all three.
6. **Estimate**: generate the drivers, calculate, open "Show calculation".
7. **Package**: change something (for example expected users 5,000 to 500,000). See affected and unaffected outputs. Regenerate. Run the quality gate. Export Markdown, Word or PDF.

Four sample scenarios ship: application modernization, integration heavy, AI enabled, and one with important information missing.

## Mock mode and live AI

| Mode | What happens |
|---|---|
| `AI_MODE=mock` (default) | Recorded answers per scenario are replayed. Same validators, same flow. All numbers and checks are computed live. Badge shows "Mock". |
| `AI_MODE=live` | Each stage calls your provider. Customer text is sent to it. Badge shows "Live". |

If live is set up wrongly, the app falls back to mock and the badge says why.

### Use a free Gemini key

1. Open https://aistudio.google.com/apikey and click **Create API key**.
2. Put it in `backend/.env`:

```
AI_MODE=live
AI_PROVIDER=google_genai
AI_MODEL=gemini-3.8-flash
GOOGLE_API_KEY=your-key
```

3. Restart the backend.

Notes:
- Any Flash model your key lists works; `gemini-3.8-flash` gave the best results in our runs.
- Free tier: about 20 requests per day per model. One full run uses about 14. Switch `AI_MODEL` to another Flash model to continue, or use mock mode.
- Other providers: `AI_PROVIDER=groq` + `GROQ_API_KEY` (needs a key with a normal token limit; a small free key is refused with a clear message), or `AI_PROVIDER=ollama` + `OLLAMA_BASE_URL`.
- `.env` is gitignored. Never commit it.

## How it works

Diagrams and component map: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Requirements in**
- Paste text or upload PDF, DOCX, TXT, MD.
- Text is split into numbered segments (`D1.S12`) with exact character positions.
- Files are read in memory and discarded. Only the text is kept.

**Scope model**
- The AI extracts 15 item types: BR, PER, FR, NFR, SYS, INT, DATA, SEC, TECH, CON, DEP, RISK, GAP, ASM, Q.
- Each item has an id, a priority, and an origin: customer stated, AI inferred, or assumed.
- Every AI-extracted item must quote the customer text. The quote is checked character by character. No match means "unverified".
- Missing information becomes a gap with a question or an assumption. Nothing is invented.
- You edit, reject, add, answer, confirm. Nothing downstream generates before you approve.

**PRD, architecture, strategies**
- Each is one AI stage reading the approved scope, not the raw document.
- Output is validated before it is saved: ids must exist, every capability needs a requirement, every component needs a justification, every cloud service must be in the platform's catalog (`backend/seeds/catalogs`).
- Bad output goes back to the model for repair, at most twice, then fails with a clear message.
- Data, integration and AI strategies refer to components by id, so a cloud switch re-links them instead of rewriting them.
- AI use cases are labeled AI, deterministic rule, or human decision, and must state evaluation, privacy, safety and human review.

**Estimate** (rules in [docs/ESTIMATION.md](docs/ESTIMATION.md))
- The AI suggests workstreams and unit complexity only.
- Python computes effort, timeline and ROM from rule tables, the rate card and your inputs.
- Contingency applied once. Missing inputs lower confidence or block a line. Every number has a trace.

**Change impact**
- After approval every edit is a recorded change.

| Change | Regenerated | Recalculated | Untouched |
|---|---|---|---|
| Requirement edited, re-prioritised, added, removed | documents that cite it | estimate | everything else |
| Cloud platform | architecture | estimate | strategies are re-linked, not rewritten |
| Expected users, security level, regulation | affected requirements and components | estimate | the rest |
| Rate card, contingency, deadline, unit complexity | nothing | estimate and ROM | all documents |

**Quality gate** (checks in [docs/QUALITY_GATE.md](docs/QUALITY_GATE.md))
- 16 deterministic checks before export: coverage, unsupported additions, unjustified components, cross-document consistency, open questions, estimate gaps, stale outputs.
- Result: Ready, Review required, or Blocked.

**Export**
- One document model, rendered to Markdown, DOCX and PDF.
- Diagrams are rendered in the browser and embedded as images.
- The mandatory planning disclaimer is at the top and the bottom of every export.

## Customer data

- Stored in a local SQLite file only (`backend/data/`, gitignored). Deleting a session deletes its data.
- Uploaded files are not stored, only their extracted text.
- Mock mode: nothing leaves your machine. Live mode: text goes to the provider you chose. Free tiers may use it for training, so use fictional data there.
- API keys live in `backend/.env` only. Never logged, never sent to the browser.

## Tests and checks

```bash
cd backend  && uv run ruff check . && uv run mypy app && uv run pytest
cd frontend && npm run lint && npm run typecheck && npm run test
```

Helper scripts in `backend/scripts`, run from `backend/`:

```bash
uv run python scripts/validate_seeds.py        # check every seed file for shape and cross-references
uv run python -m scripts.export_schemas        # rewrite seeds/schemas from the domain models
uv run python -m scripts.export_openapi        # rewrite openapi.json; then `npm run gen:api` in frontend
uv run python scripts/record_mock_responses.py <scenario> --platforms aws,azure,gcp   # record mock answers live
```

Security: OpenGrep (SAST) and Trivy (dependencies, secrets, Docker, licences) run before submission. Last run: 0 errors, 0 warnings, 0 vulnerabilities, 0 secrets, 0 misconfigurations, 0 restrictive licences.

## Limits and assumptions

- Single user, no login. Local planning tool.
- Input up to 60,000 characters per session.
- One AI call per stage; very small token limits cannot run a stage.
- Mock answers exist only for the four sample scenarios. Pasting your own text in mock mode is refused with a clear message; add a Gemini key to analyze it.
- Estimates are rough order of magnitude for planning, not a quote.
- Rates, rule tables and historical projects are sample data. Historical projects are reference only, never used in the calculation.

## Demo video

Link: https://youtu.be/-oyCpQ7oUsU

## Repository map

```
backend/app    API, ingestion, AI stages, estimation, traceability, change impact, quality, export
backend/seeds  scenarios, recorded answers, cloud catalogs, rate cards, rule tables, JSON schemas
backend/tests  unit and API tests
backend/scripts  seed validation, schema and OpenAPI export, mock recording
frontend/src   six workspaces built from shadcn/ui components
docs           architecture, estimation rules, quality gate checks
```
