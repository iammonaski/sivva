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

Configure the Cloudinary variables in `.env` with real credentials. Originals use **raw, authenticated** Cloudinary storage; the database stores the public ID, not a delivery URL. `/api/materials/[materialId]/file` checks ownership and redirects to a 60-second signed download. PDFs/DOCX are never uploaded as public assets.

Upload returns HTTP 202 after storage and metadata creation. Next.js `after()` extracts and atomically persists text and overlapping chunks. Status advances `processing → extracted` (or `error`); Stage 5 will add Gemini analysis and the final `ready` state. PDF chunks preserve actual page numbers; DOCX chunks cite headings and leave page numbers null. Chunk size is approximately 750 tokens with 100-token overlap (four Unicode characters/token estimate); short pages/sections remain short so citations never cross boundaries.

This is in-process processing, not a durable queue: an interrupted server invocation can leave `processing` behind. Delete and re-upload an interrupted document. Upload latency still includes Cloudinary/network latency, so a sub-two-second response is not guaranteed. Deletion removes private storage and cascades database data; cloud deletion failures retain the record for retry.

### Focused verification

```bash
bun run test
# Requires the local Docker PostgreSQL from docker-compose.yml:
bun run test:integration
```

Integration tests create and drop a uniquely named test database; the app database is untouched. They exercise real PostgreSQL, PDF/DOCX parsing, full-text search, ownership, upload/file handlers, atomic rollback and deletion. Cloudinary and framework scheduling/session boundaries use doubles confined to `/mocks`; no live cloud uploads happen in tests. A live Cloudinary round trip needs configured credentials and is separate from these automated checks.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
