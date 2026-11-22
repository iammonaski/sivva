# Sivva Phase 1 — Implementation Plan (Finalized)

> **Scope:** Phase 1 (Upload & Understand) as defined in [SPEC.md](file:///home/monaski/workspace/sivva/SPEC.md) and [AGENTS.md](file:///home/monaski/workspace/sivva/AGENTS.md).
> **Goal:** Allow a student to upload course materials (PDF/DOCX), automatically generate a structured study breakdown (topics, overview, key concepts, glossary), navigate the content, and ask questions grounded in the material with source citations.
> **Progress (2026-11-22):** Stages 1–5 are merged into `main`. Next: Stage 6 — grounded Q&A, retrieval, and streaming. Basic analysis results are live in the workspace; richer tabs remain Stage 7. Live cloud/AI verification and full Phase 1 acceptance testing remain outstanding.

---

## Locked-In Architectural Decisions

1. **Local Database**: Docker Compose running `postgres:16-alpine` on port 5432 with healthchecks and a persistent volume.
2. **Retrieval Strategy**: Standard PostgreSQL full-text search (`tsvector` / trigram) preserving page and section citations — keeping the setup lean with zero extra vector dependencies.
3. **Extraction & Processing Strategy**:
   - Direct server-side parsing (`unpdf` for PDF, `mammoth` for DOCX).
   - **Fast upload response with in-process background processing**: The upload route handler uploads the file to Cloudinary, creates the database record with `status: "processing"`, and returns HTTP 202 before extraction and analysis. Cloudinary/network latency is still on the response path; <2 seconds is a goal, not a guarantee.
   - In-process background task (using Next.js `after()` or async feature service) performs extraction, chunking, and Gemini analysis without requiring Redis or BullMQ.
   - The UI redirects immediately to `/library/[materialId]` and renders skeleton loaders while polling `material.getStatus` until `ready`.
4. **Icons**: Phosphor Icons (`@phosphor-icons/react`).
5. **Authentication**: Better Auth with Email/Password + Google OAuth Sign In, backed by PostgreSQL / Drizzle ORM.
6. **UI & Loading States**: Tailwind CSS v4 + shadcn/ui adhering to design tokens. **Skeleton loaders** everywhere data is loaded — no plain "Loading..." text.
7. **No Mocks Policy**: Live API integration only; any temporary mocks or test fixtures are confined strictly to a single dedicated top-level directory (`/mocks`).

---

## Architecture Flow

```mermaid
flowchart TD
    subgraph Client ["Client (App Router + React Query + Phosphor Icons + shadcn/ui)"]
        UI_Dash["Dashboard / Library (Skeleton Loaders)"]
        UI_Study["Study Workspace (/library/[materialId])"]
        UI_Tabs["Tabs: Overview · Topics · Study Guide · Ask"]
    end

    subgraph Transport ["Transport Layer"]
        TRPC["tRPC Routers (material, analysis, tutor, dashboard)"]
        UploadRoute["Route Handler: /api/materials/upload"]
        StreamRoute["Route Handler: /api/materials/[id]/tutor/stream"]
        AuthRoute["Route Handler: /api/auth/[...all]"]
    end

    subgraph Services ["Feature Services (src/features/*)"]
        MatSvc["material.service.ts"]
        DocSvc["document.service.ts & chunking.service.ts"]
        AnalysisSvc["analysis.service.ts"]
        TutorSvc["tutor.service.ts & retrieval.service.ts"]
    end

    subgraph Infra ["Data & Integrations (src/lib/*)"]
        Postgres["PostgreSQL (Docker local: postgres:16-alpine) + Drizzle"]
        BetterAuth["Better Auth (Email + Google OAuth)"]
        Cloudinary["Cloudinary (Private Storage)"]
        Gemini["Gemini API (Server-side, Zod Schemas)"]
    end

    UI_Dash --> TRPC
    UI_Study --> TRPC
    UI_Study --> StreamRoute
    UI_Dash --> UploadRoute

    TRPC --> MatSvc
    TRPC --> AnalysisSvc
    TRPC --> TutorSvc

    UploadRoute --> MatSvc
    StreamRoute --> TutorSvc
    AuthRoute --> BetterAuth

    MatSvc --> Cloudinary
    MatSvc --> DocSvc
    DocSvc --> Postgres
    DocSvc --> AnalysisSvc
    AnalysisSvc --> Gemini
    AnalysisSvc --> Postgres
    TutorSvc --> Gemini
    TutorSvc --> Postgres
```

---

## Staged Implementation Plan

### Stage 1: Foundation, Local Docker Postgres & Design System Setup
- [x] **Docker Setup**: Create `docker-compose.yml` with `postgres:16-alpine` (port 5432, healthcheck, persistent volume `pgdata`).
- [x] **Project Realignment**: Move `app/` into `src/app/` to match `AGENTS.md` spec and update `tsconfig.json` path mappings (`@/*` -> `./src/*`).
- [x] **Dependency Installation (`bun`)**:
  - Icons: `@phosphor-icons/react`
  - UI Utilities: `clsx`, `tailwind-merge`, `class-variance-authority`
  - Validation: `zod`
  - Database & Auth: `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `better-auth`
  - API & State: `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `superjson`
- [x] **Environment Validation (`src/lib/env.ts`)**:
  - Strict Zod schema for `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- [x] **Design System & Tokens**:
  - Tailwind CSS v4 variables from `design/sivva-design-system.png`:
    - Primary Forest Green (`#0F5132`), Secondary Sage Green (`#A7C957`), Mint Accent (`#E8F5E9`), Background (`#FAFAF8`), Surface (`#FFFFFF`), Muted (`#F3F4F6`), Border (`#E5E7EB`), Foreground (`#111827`).
  - Font Plus Jakarta Sans and token scales.
  - Base UI components: Button, Input, Skeleton.

---

### Stage 2: Database Schema & Authentication (Email + Google)
- [x] **Drizzle Schema (`src/lib/db/schema/`)**:
  - `auth.ts`: Better Auth tables (user, session, account, verification) with Google provider support.
  - `materials.ts`: Material metadata, file type (`pdf`, `docx`), Cloudinary ID/URL, status (`pending`, `processing`, `ready`, `error`).
  - `documents.ts`: Raw extracted text, page count, material ID.
  - `chunks.ts`: Chunk text, page number, section heading, document ID, full-text tsvector index.
  - `topics.ts`: Title, summary, order, material ID.
  - `study-guides.ts`: Overview markdown, key concepts (`[{term, definition}]`), key terms glossary (`string[]`).
  - `conversations.ts`: Material ID, User ID, messages (`[{role, content, citations}]`).
- [x] **Database Connection & Migrations**:
  - Setup Drizzle client connecting to local Docker PostgreSQL.
  - Initial schema migration generated in `drizzle/0000_bright_loki.sql`.
- [x] **Better Auth Setup (`src/lib/auth/auth.ts`, `auth-client.ts`)**:
  - Server configuration with email/password and Google OAuth via Drizzle adapter.
  - Route handler `src/app/api/auth/[...all]/route.ts`.
  - Auth UI: `/login` and `/register` with Phosphor icons and design tokens.

---

### Stage 3: tRPC Transport & App Shell
- [x] **tRPC Infrastructure (`src/server/trpc/`)**:
  - `context.ts`: Session resolution from Better Auth.
  - `init.ts`: Base procedure and error formatting.
  - `middleware.ts`: Authenticated guard (`protectedProcedure`).
  - `routers/_app.ts`: Root app router.
  - `create-caller.ts`: Server caller for Server Components.
- [x] **Client Integration**:
  - Provider in `src/lib/trpc/Provider.tsx` combining TanStack React Query and tRPC client.
  - Route handler `src/app/api/trpc/[trpc]/route.ts`.
- [x] **App Shell & Feature Pages**:
  - Authenticated layout with responsive sidebar in `src/components/layout/sidebar.tsx`.
  - Dashboard (`/dashboard`), Library (`/library`), and Settings (`/settings`) pages with skeleton loaders for all async states.

---

### Stage 4: Document Ingestion, Parsing & Chunking
- [x] **Storage Adapter (`src/lib/storage/cloudinary.ts`)**:
  - Authenticated raw Cloudinary upload, short-lived signed resource access, and original deletion.
- [x] **Extractors (`src/features/documents/extractors/`)**:
  - `pdf-extractor.ts`: Direct server-side parsing by actual page, including blank-page numbering.
  - `docx-extractor.ts`: Server-side extraction with mammoth preserving headings; no fabricated page citations.
- [x] **Chunking Service (`src/features/documents/services/chunking-service.ts`)**:
  - Approximate 750-token chunks with 100-token overlap and page/section metadata; never cross citation boundaries.
- [x] **Material Service (`src/features/materials/services/material.service.ts`)**:
  - Material creation, listing, signed file access, status, and storage-aware deletion with server-side ownership checks.
- [x] **Upload Route Handler (`src/app/api/materials/upload/route.ts`)**:
  - Bounded multipart parsing and file validation (PDF/DOCX, 4 MiB); upload privately, save metadata, return HTTP 202, then extract/chunk atomically using Next.js `after()`.
- [x] **Usable ingestion UI and verification**:
  - Wired library upload buttons and basic `/library/[materialId]` status page with skeletons, original download, deletion, and polling.
  - 76 unit tests and 14 isolated PostgreSQL/HTTP integration tests pass; strict TypeScript and production build pass. Test fixtures and integration doubles are confined to `/mocks`.
  - Cloudinary options/signing/error handling are tested with SDK doubles; a live cloud upload/download round trip remains unverified.

**Stage boundary:** the extraction service ends at `extracted`; the merged Stage 5 pipeline then claims `analyzing` and advances to `ready` after validated analysis is saved. No AI output is fabricated. In-process work is not durable across interruption: delete/re-upload stalled documents. Cloudinary upload latency is still on the response path; <2 seconds is not guaranteed.

---

### Stage 5: AI Analysis Pipeline (Gemini + Zod)
- [x] **Gemini Client (`src/lib/ai/gemini.ts`)**:
  - Server-only `generateContent` REST client, explicit configurable model, timeout and bounded input/output. No new SDK dependency.
- [x] **Structured Schemas & Prompts (`src/lib/ai/schemas/`, `prompts/`)**:
  - Strict Zod schemas for source-ordered topics and study guides (overview, key concepts/definitions, glossary key terms).
  - Source-only prompt treats uploaded content as data; no fabricated analysis fallback.
- [x] **Analysis Service (`src/features/analysis/services/analysis-service.ts`)**:
  - Atomic `extracted → analyzing` claim prevents duplicate inference. Validate output before atomically saving topics/guide and `ready`.
  - Failures retain extraction with safe errors; deletion during inference discards results. No locks across Gemini calls.
  - Upload schedules `process-material.ts` after the response: extraction followed by analysis.
- [x] **tRPC Routers**:
  - Ownership-protected `analysis.getOverview`, `analysis.getTopics`, `analysis.getStudyGuide`; existing `material.getStatus` reports each stage.
- [x] **Usable results and focused verification**:
  - Workspace/library poll through `extracted` and `analyzing` with skeletons; basic overview/topics/guide sections show live results at `ready`. Richer tabs remain Stage 7.
  - Dashboard topic totals are owner-scoped now that analysis populates them.
  - 105 unit tests and 32 isolated PostgreSQL/HTTP/tRPC integration tests pass; strict TypeScript passes. Gemini and cloud tests use doubles in `/mocks`; live credentialed Gemini quality remains unverified.

**Limits:** 200,000 source characters, 120-second Gemini timeout, 16,384 output tokens, 1 MB response cap. No truncation, automatic retries, or durable workers. Delete/re-upload stalled documents and earlier extraction-only uploads. Glossary remains the existing `keyTerms: string[]` contract, with definitions in key concepts.

---

### Stage 6: Grounded Q&A / Tutor Engine & Streaming
- [ ] **Retrieval Service (`src/features/tutor/services/retrieval.service.ts`)**:
  - PostgreSQL full-text search against `chunks` table returning matches with page/section numbers.
- [ ] **Tutor Service (`src/features/tutor/services/tutor.service.ts`)**:
  - Strict grounded prompt referencing retrieved chunks and requiring page citations.
- [ ] **Streaming Route Handler (`src/app/api/materials/[materialId]/tutor/route.ts`)**:
  - Stream AI response via `ReadableStream` with citations.
  - Record exchange in `conversations` table.

---

### Stage 7: Frontend UI & Study Workspace (Skeletons & Phosphor Icons)
- [ ] **Shared UI Components (`src/components/ui/`)**:
  - shadcn/ui components with design system styling.
  - Skeleton loaders for every view and list.
- [ ] **App Navigation**:
  - Sidebar with Phosphor Icons for Dashboard, Library, Settings.
- [ ] **Dashboard (`/dashboard`)**:
  - Recent materials with skeleton loaders during fetch, quick upload dropzone.
- [ ] **Library (`/library`)**:
  - Grid/list with status badges and actions.
- [ ] **Study Workspace (`/library/[materialId]`)**:
  - **Overview Tab**: Document overview & metadata.
  - **Topics Tab**: Structured topic outline with summaries.
  - **Study Guide Tab**: Key concepts & glossary cards.
  - **Ask Tab**: Grounded chat with streaming output and citation chips.

---

### Stage 8: Verification & Automated Tests

**Existing coverage:** Stages 4–5 already include chunking/extraction, upload validation, Zod output validation, and persistence/failure/ownership tests. The verified baseline is 105 unit tests and 32 isolated integration tests. Complete tutor coverage and live end-to-end acceptance checks after Stage 6; automated provider doubles do not verify live Gemini quality.

- [ ] **Complete Phase 1 Service Tests (`vitest`)**:
  - Extend existing tests to cover retrieval, grounded tutor responses, streaming, and conversation persistence.
- [ ] **Full Flow Verification**:
  - Upload sample PDF / DOCX notes and test the complete upload → analysis → grounded Q&A pipeline end-to-end with configured providers.
