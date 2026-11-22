This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Document ingestion (Stage 4)

Sign in, open `/library`, and choose **Upload Document**. Supported files are PDF and DOCX, up to **4 MiB** (below Vercel's request limit, with space for multipart headers). The server validates the extension, MIME type, and PDF signature or DOCX ZIP structure. DOCX archives are limited to 32 MiB expanded / 2,000 entries; PDFs to 300 pages. Scanned/image-only documents require OCR and return a readable processing error.

Configure the Cloudinary variables in `.env` with real credentials. Originals use **raw, authenticated** Cloudinary storage; the database stores the public ID, not a delivery URL. New uploads are organized in the **`sivva/materials`** Media Library folder using Cloudinary's dynamic folder mode, independently of their storage IDs. No folder environment variable or upload preset is needed; existing uploads are not moved. `/api/materials/[materialId]/file` checks ownership and redirects to a 60-second signed download. PDFs/DOCX are never uploaded as public assets.

Upload returns HTTP 202 after storage and metadata creation. Next.js `after()` runs a feature-service pipeline that extracts and atomically persists text/chunks, then generates and saves AI analysis. Status advances `processing → extracted → analyzing → ready` (or `error`). PDF chunks preserve actual page numbers; DOCX chunks cite headings and leave page numbers null. Chunk size is approximately 750 tokens with 100-token overlap (four Unicode characters/token estimate); short pages/sections remain short so citations never cross boundaries.

This is in-process processing, not a durable queue: an interrupted server invocation can leave `processing`, `extracted`, or `analyzing` behind. Delete and re-upload an interrupted document. Documents uploaded before Stage 5 that are already `extracted` also need re-uploading to run the complete pipeline. Upload latency still includes Cloudinary/network latency, so a sub-two-second response is not guaranteed. Deletion removes private storage and cascades database data; cloud deletion failures retain the record for retry.

## AI analysis (Stage 5)

Set `GEMINI_API_KEY` to a real server-side API key. The optional, validated `GEMINI_MODEL` defaults to the explicit stable ID **`gemini-3.5-flash-lite`**; choose another available Gemini model if your account requires it. No Gemini SDK is needed: the server uses `generateContent` REST with a JSON schema generated from Zod. Only extracted source text is sent to Gemini—no user IDs, original filenames, storage identifiers, or download URLs.

The source-grounded prompt generates an overview, ordered topics, key concepts/definitions, and glossary key terms. All responses must finish successfully, parse as JSON, and pass strict Zod validation before persistence. Topics and the study guide are saved together with `ready` in one transaction. An atomic `analyzing` claim avoids duplicate Gemini calls; deletion during analysis discards the result. Failures show a safe error and preserve extracted text/chunks; recovery is delete/re-upload, not an automatic retry.

Analysis accepts at most **200,000 extracted characters**, without truncating, and allows **120 seconds** per Gemini request within the upload route's 300-second execution budget. Output is capped at 16,384 tokens / 1 MB, with schema limits on text and list lengths. Oversized documents must be split. The original remains privately downloadable even if analysis fails.

Ownership-protected tRPC queries (input `{ id: materialId }`):
- `analysis.getOverview`: `{ overview }` or `null` while not ready.
- `analysis.getTopics`: ordered topics, or `[]` while not ready.
- `analysis.getStudyGuide`: `{ overview, keyConcepts, keyTerms }` or `null` while not ready.
- `material.getStatus`: status and safe processing error.

Missing/foreign materials return `NOT_FOUND`; unauthenticated callers return `UNAUTHORIZED`. The workspace polls all processing stages with skeletons and displays live results at `ready`. These basic sections precede the richer tabbed workspace planned for Stage 7. AI-generated content renders as text (no raw HTML) and should be checked against the original.

### Focused verification

```bash
bun run test
# Requires the local Docker PostgreSQL from docker-compose.yml:
bun run test:integration
```

Integration tests create and drop a uniquely named test database; the app database is untouched. They exercise real PostgreSQL, PDF/DOCX parsing, full-text search, ownership, upload/file handlers, atomic rollback and deletion, plus analysis persistence, duplicate-call protection, deletion during inference, failure states, and authenticated tRPC callers. Cloudinary, Gemini and framework scheduling/session boundaries use doubles confined to `/mocks`; no live cloud requests happen in these tests. A live Cloudinary/Gemini round trip needs configured credentials and is separate from these automated checks.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
