<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Sivva — Agent Guidelines

> **Sivva** is an AI Study Companion. It is a personal, focused side project — not a startup platform.
> Read `SPEC.md` for the full product specification and `design/sivva-design-system.png` for the visual language.

---

## 1. Project identity

| Field | Value |
|---|---|
| **App name** | Sivva |
| **Tagline** | Learn smarter. Study better. |
| **Purpose** | Upload lecture notes/PDFs → understand content → discover related resources → practice |
| **Audience** | The developer and fellow coursemates |
| **Deployment** | Vercel + Neon (PostgreSQL) + Cloudinary |

---

## 2. Tech stack (read before touching any file)

| Layer | Choice | Notes |
|---|---|---|
| App / frontend / server | **Next.js 16 App Router + TypeScript** | Single full-stack application. No separate Express or microservices. |
| UI & styling | **Tailwind CSS v4 + shadcn/ui + Phosphor Icons** | Use the design system tokens in `design/sivva-design-system.png` and `@phosphor-icons/react`. |
| API / client-server | **tRPC + TanStack React Query** | Typed mutations/queries. No hand-maintained API types. |
| Auth | **Better Auth (Email + Google Sign In)** | Integrated with PostgreSQL/Drizzle. |
| Database | **PostgreSQL (Docker local / Neon) + Drizzle ORM** | Migrations live in `drizzle/`. Schema in `src/lib/db/schema/`. |
| File storage | **Cloudinary** (private/access-controlled) | Store metadata + storage IDs in DB; never raw URLs in state. |
| AI | **Gemini API** | Analysis, summaries, topic extraction, grounded Q&A. Server-side only. |
| Retrieval | **PostgreSQL** (pgvector when needed) | Start simple; upgrade only if retrieval quality demands it. |
| Validation | **Zod** | Validate all tRPC inputs and structured AI outputs. |
| Testing | **Vitest + Playwright** | Unit tests for services; e2e for critical user flows. |
| Package manager | **bun** | Use `bun` for all install/run commands. |

---

## 3. Architecture rules

### Golden rule
> Routers and Route Handlers are thin. Business logic lives in **feature services** (`src/features/*/services/`). Services must never import tRPC or React.

### Request flow
```
UI → tRPC procedure (or Route Handler) → feature service → data/integration layer → response
```

### When to use tRPC vs Route Handlers
- **tRPC** — standard typed queries and mutations (materials, dashboard, topics, study-guide, conversations, settings).
- **Route Handlers** — file uploads, streaming AI responses, or anything where HTTP semantics matter. Do not force every operation through tRPC.

### Auth & ownership
- Ownership checks happen **server-side** in services/queries — never only in the UI.
- Use Better Auth session helpers inside `src/server/trpc/context.ts`.

### AI calls
- AI is called **only from server-side modules** (`src/features/*/services/` or `src/lib/ai/`).
- Use structured prompts with Zod-validated outputs.
- Ground tutor answers in retrieved document chunks and include page/section references.
- Distinguish source-grounded answers from external knowledge clearly.

### File uploads
- Upload originals to Cloudinary (private); store metadata and storage identifiers in PostgreSQL.
- Extract text server-side; preserve page/section boundaries.
- Chunk extracted content with page metadata for retrieval and citations.

---

## 4. Directory structure (Phase 1 target)

```
src/
├── app/                          # Next.js routing & page composition
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
│   │   ├── auth/[...all]/route.ts     # Better Auth handler
│   │   ├── trpc/[trpc]/route.ts       # tRPC fetch adapter
│   │   └── materials/                 # Upload / streaming endpoints
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── features/                     # Feature modules — business logic lives in services/
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
├── server/                       # Server-side API composition only
│   └── trpc/
│       ├── init.ts               # tRPC initialization / base procedure
│       ├── context.ts            # Request context and session
│       ├── middleware.ts         # Auth / authorization middleware
│       ├── routers/
│       │   ├── _app.ts           # Root router composition
│       │   ├── material.router.ts
│       │   ├── analysis.router.ts
│       │   ├── tutor.router.ts
│       │   └── dashboard.router.ts
│       └── create-caller.ts
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── layout/
│   └── shared/
│
├── lib/                          # Shared infrastructure / adapters
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
└── drizzle/                      # Migrations
```

---

## 5. Feature modules at a glance

| Module | Responsibilities |
|---|---|
| `auth` | Authentication, session helpers, user identity & access checks (Better Auth) |
| `materials` | Upload workflow, material metadata, status, ownership, listing, deletion |
| `documents` | Extraction, sections/pages, normalisation, chunking |
| `analysis` | Overview, summaries, key concepts, topics, glossary, validated AI outputs |
| `tutor` | Conversation workflow, retrieval, grounded responses, source citations |
| `dashboard` | Dashboard queries and UI composition |
| `resources` *(Phase 2)* | External resource discovery, provider adapters, relevance filtering |
| `practice` *(Phase 3)* | Quizzes, flashcards, attempts, feedback |

---

## 6. Design system (always follow)

See `design/sivva-design-system.png` for the full reference. Summary:

### Colours
| Role | Token | Value |
|---|---|---|
| Primary | Forest Green | `#0F5132` |
| Secondary | Sage Green | `#A7C957` |
| Accent | Mint | `#E8F5E9` |
| Background | — | `#FAFAF8` |
| Surface | — | `#FFFFFF` |
| Muted | — | `#F3F4F6` |
| Border | — | `#E5E7EB` |
| Foreground | — | `#111827` |
| Success | — | `#16A34A` |
| Warning | — | `#F59E0B` |
| Destructive | — | `#EF4444` |

### Typography — Plus Jakarta Sans
| Scale | Size / Line height | Weight |
|---|---|---|
| H1 | 32px / 40px | Semibold |
| H2 | 24px / 32px | Semibold |
| H3 | 20px / 28px | Medium |
| H4 | 18px / 26px | Medium |
| Body | 16px / 24px | Regular |
| Small | 14px / 20px | Regular |
| Caption | 12px / 16px | Regular |

### Spacing scale
`1 · 2 · 4 · 6 · 8 · 12 · 16` (px)

### Border radius
| Name | Value |
|---|---|
| SM | 4px |
| MD | 8px |
| LG | 12px |
| XL | 16px |

### Design principles
- **Focused** — Minimise distractions.
- **Calm** — Serene, academic feel.
- **Clear** — Make information easy to find and use.
- **Helpful** — Guide, support, and empower.

### Core components
- **Buttons**: Primary (Forest Green), Outline, Ghost, Icon
- **Inputs**: Search, text inputs with inline validation messages
- **Badges**: Study, AI, PDF, Online (and similar topic/type labels)
- **Cards**: Material cards (title, type, size, CTA)
- **Tabs**: Overview · Topics · Study Guide
- **Status banners**: Success (green), Warning (amber), Error (red)

### Navigation (sidebar)
Dashboard · Library · Study Workspace · Analytics · Settings

---

## 7. What NOT to build

- Microservices or multiple deployable backends.
- Redis, BullMQ, or worker infrastructure before there is a demonstrated need.
- Dedicated vector database if PostgreSQL can handle initial retrieval.
- Complex agent systems or multi-agent workflows.
- Advanced personalisation, mastery scoring, or analytics dashboards.
- Social features, collaboration, institutional integrations, or payment systems.
- Support for every file type on the first release.
- An abstraction-heavy repository or empty modules for future phases.

---

## 8. Code conventions

- **Development philosophy**:
  - Prefer the smallest change that completely solves the problem. Don't add abstractions, config or extension points for hypothetical needs, and generalize only after repeated concrete requirements justify it.
  - Before adding a dependency or utility, check whether the project already has one.
  - Prefer a single object argument over three or more positional arguments, so same-typed values can't get swapped.
  - Framework best practices are defaults, and they don't justify extra complexity unless they improve correctness, maintainability or consistency.
  - Use your questions tool for every question, in every harness.
  - When you integrate an API into a frontend, show a skeleton while data loads and not a "Loading..." string. This would be an absolute rule if not for a few rare cases where plain text really is the right answer, so wherever a skeleton can fit, use one.
  - Mocks are enemies of the codebase. Once I give you an endpoint to replace a mocked one, remove every mock for that endpoint, everywhere it appears, because API integration means all data is live. If a codebase truly does need mocks or fallbacks, keep all of them in one dedicated top-level folder and never scatter pieces through components and files, so I can find, change and clean them up in one place.
  - kebab-case for general files, PascalCase ONLY component files.
  - Do not randomly run lint, typecheck or build. Run only when VERY necessary.
- **TypeScript strict mode** — no `any` without a comment explaining why.
- **Zod everywhere** — validate at the boundary (tRPC input, AI output, env vars).
- **Environment variables** — declare and validate in `src/lib/env.ts`; never read `process.env` directly elsewhere.
- **Server Components by default** — add `"use client"` only where interactivity requires it.
- **Error handling** — services throw typed errors; tRPC procedures catch and map them to `TRPCError`.
- **Streaming** — use Route Handlers + `ReadableStream` for streaming AI responses; do not block tRPC procedures.
- **No barrel re-exports** unless the module is a true public API boundary.


---

## 9. Definition of done (Phase 1)

> A coursemate can upload a lecture document, understand its main topics and concepts from the generated study guide, navigate to the relevant section, and ask follow-up questions with answers grounded in the document. It feels **reliable and simple** — not feature-heavy.
