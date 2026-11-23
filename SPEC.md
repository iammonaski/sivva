# Sivva — Product Specification

> **AI Study Companion** · Learn smarter. Study better.
> A personal, focused side project for a developer and their coursemates — not a startup platform.

---

## 1. Project Overview

Sivva is a study app that lets students upload lecture notes, PDFs, slides, and documents, understand the material, and discover useful learning resources connected to what they are studying — such as YouTube lessons, tutorials, articles, books, and academic references.

### Core idea
Turn course materials into a helpful study workspace: understand the uploaded content, explore its topics, find trustworthy material to learn more, and practice.

### Who it is for
Initially, the developer and fellow coursemates. Scope, cost, and maintenance must stay reasonable.

---

## 2. Product Principles

- **Keep it simple** — choose the smallest solution that handles the job well.
- **Build one complete workflow at a time** — do not implement the entire roadmap at once.
- **Use familiar tools and managed services** where they save time.
- **Be clear** about what comes from uploaded notes versus outside sources.
- **Make resource suggestions useful** and explain why they are relevant.
- **Design for desktop and mobile**, with reasonable attention to slow connections and data usage.
- **Do not build infrastructure for hypothetical scale** — revisit only when real usage requires it.
- **Keep transport/API code thin** — business logic belongs in feature services, not route handlers or routers.

---

## 3. Main User Flow

```
Upload material → Analyze it → Study it → Discover more → Ask questions → Practice
```

| Step | Description |
|---|---|
| **Upload material** | Upload a PDF, DOCX, slides, or paste text |
| **Analyze it** | Extract content, identify sections and topics, generate a structured overview |
| **Study it** | Read concise notes, explanations, definitions, and key concepts |
| **Discover more** | Browse related videos, articles, books, and references grouped by topic |
| **Ask questions** | Ask an AI tutor questions grounded in the uploaded material |
| **Practice** | Generate quizzes and flashcards to test understanding *(later phase)* |

---

## 4. Phased Development

### Phase 1 — Upload & Understand *(current milestone)*

**Goal:** Make the upload and document understanding experience work end-to-end.

- Upload PDFs and DOCX (add PPTX if straightforward).
- Basic file validation and upload progress/error feedback.
- Extract document text and retain page numbers when possible.
- Generate a document overview, section summaries, key terms, and key concepts.
- Identify topics and organize them into a simple outline.
- Display results in a clean study workspace.
- Allow users to ask questions grounded in the uploaded document, with page references when available.

**Deliverable:** A student can upload lecture material, get a useful study breakdown, navigate topics, and ask questions.

---

### Phase 2 — Related Resources *(the distinctive feature)*

**Goal:** Connect each extracted topic to learning resources outside the uploaded notes.

- Find relevant YouTube videos — display title, channel, thumbnail, and link.
- Find useful web articles/tutorials and educational references.
- Discover scholarly papers and academic metadata (OpenAlex is a candidate source).
- Explore books/open textbooks when searchable metadata and accessible links are available.
- Group results by topic instead of dumping a generic list of search results.
- Show a short reason each resource is recommended and link to the original source.
- Basic relevance filtering and deduplication; label source/type clearly.

**Deliverable:** Open a lecture topic and see relevant videos, reading, and references that help explain it.

---

### Phase 3 — Practice & Revision

**Goal:** Give students ways to actively check their understanding.

- Generate quizzes from a whole document or selected topic.
- Generate editable flashcards from key terms and concepts.
- Provide explanations for answers, including why an answer is wrong.
- Let users retry or regenerate practice content.
- Track basic completed practice and quiz scores.

**Deliverable:** Students can study, then test their understanding.

---

### Phase 4 — Guided Learning *(only if earlier phases prove useful)*

**Goal:** Help students figure out what to learn before, during, and after a lecture topic.

- Suggest prerequisite concepts for difficult topics.
- Arrange prerequisite, lecture, and advanced topics into a suggested learning order.
- Recommend what to study next based on quiz mistakes or topics viewed.
- Optional lightweight study plan for a test/exam date.

**Deliverable:** A suggested learning path that adapts modestly to the student's needs.

---

### Phase 5 — Nice-to-haves *(driven by feedback only)*

**Goal:** Add convenience features only when users actually ask for them.

- Audio explanations or generated audio summaries.
- Video transcript-based explanations where transcripts are available and permitted.
- Study progress overview and spaced-repetition reminders.
- Shared folders or small group study spaces.
- Course/semester organisation and additional file formats.

**Deliverable:** Improvements driven by actual use, not assumptions.

---

## 5. Tech Stack

| Layer | Choice | Purpose |
|---|---|---|
| App / frontend / server | Next.js App Router + TypeScript | One full-stack application: UI, server rendering, and server-side code |
| UI & styling | Tailwind CSS + shadcn/ui | Reusable, accessible components and consistent styling |
| API / client-server | tRPC + TanStack React Query | Typed queries and mutations; caching, loading, and invalidation |
| Authentication | Better Auth | Authentication, sessions, and user identity — integrated with PostgreSQL/Drizzle |
| Database | PostgreSQL + Drizzle ORM | Relational data, constraints, migrations, and typed queries |
| File storage | Cloudinary (private/access-controlled) | Store uploaded source files; database stores metadata and storage IDs |
| AI | Gemini API | Document analysis, summaries, topic extraction, and grounded Q&A |
| Retrieval | PostgreSQL; pgvector when needed | Retrieve document chunks with source/page metadata |
| Validation | Zod | Validate request inputs and structured AI outputs |
| Deployment | Vercel + Neon + Cloudinary | Managed hosting and services; avoid maintaining servers |
| Testing | Vitest + Playwright | Unit tests for core services; e2e for key flows |
| Package manager | bun | Fast installs and script execution |

---

## 6. Architecture & Separation of Concerns

Build as a **single Next.js application with modular features** — not a monorepo, microservices setup, or separate Express API.

### Layers

| Layer | Description |
|---|---|
| **UI** | App Router pages/layouts, React components, client interactions, presentation state |
| **Transport/API** | tRPC routers and procedures: define typed inputs, invoke services, return results. No business logic here. Use Route Handlers for uploads and streaming. |
| **Application/business logic** | Feature services own workflows, rules, orchestration, and use-case logic. Callable independently of the transport layer. |
| **Data access** | Drizzle queries and transactions. Schema definitions and migrations. No query logic in UI or routers. |
| **Infrastructure/integrations** | Gemini client, Cloudinary client, document extractors, other external adapters. |

### Request flow

```
UI
 └─→ tRPC procedure (or Route Handler)
       └─→ feature service
             └─→ data / integration layer
                   └─→ response
```

### tRPC conventions

- Use tRPC for ordinary typed application queries and mutations.
- Use TanStack React Query through the tRPC integration for client caching, loading/error state, and mutation invalidation.
- Keep procedures small — delegate all meaningful work to feature services.
- Use Route Handlers for file uploads, streaming AI responses, or transport-specific behaviour.
- Centralise authentication/context and authorisation helpers. Ownership checks must happen server-side in services/queries, never only in the UI.

### Document processing

1. Upload originals to private Cloudinary storage.
2. Store metadata and storage identifiers in PostgreSQL.
3. Extract text server-side; preserve page/section boundaries.
4. Chunk extracted content with source/page metadata for retrieval and citations.
5. Start with simple synchronous processing. Add a background job/queue only if latency or reliability demands it.

### AI and retrieval

- Call AI **only from server-side modules**.
- Use structured prompts and Zod-validated outputs for analysis.
- Ground tutor answers in retrieved document chunks; include page/section references.
- Clearly distinguish source-grounded answers from external knowledge.
- Acknowledge when uploaded material does not support an answer.

---

## 7. Feature Modules

| Module | Responsibilities |
|---|---|
| `auth` | Authentication, session/context helpers, user identity and access checks (Better Auth) |
| `materials` | Upload workflow, material metadata, status, ownership, listing, deletion |
| `documents` | Extraction, sections/pages, normalisation, chunking |
| `analysis` | Overview, summaries, key concepts, topics, glossary, validated AI outputs |
| `tutor` | Conversation workflow, retrieval, grounded responses, source citations |
| `dashboard` | Dashboard queries and UI composition |
| `resources` *(Phase 2)* | External resource discovery, provider adapters, relevance filtering, display |
| `practice` *(Phase 3)* | Quizzes, flashcards, attempts, feedback |
| `shared/lib` | Infrastructure clients, common schemas, types, constants, utilities |

---

## 8. Phase 1 Project Structure

> Add files as their feature is implemented. Do not create empty folders for the entire roadmap upfront.

```
src/
├── app/                              # Next.js routing and page composition
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (app)/
│   │   ├── dashboard/page.tsx
│   │   ├── library/page.tsx
│   │   ├── library/[materialId]/page.tsx
│   │   ├── settings/page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/[...all]/route.ts    # Better Auth handler
│   │   ├── trpc/[trpc]/route.ts      # tRPC fetch adapter
│   │   └── materials/                # Upload / streaming endpoints
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── features/                         # Feature code; business logic lives in services
│   ├── materials/
│   │   ├── components/
│   │   ├── services/material.service.ts
│   │   ├── schemas/
│   │   └── types.ts
│   ├── documents/
│   │   ├── extractors/pdf.extractor.ts
│   │   ├── extractors/docx.extractor.ts
│   │   ├── services/document.service.ts
│   │   ├── services/chunking.service.ts
│   │   └── types.ts
│   ├── analysis/
│   │   ├── components/
│   │   ├── services/analysis.service.ts
│   │   ├── schemas/
│   │   └── types.ts
│   ├── tutor/
│   │   ├── components/
│   │   ├── services/tutor.service.ts
│   │   ├── services/retrieval.service.ts
│   │   ├── schemas/
│   │   └── types.ts
│   └── dashboard/
│       ├── components/
│       └── queries/
│
├── server/                           # Server-side API composition only
│   └── trpc/
│       ├── init.ts                   # tRPC initialization / base procedure
│       ├── context.ts                # Request context and session
│       ├── middleware.ts             # Auth / authorization middleware
│       ├── routers/
│       │   ├── _app.ts               # Root router composition
│       │   ├── material.router.ts
│       │   ├── analysis.router.ts
│       │   ├── tutor.router.ts
│       │   └── dashboard.router.ts
│       └── create-caller.ts
│
├── components/
│   ├── ui/                           # shadcn/ui
│   ├── layout/
│   └── shared/
│
├── lib/                              # Shared infrastructure / adapters
│   ├── auth/
│   │   ├── auth.ts
│   │   └── auth-client.ts
│   ├── db/
│   │   ├── index.ts
│   │   └── schema/
│   │       ├── auth.ts
│   │       ├── materials.ts
│   │       ├── documents.ts
│   │       ├── topics.ts
│   │       ├── study-guides.ts
│   │       └── conversations.ts
│   ├── ai/
│   │   ├── gemini.ts
│   │   ├── prompts/
│   │   └── schemas/
│   ├── storage/cloudinary.ts
│   ├── utils/
│   └── env.ts
│
├── hooks/
├── types/
└── drizzle/                          # Migrations
```

---

## 9. Database Schema (Phase 1)

### `users` — managed by Better Auth
Standard Better Auth schema; do not define manually.

### `materials`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → users | Owner |
| `name` | text | Display name |
| `fileType` | text | `pdf`, `docx` |
| `storageId` | text | Cloudinary resource ID |
| `storageUrl` | text | Private Cloudinary URL |
| `status` | text | `pending`, `processing`, `extracted`, `analyzing`, `ready`, `error` |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `documents`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `materialId` | uuid FK → materials | |
| `pageCount` | integer | |
| `rawText` | text | Full extracted text |
| `createdAt` | timestamp | |

### `chunks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `documentId` | uuid FK → documents | |
| `content` | text | Chunk text |
| `page` | integer | Source page |
| `section` | text | Section heading (if available) |
| `embedding` | vector(768) | pgvector column (add in Phase 2 if needed) |

### `topics`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `materialId` | uuid FK → materials | |
| `title` | text | |
| `summary` | text | |
| `order` | integer | Display order |
| `createdAt` | timestamp | |

### `study_guides`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `materialId` | uuid FK → materials | |
| `overview` | text | |
| `keyConcepts` | jsonb | Array of `{term, definition}` |
| `keyTerms` | jsonb | Array of strings |
| `createdAt` | timestamp | |

### `conversations`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `materialId` | uuid FK → materials | |
| `userId` | uuid FK → users | |
| `messages` | jsonb | Array of `{role, content, citations}` |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

---

## 10. Navigation & Pages

| Route | Page | Auth required |
|---|---|---|
| `/` | Landing / redirect | No |
| `/login` | Login | No |
| `/register` | Register | No |
| `/dashboard` | Dashboard — recent materials, stats | Yes |
| `/library` | Library — all uploaded materials | Yes |
| `/library/[materialId]` | Study Workspace — tabs: Overview · Topics · Study Guide · Ask | Yes |
| `/settings` | Account settings | Yes |

---

## 11. Study Workspace — UI Tabs

| Tab | Content |
|---|---|
| **Overview** | Document summary, page count, file info |
| **Topics** | Outline of extracted topics with per-topic summaries |
| **Study Guide** | Key concepts, glossary/key terms, section notes |
| **Ask** | Chat with AI tutor, grounded in document, with citations |

*(Phase 2 adds a **Resources** tab per topic)*

---

## 12. What NOT to Build

- Microservices or multiple deployable backends.
- Redis, BullMQ, or worker infrastructure before there is a demonstrated need.
- Dedicated vector database if PostgreSQL can handle initial retrieval.
- Complex agent systems or multi-agent workflows.
- Advanced personalisation, mastery scoring, or analytics dashboards.
- Social features, collaboration, institutional integrations, or payment systems.
- Support for every file type on the first release.
- An abstraction-heavy repository or empty modules for future phases.

---

## 13. Phase 1 Checklist

**Status (2026-11-23):** implementation Stages 1–5 are merged. Stage 6 is implemented in the working tree: PostgreSQL retrieval, grounded streaming Q&A with validated citations, and owner-scoped conversation history. Next is Stage 7: the full tabbed workspace and Ask UI. Automated verification covers 142 unit tests and 50 PostgreSQL/HTTP/tRPC integration tests, with TypeScript passing. Live Gemini/Cloudinary verification and testing with real course notes remain outstanding.

- [x] Next.js foundation, env configuration, and basic UI shell
- [x] PostgreSQL, Drizzle, migrations, and Better Auth
- [x] tRPC context, base procedures, auth middleware, and root router
- [x] Private, user-owned materials with server-side ownership checks
- [x] Upload + private Cloudinary file-storage flow
- [x] Text extraction with page references (PDF + DOCX headings; no fabricated DOCX page numbers)
- [x] Topic/section extraction with validated structured output
- [x] Overview, summaries, glossary, and key concepts generation
- [x] Grounded Q&A backend with citations; streaming via Route Handler (Ask UI remains below)
- [ ] Study workspace + mobile-responsive layout
- [ ] Test with real course notes (varied lengths and formats)
- [ ] Deploy for personal and coursemate testing; collect feedback before Phase 2

---

## 14. Definition of Done — Phase 1

> The first release is successful if a coursemate can upload a lecture document, understand its main topics and concepts from the generated study guide, navigate to the relevant section, and ask follow-up questions with answers grounded in the document.
>
> It should feel **reliable and simple** — not feature-heavy.

---

## 15. Guiding Decision

Build the foundation for resource discovery, but implement it only after upload, extraction, topic organisation, and grounded Q&A work well. Keep code modular and infrastructure modest. Routers and route handlers remain thin; feature services own business logic. **Upgrade only when a real limitation appears.**
