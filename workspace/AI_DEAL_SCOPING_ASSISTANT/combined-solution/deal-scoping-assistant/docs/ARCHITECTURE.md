# Architecture

One browser app, one API. The AI writes text and suggestions. Plain Python does the
numbers, the checks and the change tracking. Everything is tied together by one
reviewed scope model.

```mermaid
flowchart TB
  UI["Browser application<br/>React + shadcn/ui"]

  subgraph API["FastAPI backend"]
    direction TB
    ING["Requirements ingestion<br/>PDF, DOCX, TXT, MD to segments"]
    ORC["AI orchestration<br/>LangGraph: generate, validate, repair"]
    MOCK["Mock AI provider<br/>recorded responses"]
    SCOPE[("Structured scope model<br/>FR_01, NFR_02, ASM_03 ... + sources")]

    subgraph GEN["AI generators"]
      direction LR
      PRD["PRD and scope<br/>generator"]
      ARC["Cloud architecture<br/>generator"]
      DIS["Data and integration<br/>strategy generator"]
      AIS["AI solution<br/>generator"]
    end

    subgraph DET["Deterministic services (no AI)"]
      direction LR
      EST["Estimation<br/>component"]
      TRC["Traceability<br/>component"]
      CHG["Change-impact<br/>component"]
      QG["Quality-validation<br/>component"]
    end

    EXP["Export layer<br/>Markdown, DOCX, PDF"]
  end

  LLM["Live AI provider<br/>Gemini, Groq or Ollama"]

  UI --> ING --> ORC --> SCOPE
  ORC --> LLM
  ORC --> MOCK
  SCOPE --> GEN --> DET
  SCOPE --> DET
  DET --> EXP --> UI
```

## How the parts work together

| Part | Job | Code |
|---|---|---|
| Browser application | Six workspaces, from requirements to export | `frontend/src` |
| Requirements ingestion | Turns text and files into numbered segments with exact offsets | `backend/app/ingestion` |
| AI orchestration | Runs one stage at a time: generate, validate, repair | `backend/app/ai` |
| Mock AI provider | Replays recorded answers so everything runs with no key | `backend/app/ai/mock_provider.py` |
| Structured scope model | Every requirement, assumption and question with id, origin and source quote | `backend/app/domain`, `backend/app/scope` |
| PRD and scope generator | PRD and capabilities, each tied to requirement ids | `backend/app/generation` |
| Cloud architecture generator | Components mapped to real AWS, Azure or Google Cloud services | `backend/app/generation`, `backend/seeds/catalogs` |
| Data and integration strategy generator | Data domains, integrations and flows | `backend/app/generation` |
| AI solution generator | AI use cases, frameworks, responsible-AI notes | `backend/app/generation` |
| Estimation component | Effort, timeline and ROM from visible rules | `backend/app/estimation` |
| Traceability component | Which id is used where, plus coverage | `backend/app/traceability` |
| Change-impact component | Affected and unaffected outputs after a change | `backend/app/change_impact` |
| Quality-validation component | 16 checks before export | `backend/app/quality` |
| Export layer | One document model, three file formats | `backend/app/package` |

## Request flow for one AI stage

```mermaid
flowchart LR
  A["Scope items + config"] --> B["Prompt"] --> C["Model or mock"] --> D["JSON"]
  D --> E{"Valid?<br/>ids exist, quotes match,<br/>services in catalog"}
  E -- yes --> F["Save artifact"]
  E -- "no, up to 2 repairs" --> B
  E -- "still no" --> G["Clear error in the UI"]
```

## Data storage

SQLite file under `backend/data/`. Uploaded files are not kept, only their extracted
text. Deleting a session deletes all of its data. API keys live only in `backend/.env`.
