# Sivva

> **Learn smarter. Study better.**  
> A focused AI study companion designed to turn lecture notes and course documents into structured, actionable study workspaces.

---

## Overview

**Sivva** is a personal, focused study application built for students and coursemates. Instead of acting as an overwhelming platform or generic chatbot, Sivva takes your course materials (lecture slides, notes, PDFs, and DOCX documents), securely extracts their content, and generates a structured study workspace:

- **Executive overview & summaries**: Quick high-level breakdown of the entire document.
- **Ordered topic outline**: Step-by-step topic breakdown with focused summaries.
- **Key concepts & glossary**: Structured definitions and essential terminology.
- **Grounded AI tutor**: Interactive Q&A strictly grounded in the uploaded material, citing genuine source pages and headings.

---

## Tech Stack

| Layer | Technology | Purpose / Notes |
|---|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) + TypeScript | Full-stack architecture; Server Components by default |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) | Custom design tokens; skeleton loaders for all loading states |
| **Icons** | [Phosphor Icons](https://phosphoricons.com/) (`@phosphor-icons/react`) | Clean, consistent icon set |
| **API & Transport** | [tRPC v11](https://trpc.io/) + [TanStack React Query](https://tanstack.com/query) | End-to-end type safety for queries and mutations |
| **Authentication** | [Better Auth](https://www.better-auth.com/) | Email/password and Google OAuth; PostgreSQL/Drizzle integration |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/) (Docker / Neon) + [Drizzle ORM](https://orm.drizzle.team/) | Relational schema, migrations in `drizzle/`, type-safe queries |
| **File Storage** | [Cloudinary](https://cloudinary.com/) (Authenticated / Private) | Secure, private storage under `sivva/materials/` with expiring signed URLs |
| **AI Analysis** | [Google Gemini API](https://ai.google.dev/) (via REST) | Server-side structured generation validated with Zod schemas |
| **Document Parsing** | `unpdf` (PDF) + `mammoth` (DOCX) | Server-side text and heading extraction with boundary tracking |
| **Validation** | [Zod](https://zod.dev/) | Strict validation at all boundaries (tRPC inputs, AI outputs, env vars) |
| **Testing** | [Vitest](https://vitest.dev/) | Isolated unit tests and PostgreSQL integration test suite |
| **Package Manager** | [Bun](https://bun.sh/) | Fast package management and runtime scripts |

---

## Architecture & Design Principles

### Golden Rule: Thin Transport, Rich Feature Services
- **Routers and Route Handlers are thin**: They authenticate requests, validate inputs, and delegate directly to feature services.
- **Feature services own business logic**: Services in `src/features/*/services/` encapsulate core domain logic and are free from tRPC or React dependencies.

```
Client (App Router + React Query + Phosphor Icons)
  │
  ├──► tRPC Router (`src/server/trpc/routers/`) ──┐
  │                                               ▼
  └──► Route Handlers (`src/app/api/`) ───► Feature Services (`src/features/*/services/`)
                                                  │
                                                  ├──► PostgreSQL (via Drizzle ORM)
                                                  ├──► Cloudinary (Private Asset Storage)
                                                  └──► Gemini API (Structured Prompts)
```

### Document Ingestion & Analysis Pipeline
1. **Upload & Storage**: Files are validated (PDF signature / DOCX structure, max 4 MiB) and uploaded to Cloudinary as private, authenticated assets.
2. **Immediate Feedback**: The upload endpoint returns an HTTP 202 response with a material record in `processing` status.
3. **Background Processing**: Next.js `after()` triggers text extraction, chunking (preserving genuine page numbers and headings without fabricating page counts), and structured Gemini analysis.
4. **Structured Gemini Inference**: Gemini generates overviews, ordered topics, key concepts, and glossary terms strictly validated against Zod schemas. Topics and study guides persist atomically as the status transitions to `ready`.
5. **Private Access**: Uploaded originals are never public; files are accessed strictly via authenticated, short-lived signed URLs.

### Design System
- **Palette**: Nature-inspired academic tones — Forest Green (`#0F5132`), Sage Green (`#A7C957`), Mint (`#E8F5E9`), Neutral Surface (`#FFFFFF`), and Soft Background (`#FAFAF8`).
- **Typography**: Plus Jakarta Sans.
- **UX Consistency**: Skeleton loaders are used everywhere data is fetching — no bare "Loading..." text strings or disruptive spinners.

---

## Project Structure

```
src/
├── app/                          # Next.js App Router (pages and layouts)
│   ├── (auth)/                   # Login and register pages
│   ├── (app)/                    # Protected workspace routes
│   │   ├── dashboard/            # Dashboard and statistics
│   │   ├── library/              # Document library & upload dialog
│   │   │   └── [materialId]/     # Study workspace (Overview, Topics, Study Guide, Tutor)
│   │   └── settings/             # User settings
│   └── api/                      # Route Handlers
│       ├── auth/[...all]/        # Better Auth endpoint
│       ├── trpc/[trpc]/          # tRPC HTTP handler
│       └── materials/            # File upload & authenticated download
│
├── features/                     # Feature modules (domain business logic)
│   ├── materials/                # Uploads, metadata, ownership, storage integration
│   ├── documents/                # PDF/DOCX extractors, section chunking
│   ├── analysis/                 # Document summaries, topics, concept extraction
│   ├── tutor/                    # Grounded Q&A, retrieval, source citations
│   └── dashboard/                # Dashboard queries and aggregations
│
├── server/                       # API composition layer
│   └── trpc/                     # Routers, procedures, auth middleware, and context
│
├── components/                   # UI components (shadcn/ui + shared layout)
│   ├── ui/                       # Kebab-case UI elements (button, input, skeleton, etc.)
│   └── layout/                   # Sidebar, app header, navigation
│
└── lib/                          # Infrastructure and shared libraries
    ├── auth/                     # Better Auth server and client configurations
    ├── db/                       # Drizzle database client and schema definitions
    ├── ai/                       # Gemini REST client, prompts, and Zod schemas
    ├── storage/                  # Cloudinary integration adapter
    └── env.ts                    # Strict Zod environment variable validation
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.1+)
- [Docker](https://www.docker.com/) & Docker Compose (for local PostgreSQL)

### 1. Clone & Install Dependencies

```bash
git clone git@github.com:iammonaski/sivva.git
cd sivva
bun install
```

### 2. Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

Update `.env` with your credentials:

```ini
# Environment
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL=postgresql://sivva:sivva_dev_password@localhost:5432/sivva

# Better Auth
BETTER_AUTH_SECRET=dev_secret_sivva_study_companion_32chars_min
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth (Optional for local development)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Gemini AI API
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite

# Cloudinary (Private document storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Start Local Database

Spin up the local PostgreSQL container:

```bash
docker compose up -d
```

Apply database migrations:

```bash
bunx drizzle-kit push
```

### 4. Run the Development Server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command | Description |
|---|---|
| `bun dev` | Starts the Next.js development server |
| `bun run build` | Builds the application for production |
| `bun start` | Starts the production server |
| `bun run lint` | Runs ESLint checks |
| `bun run test` | Runs the Vitest unit test suite |
| `bun run test:integration` | Runs PostgreSQL integration tests (requires local Docker container) |

---

## Roadmap

- [x] **Phase 1: Upload & Understand**
  - [x] Next.js foundation, design system, and responsive shell
  - [x] PostgreSQL, Drizzle schema, migrations, and Better Auth
  - [x] Private Cloudinary upload pipeline with server-side validation
  - [x] Text and heading extraction for PDF and DOCX
  - [x] Structured Gemini analysis (overviews, topics, glossary, key concepts)
  - [ ] Grounded Q&A tutor with streaming and source citations
  - [ ] Full tabbed study workspace
- [ ] **Phase 2: Related Resources**
  - [ ] Curated external learning resources (YouTube lessons, articles, documentation)
  - [ ] Academic paper discovery via scholarly metadata
  - [ ] Contextual relevance explanations
- [ ] **Phase 3: Practice & Revision**
  - [ ] Topic-based quiz generation
  - [ ] Concept flashcards with spaced repetition
- [ ] **Phase 4: Guided Learning**
  - [ ] Prerequisite concept mapping and adaptive study schedules

---

## License

This project is licensed under the [MIT License](LICENSE).
