import { storage } from "../../../../mocks/storage";
import { transport } from "../../../../mocks/transport";
import { tutorProvider, resetTutorProvider } from "../../../../mocks/gemini-tutor";
import { createTutorAnswer } from "../../../../mocks/tutor-fixtures";
import { POST as tutorPOST } from "@/app/api/materials/[materialId]/tutor/stream/route";
import { retrieveSources, MAX_CONTEXT_CHARACTERS } from "@/features/tutor/services/retrieval-service";
import { getConversation, listConversations, prepareTutorTurn } from "@/features/tutor/services/tutor-service";
import { TutorError } from "@/features/tutor/tutor-error";
import { tutorRouter } from "@/server/trpc/routers/tutor-router";
import { tutorEventSchema } from "@/features/tutor/schemas/tutor";
import { conversations } from "@/lib/db/schema/conversations";
import { gemini, resetGemini } from "../../../../mocks/gemini";
import { createAnalysis } from "../../../../mocks/analysis-fixtures";
import { createCallerContext } from "../../../../mocks/trpc-context";
import { analyzeDocument, getOverview, getStudyGuide, getTopics } from "@/features/analysis/services/analysis-service";
import { AnalysisError } from "@/features/analysis/analysis-error";
import { analysisRouter } from "@/server/trpc/routers/analysis.router";
import { appRouter } from "@/server/trpc/routers/_app";
import { mockYouTubeResponse, youtubeFetch } from "../../../../mocks/youtube";
import { mockOpenAlexResponse, openAlexFetch } from "../../../../mocks/openalex";
import { getDashboardStats } from "@/features/dashboard/services/dashboard.service";
import { POST } from "@/app/api/materials/upload/route";
import { GET } from "@/app/api/materials/[materialId]/file/route";
import { testAdminUrl, testDatabaseName } from "../../../../mocks/test-env";
import { createDocx, createPdf, createUploadFile } from "../../../../mocks/document-fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { chunks, documents, materials, studyGuides, topics, user } from "@/lib/db/schema";
import { createMaterial, deleteMaterial, getMaterialById, getMaterialDownloadUrl, getMaterialStatus, listUserMaterials } from "./material.service";
import { processDocument } from "@/features/documents/services/document-service";
import { MaterialError } from "../material-error";

const owner = "test-owner";
const other = "test-other";
const admin = new pg.Client({ connectionString: testAdminUrl });
let databaseCreated = false;

beforeAll(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${testDatabaseName}"`);
  databaseCreated = true;
  const migration = await readFile(new URL("../../../../drizzle/0000_bright_loki.sql", import.meta.url), "utf8");
  await pool.query(migration);
  await db.insert(user).values([
    { id: owner, name: "Test owner", email: "owner@example.invalid" },
    { id: other, name: "Test other", email: "other@example.invalid" },
  ]);
});

afterAll(async () => {
  await pool.end();
  if (databaseCreated) await admin.query(`DROP DATABASE "${testDatabaseName}"`);
  await admin.end();
});

beforeEach(async () => {
  vi.clearAllMocks();
  resetGemini();
  resetTutorProvider();
  await db.delete(materials);
});

async function uploadPdf(pages = ["Photosynthesis converts light into chemical energy.", "Chlorophyll absorbs light."]) {
  const file = createUploadFile({ buffer: createPdf({ pages }), name: "lecture.pdf", type: "application/pdf" });
  return createMaterial({ userId: owner, file });
}

async function processUpload(created: Awaited<ReturnType<typeof createMaterial>>, userId = owner) {
  await processDocument({ ...created, userId });
}

describe("upload and original-file HTTP handlers", () => {
  function request(origin = "http://localhost:3000") {
    const body = new FormData();
    body.append("file", createUploadFile({ buffer: createPdf({ pages: ["HTTP upload"] }), name: "http.pdf", type: "application/pdf" }));
    return new Request("http://localhost:3000/api/materials/upload", { method: "POST", body, headers: { origin } });
  }

  it("returns 202 before parsing, schedules processing, and serves private owner access", async () => {
    const response = await POST(request());
    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.status).toBe("processing");
    expect(data).not.toHaveProperty("buffer");
    expect(await db.select().from(documents)).toEqual([]);
    expect(transport.after).toHaveBeenCalledTimes(1);
    await transport.after.mock.calls[0][0]();
    expect((await getMaterialStatus({ id: data.materialId, userId: owner })).status).toBe("ready");
    expect(gemini.generateDocumentAnalysis).toHaveBeenCalledWith({ rawText: "HTTP upload" });
    expect(await db.select().from(studyGuides)).toHaveLength(1);
    const original = await GET(new Request("http://localhost:3000/file"), { params: Promise.resolve({ materialId: data.materialId }) });
    expect(original.status).toBe(302);
    expect(original.headers.get("cache-control")).toBe("private, no-store");
    expect(original.headers.get("location")).toContain("example.invalid");
  });

  it("rejects cross-origin uploads before storage", async () => {
    expect((await POST(request("https://example.invalid"))).status).toBe(403);
    expect(storage.uploadOriginal).not.toHaveBeenCalled();
    expect(transport.after).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated upload and file access", async () => {
    transport.createTRPCContext.mockResolvedValueOnce({ session: null });
    expect((await POST(request())).status).toBe(401);
    transport.createTRPCContext.mockResolvedValueOnce({ session: null });
    expect((await GET(new Request("http://localhost:3000/file"), { params: Promise.resolve({ materialId: "missing" }) })).status).toBe(401);
    expect(storage.uploadOriginal).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's original and malformed uploads return 400", async () => {
    const created = await uploadPdf();
    transport.createTRPCContext.mockResolvedValueOnce({ session: { user: { id: other } } });
    expect((await GET(new Request("http://localhost:3000/file"), { params: Promise.resolve({ materialId: created.materialId }) })).status).toBe(404);
    const invalid = new Request("http://localhost:3000/api/materials/upload", { method: "POST", body: "bad", headers: { origin: "http://localhost:3000", "content-type": "text/plain" } });
    expect((await POST(invalid)).status).toBe(400);
  });
});

describe("document ingestion with real PostgreSQL and parsers", () => {
  it("persists PDF pages, ordered searchable chunks and extracted status", async () => {
    const created = await uploadPdf();
    expect(created.status).toBe("processing");
    await processUpload(created);
    const material = await getMaterialById({ id: created.materialId, userId: owner });
    expect(material?.status).toBe("extracted");
    expect(material).not.toHaveProperty("storageUrl");
    expect(material).not.toHaveProperty("storageId");
    const [document] = await db.select().from(documents).where(eq(documents.materialId, created.materialId));
    expect(document.pageCount).toBe(2);
    expect(document.rawText).toContain("Photosynthesis");
    const rows = await db.select().from(chunks).where(eq(chunks.materialId, created.materialId)).orderBy(chunks.chunkIndex);
    expect(rows.map((chunk) => chunk.pageNumber)).toEqual([1, 2]);
    expect(rows.map((chunk) => chunk.chunkIndex)).toEqual([0, 1]);
    expect(rows.every((chunk) => chunk.documentId === document.id)).toBe(true);
    const search = await db.select().from(chunks).where(and(eq(chunks.materialId, created.materialId),
      sql`to_tsvector('english', ${chunks.content}) @@ plainto_tsquery('english', 'photosynthesis')`));
    expect(search).toHaveLength(1);
  });

  it("persists DOCX headings without fabricated page citations", async () => {
    const file = createUploadFile({ buffer: createDocx({ paragraphs: [
      { text: "Cell biology", heading: 1 }, { text: "Cells contain organelles." },
      { text: "Mitochondria", heading: 2 }, { text: "Mitochondria produce ATP." },
    ] }), name: "biology.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const created = await createMaterial({ userId: owner, file });
    await processUpload(created);
    const rows = await db.select().from(chunks).where(eq(chunks.materialId, created.materialId)).orderBy(chunks.chunkIndex);
    expect(rows.map((row) => row.sectionHeading)).toEqual(["Cell biology", "Mitochondria"]);
    expect(rows.every((row) => row.pageNumber === null)).toBe(true);
  });

  it("rejects cross-user reads, status, download, delete and processing", async () => {
    const created = await uploadPdf();
    const input = { id: created.materialId, userId: other };
    expect(await getMaterialById(input)).toBeNull();
    expect(await listUserMaterials({ userId: other })).toEqual([]);
    await expect(getMaterialStatus(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getMaterialDownloadUrl(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await deleteMaterial(input)).toBeNull();
    expect(storage.deleteOriginal).not.toHaveBeenCalled();
    expect(storage.getSignedOriginalUrl).not.toHaveBeenCalled();
    await processUpload(created, other);
    expect(await db.select().from(documents)).toEqual([]);
    expect((await getMaterialStatus({ id: created.materialId, userId: owner })).status).toBe("processing");
  });

  it("allows only owner download and deletes storage plus cascaded document data", async () => {
    const created = await uploadPdf();
    await processUpload(created);
    const input = { id: created.materialId, userId: owner };
    expect(await getMaterialDownloadUrl(input)).toContain("example.invalid");
    expect(await deleteMaterial(input)).toEqual({ id: created.materialId });
    expect(storage.deleteOriginal).toHaveBeenCalledTimes(1);
    expect(await db.select().from(documents)).toEqual([]);
    expect(await db.select().from(chunks)).toEqual([]);
    await processUpload(created);
    expect(await db.select().from(documents)).toEqual([]);
  });

  it("retains material on storage deletion failure so deletion can be retried", async () => {
    const created = await uploadPdf();
    storage.deleteOriginal.mockRejectedValueOnce(new MaterialError("STORAGE_ERROR", "test deletion failed"));
    await expect(deleteMaterial({ id: created.materialId, userId: owner })).rejects.toMatchObject({ code: "STORAGE_ERROR" });
    expect(await getMaterialById({ id: created.materialId, userId: owner })).not.toBeNull();
  });

  it("compensates storage upload when material insertion fails", async () => {
    const file = createUploadFile({ buffer: createPdf({ pages: ["Test"] }), name: "test.pdf", type: "application/pdf" });
    await expect(createMaterial({ userId: "missing-user", file })).rejects.toThrow();
    expect(storage.deleteOriginal).toHaveBeenCalledTimes(1);
    expect(await db.select().from(materials)).toEqual([]);
  });

  it("does not insert a material when storage upload fails", async () => {
    storage.uploadOriginal.mockRejectedValueOnce(new MaterialError("STORAGE_ERROR", "test upload failed"));
    await expect(uploadPdf()).rejects.toMatchObject({ code: "STORAGE_ERROR" });
    expect(await db.select().from(materials)).toEqual([]);
  });

  it("sets useful error state for a scanned/blank PDF without partial writes", async () => {
    const created = await uploadPdf([""]);
    await processUpload(created);
    expect(await getMaterialStatus({ id: created.materialId, userId: owner })).toMatchObject({ status: "error", errorMessage: expect.stringContaining("No readable text") });
    expect(await db.select().from(documents)).toEqual([]);
    expect(await db.select().from(chunks)).toEqual([]);
  });

  it("rolls back document and chunk persistence on a database failure", async () => {
    const created = await uploadPdf();
    await pool.query("ALTER TABLE chunks ADD CONSTRAINT test_reject_chunks CHECK (false)");
    try {
      await processUpload(created);
      expect((await getMaterialStatus({ id: created.materialId, userId: owner })).status).toBe("error");
      expect(await db.select().from(documents)).toEqual([]);
      expect(await db.select().from(chunks)).toEqual([]);
    } finally { await pool.query("ALTER TABLE chunks DROP CONSTRAINT test_reject_chunks"); }
  });

  it("does not duplicate documents or chunks when processing is invoked twice", async () => {
    const created = await uploadPdf();
    await Promise.all([processUpload(created), processUpload(created)]);
    expect(await db.select().from(documents)).toHaveLength(1);
    expect(await db.select().from(chunks)).toHaveLength(2);
  });
});

async function extractedMaterial() {
  const created = await uploadPdf();
  await processUpload(created);
  return { id: created.materialId, userId: owner };
}

describe("AI analysis with real PostgreSQL", () => {
  it("atomically persists ordered topics and guide, clears errors, and advances extracted to ready", async () => {
    const input = await extractedMaterial();
    await db.update(materials).set({ errorMessage: "stale message" }).where(eq(materials.id, input.id));
    expect((await getMaterialStatus(input)).status).toBe("extracted");
    await analyzeDocument(input);
    expect(await getMaterialStatus(input)).toMatchObject({ status: "ready", errorMessage: null });
    expect(await getOverview(input)).toEqual({ overview: createAnalysis().studyGuide.overview });
    expect(await getStudyGuide(input)).toEqual(createAnalysis().studyGuide);
    expect((await getTopics(input)).map(({ title, summary, order }) => ({ title, summary, order })))
      .toEqual(createAnalysis().topics.map((topic, order) => ({ ...topic, order })));
    expect(gemini.generateDocumentAnalysis).toHaveBeenCalledTimes(1);
  });

  it("returns empty analysis while waiting and never calls AI before extraction", async () => {
    const created = await uploadPdf();
    const input = { id: created.materialId, userId: owner };
    await analyzeDocument(input);
    expect(gemini.generateDocumentAnalysis).not.toHaveBeenCalled();
    expect(await getOverview(input)).toBeNull();
    expect(await getStudyGuide(input)).toBeNull();
    expect(await getTopics(input)).toEqual([]);
  });

  it("protects all service reads and generation against foreign/missing materials", async () => {
    const input = await extractedMaterial();
    for (const forbidden of [{ ...input, userId: other }, { id: "missing", userId: owner }]) {
      await expect(getOverview(forbidden)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(getStudyGuide(forbidden)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(getTopics(forbidden)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await analyzeDocument(forbidden);
    }
    expect(gemini.generateDocumentAnalysis).not.toHaveBeenCalled();
    expect((await getMaterialStatus(input)).status).toBe("extracted");
  });

  it("rejects invalid structured output at the service boundary without partial writes", async () => {
    const input = await extractedMaterial();
    gemini.generateDocumentAnalysis.mockResolvedValueOnce({ topics: [], studyGuide: createAnalysis().studyGuide });
    await analyzeDocument(input);
    expect(await getMaterialStatus(input)).toMatchObject({ status: "error", errorMessage: expect.stringContaining("invalid study guide") });
    expect(await db.select().from(topics)).toEqual([]);
    expect(await db.select().from(studyGuides)).toEqual([]);
    expect(await db.select().from(documents)).toHaveLength(1);
    expect(await db.select().from(chunks)).toHaveLength(2);
  });

  it.each(["PROVIDER_ERROR", "INVALID_OUTPUT", "INPUT_TOO_LARGE"] as const)("preserves extraction and records safe %s failures", async (code) => {
    const input = await extractedMaterial();
    gemini.generateDocumentAnalysis.mockRejectedValueOnce(new AnalysisError(code, "AI analysis failed. Try again later.", { cause: new Error("private document content") }));
    await analyzeDocument(input);
    expect(await getMaterialStatus(input)).toMatchObject({ status: "error", errorMessage: "AI analysis failed. Try again later." });
    expect(await db.select().from(documents)).toHaveLength(1);
    expect(await db.select().from(topics)).toEqual([]);
    expect(await db.select().from(studyGuides)).toEqual([]);
  });

  it("rolls back replacement and ready state when guide persistence fails", async () => {
    const input = await extractedMaterial();
    // Existing rows must survive rollback, not just newly inserted topics.
    await db.insert(topics).values({ materialId: input.id, title: "Old topic", summary: "Old summary", order: 0 });
    await db.insert(studyGuides).values({ materialId: input.id, ...createAnalysis().studyGuide });
    await pool.query("ALTER TABLE study_guides ADD CONSTRAINT test_reject_new_guides CHECK (false) NOT VALID");
    try {
      await analyzeDocument(input);
      expect((await getMaterialStatus(input)).status).toBe("error");
      expect((await db.select().from(topics)).map((topic) => topic.title)).toEqual(["Old topic"]);
      expect(await db.select().from(studyGuides)).toHaveLength(1);
      expect(await getStudyGuide(input)).toBeNull();
    } finally { await pool.query("ALTER TABLE study_guides DROP CONSTRAINT test_reject_new_guides"); }
  });

  it("claims concurrent attempts once, exposes analyzing, and is idempotent after ready", async () => {
    const input = await extractedMaterial();
    let resolve!: (value: ReturnType<typeof createAnalysis>) => void;
    let started!: () => void;
    const entered = new Promise<void>((done) => { started = done; });
    gemini.generateDocumentAnalysis.mockImplementationOnce(() => {
      started();
      return new Promise((done) => { resolve = done; });
    });
    const first = analyzeDocument(input);
    await entered;
    expect((await getMaterialStatus(input)).status).toBe("analyzing");
    await analyzeDocument(input);
    expect(gemini.generateDocumentAnalysis).toHaveBeenCalledTimes(1);
    resolve(createAnalysis());
    await first;
    await analyzeDocument(input);
    expect(gemini.generateDocumentAnalysis).toHaveBeenCalledTimes(1);
    expect(await db.select().from(topics)).toHaveLength(2);
    expect(await db.select().from(studyGuides)).toHaveLength(1);
    expect((await getMaterialStatus(input)).status).toBe("ready");
  });

  it.each([false, true])("does not resurrect a material deleted during inference (failure=%s)", async (fails) => {
    const input = await extractedMaterial();
    let settle!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((done) => { started = done; });
    gemini.generateDocumentAnalysis.mockImplementationOnce(() => {
      started();
      return new Promise((resolve, reject) => {
        settle = () => fails ? reject(new AnalysisError("PROVIDER_ERROR", "Provider failed.")) : resolve(createAnalysis());
      });
    });
    const analysis = analyzeDocument(input);
    await entered;
    await deleteMaterial(input);
    settle();
    await analysis;
    expect(await db.select().from(materials)).toEqual([]);
    expect(await db.select().from(topics)).toEqual([]);
    expect(await db.select().from(studyGuides)).toEqual([]);
  });

  it("does not let a late failure overwrite a ready state", async () => {
    const input = await extractedMaterial();
    gemini.generateDocumentAnalysis.mockImplementationOnce(async () => {
      await db.update(materials).set({ status: "ready" }).where(eq(materials.id, input.id));
      throw new AnalysisError("PROVIDER_ERROR", "Late error");
    });
    await analyzeDocument(input);
    expect(await getMaterialStatus(input)).toMatchObject({ status: "ready", errorMessage: null });
  });

  it("cascades persisted analysis when its owner deletes the material", async () => {
    const input = await extractedMaterial();
    await analyzeDocument(input);
    await deleteMaterial(input);
    expect(await db.select().from(topics)).toEqual([]);
    expect(await db.select().from(studyGuides)).toEqual([]);
  });

  it("only counts the requesting user's topics on the dashboard", async () => {
    const input = await extractedMaterial();
    await analyzeDocument(input);
    const created = await uploadPdf();
    await db.update(materials).set({ userId: other }).where(eq(materials.id, created.materialId));
    await processUpload(created, other);
    await analyzeDocument({ id: created.materialId, userId: other });
    expect(await getDashboardStats({ userId: owner })).toMatchObject({ totalTopics: 2, totalStudyGuides: 1 });
    expect(await getDashboardStats({ userId: other })).toMatchObject({ totalTopics: 2, totalStudyGuides: 1 });
    expect(await getDashboardStats({ userId: "missing" })).toMatchObject({ totalTopics: 0, totalStudyGuides: 0 });
  });

  it("returns the newest five materials rather than the oldest", async () => {
    const ids: string[] = [];
    for (let index = 0; index < 6; index++) {
      const created = await uploadPdf();
      ids.push(created.materialId);
      await db.update(materials).set({ createdAt: new Date(Date.UTC(2026, 0, index + 1)) }).where(eq(materials.id, created.materialId));
    }
    const stats = await getDashboardStats({ userId: owner });
    expect(stats.recentMaterials.map((material) => material.id)).toEqual(ids.slice(1).reverse());
    expect(stats.totalMaterials).toBe(6);
    expect(stats.totalStudyGuides).toBe(0);
  });
});

describe("ownership-protected analysis tRPC endpoints", () => {
  it("returns live analysis through authenticated callers", async () => {
    const input = await extractedMaterial();
    await analyzeDocument(input);
    const caller = analysisRouter.createCaller(createCallerContext(owner));
    expect(await caller.getStudyGuide({ id: input.id })).toEqual(createAnalysis().studyGuide);
    expect(await caller.getOverview({ id: input.id })).toEqual({ overview: createAnalysis().studyGuide.overview });
    expect(await caller.getTopics({ id: input.id })).toHaveLength(2);
  });
  it("returns UNAUTHORIZED before any data access", async () => {
    const caller = analysisRouter.createCaller(createCallerContext(null));
    await expect(caller.getOverview({ id: "missing" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.getTopics({ id: "missing" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.getStudyGuide({ id: "missing" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("maps missing and foreign materials to indistinguishable NOT_FOUND", async () => {
    const input = await extractedMaterial();
    const caller = analysisRouter.createCaller(createCallerContext(other));
    for (const id of [input.id, "missing"]) {
      await expect(caller.getOverview({ id })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Material not found or access denied." });
      await expect(caller.getTopics({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(caller.getStudyGuide({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });
  it("validates inputs with Zod before database queries", async () => {
    const caller = analysisRouter.createCaller(createCallerContext(owner));
    await expect(caller.getOverview({ id: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.getTopics({ id: "x".repeat(201) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("topic resources tRPC endpoint", () => {
  it("finds videos for an owned, ready topic without sending the summary", async () => {
    const { materialId } = await readyTutorMaterial();
    const [topic] = await getTopics({ id: materialId, userId: owner });
    const caller = appRouter.createCaller(createCallerContext(owner));
    mockYouTubeResponse();
    try {
      const videos = await caller.resources.findVideos({ materialId, topicId: topic.id });
      expect(videos).toHaveLength(1);
      expect(videos[0].reason).toContain(topic.title);
      expect(youtubeFetch).toHaveBeenCalledTimes(1);
      const [request] = youtubeFetch.mock.calls[0];
      expect(new URL(String(request)).searchParams.get("q")).toBe(`${topic.title} tutorial`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not contact YouTube for unauthorized, mismatched, or unready topics", async () => {
    const { materialId } = await readyTutorMaterial();
    const [topic] = await getTopics({ id: materialId, userId: owner });
    const second = await readyTutorMaterial();
    const findVideos = (userId: string | null) => appRouter.createCaller(createCallerContext(userId)).resources.findVideos;
    const input = { materialId, topicId: topic.id };
    mockYouTubeResponse();
    try {
      await expect(findVideos(null)(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(findVideos(other)(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(findVideos(owner)({ ...input, materialId: second.materialId })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(findVideos(owner)({ ...input, topicId: "invalid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await db.update(materials).set({ status: "analyzing" }).where(eq(materials.id, materialId));
      await expect(findVideos(owner)(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(youtubeFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("searches OpenAlex only for the requested topic on an owned, ready material", async () => {
    const { materialId } = await readyTutorMaterial();
    const [topic] = await getTopics({ id: materialId, userId: owner });
    const otherMaterial = await readyTutorMaterial();
    const findPapers = (userId: string | null) => appRouter.createCaller(createCallerContext(userId)).resources.findPapers;
    const input = { materialId, topicId: topic.id };
    mockOpenAlexResponse();
    try {
      await expect(findPapers(null)(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(findPapers(other)(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(findPapers(owner)({ ...input, materialId: otherMaterial.materialId })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(findPapers(owner)({ ...input, topicId: "invalid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(openAlexFetch).not.toHaveBeenCalled();
      await expect(findPapers(owner)(input)).resolves.toEqual([expect.objectContaining({ reason: `The title mentions “${topic.title}”.` })]);
      expect(openAlexFetch).toHaveBeenCalledTimes(1);
      const url = new URL(String(openAlexFetch.mock.calls[0][0]));
      expect(url.searchParams.get("search")).toBe(topic.title);
      expect(url.search).not.toContain(encodeURIComponent(topic.summary));
      await db.update(materials).set({ status: "analyzing" }).where(eq(materials.id, materialId));
      await expect(findPapers(owner)(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(openAlexFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

async function readyTutorMaterial() {
  const input = await extractedMaterial();
  await analyzeDocument(input);
  return { materialId: input.id, userId: owner };
}
async function tutorTurn(input: { materialId: string; userId: string; conversationId?: string; question?: string }) {
  return Array.fromAsync(await prepareTutorTurn({ question: "What is photosynthesis?", ...input, signal: new AbortController().signal }));
}
function tutorRequest(materialId: string, body: unknown = { question: "What is photosynthesis?" }, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/materials/${materialId}/tutor/stream`, {
    method: "POST", body: JSON.stringify(body), headers: { origin, "content-type": "application/json" },
  });
}
const tutorParams = (materialId: string) => ({ params: Promise.resolve({ materialId }) });

describe("grounded tutor retrieval and persistence", () => {
  it("retrieves ranked, owner/material-scoped English lexemes with real page metadata", async () => {
    const input = await readyTutorMaterial();
    const second = await readyTutorMaterial();
    await db.update(materials).set({ userId: other }).where(eq(materials.id, second.materialId));
    const rows = await retrieveSources({ ...input, question: "Explain how photosynthesis converts energy" });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.pageNumber === 1)).toBe(true);
    const ownIds = (await db.select().from(chunks).where(eq(chunks.materialId, input.materialId))).map((row) => row.id);
    expect(rows.every((row) => ownIds.includes(row.chunkId))).toBe(true);
    expect(await retrieveSources({ ...input, question: "the and of" })).toEqual([]);
    expect(await retrieveSources({ ...input, question: "unrelatedquasar" })).toEqual([]);
    await expect(retrieveSources({ ...input, userId: other, question: "photosynthesis" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("bounds retrieval to six whole chunks and the context budget", async () => {
    const input = await readyTutorMaterial();
    const [document] = await db.select().from(documents).where(eq(documents.materialId, input.materialId));
    await db.delete(chunks).where(eq(chunks.materialId, input.materialId));
    await db.insert(chunks).values(Array.from({ length: 10 }, (_, chunkIndex) => ({ documentId: document.id, materialId: input.materialId,
      content: "photosynthesis ".repeat(210), chunkIndex, pageNumber: chunkIndex + 1,
    })));
    const rows = await retrieveSources({ ...input, question: "photosynthesis" });
    expect(rows.length).toBeLessThanOrEqual(6);
    expect(rows.reduce((sum, row) => sum + row.content.length, 0)).toBeLessThanOrEqual(MAX_CONTEXT_CHARACTERS);
    expect(rows[0].pageNumber).toBe(1);
  });
  it("saves only completed exchanges and returns citation metadata with history", async () => {
    const input = await readyTutorMaterial();
    const events = await tutorTurn(input);
    const done = events.at(-1)!;
    expect(done.type).toBe("done");
    if (done.type !== "done") throw new Error("No completion");
    expect(done.message.citations?.[0]).toMatchObject({ sourceId: "S1", pageNumber: 1 });
    const conversation = await getConversation({ ...input, conversationId: done.conversationId });
    expect(conversation.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(await listConversations(input)).toHaveLength(1);
    await tutorTurn({ ...input, conversationId: done.conversationId, question: "Can you explain that?" });
    expect((await getConversation({ ...input, conversationId: done.conversationId })).messages).toHaveLength(4);
    expect(tutorProvider.streamTutorAnswer.mock.calls[1][0].history).toHaveLength(2);
    await deleteMaterial({ id: input.materialId, userId: owner });
    expect(await db.select().from(conversations)).toEqual([]);
  });
  it("returns an explicit unsupported response without calling Gemini for no matches", async () => {
    const input = await readyTutorMaterial();
    const events = await tutorTurn({ ...input, question: "unrelatedquasar" });
    expect(tutorProvider.streamTutorAnswer).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: "done", message: { grounding: "unsupported", citations: [] } });
  });
  it("preserves DOCX headings and never invents page numbers", async () => {
    const file = createUploadFile({ buffer: createDocx({ paragraphs: [{ text: "Photosynthesis", heading: 1 }, { text: "Photosynthesis converts light into chemical energy." }] }), name: "notes.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const created = await createMaterial({ userId: owner, file });
    await processUpload(created); await analyzeDocument({ id: created.materialId, userId: owner });
    const events = await tutorTurn({ materialId: created.materialId, userId: owner });
    const done = events.at(-1)!;
    if (done.type !== "done") throw new Error("No completion");
    expect(done.message.citations?.[0]).toMatchObject({ sectionHeading: "Photosynthesis" });
    expect(done.message.citations?.[0]).not.toHaveProperty("pageNumber");
  });
  it("enforces readiness and conversation/material/user ownership before inference", async () => {
    const created = await uploadPdf();
    await expect(tutorTurn({ materialId: created.materialId, userId: owner })).rejects.toMatchObject({ code: "NOT_READY" });
    const input = await readyTutorMaterial();
    const done = (await tutorTurn(input)).at(-1)!;
    if (done.type !== "done") throw new Error("No completion");
    const second = await readyTutorMaterial();
    for (const forbidden of [{ ...input, userId: other }, second]) {
      await expect(getConversation({ ...forbidden, conversationId: done.conversationId })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(tutorTurn({ ...forbidden, conversationId: done.conversationId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(tutorProvider.streamTutorAnswer).toHaveBeenCalledTimes(1);
  });
  it.each(["invalid", "failure", "cancel", "delete"])("discards an unfinished %s exchange", async (scenario) => {
    const input = await readyTutorMaterial();
    const controller = new AbortController();
    tutorProvider.streamTutorAnswer.mockImplementationOnce(async function* () {
      yield { type: "delta", text: "Partial" };
      if (scenario === "failure") throw new TutorError("PROVIDER_ERROR", "Provider failed.");
      if (scenario === "cancel") controller.abort();
      if (scenario === "delete") await deleteMaterial({ id: input.materialId, userId: owner });
      yield { type: "answer", answer: createTutorAnswer(scenario === "invalid" ? { sourceIds: ["S6"], answer: "Invented [S6]." } : {}) };
    });
    const iterator = await prepareTutorTurn({ ...input, question: "Photosynthesis?", signal: controller.signal });
    await expect(Array.fromAsync(iterator)).rejects.toBeInstanceOf(TutorError);
    expect(await db.select().from(conversations)).toEqual([]);
  });
  it("rejects concurrent stale history without losing a saved exchange", async () => {
    const input = await readyTutorMaterial();
    const done = (await tutorTurn(input)).at(-1)!;
    if (done.type !== "done") throw new Error("No completion");
    const turnInput = { ...input, question: "Photosynthesis?", conversationId: done.conversationId, signal: new AbortController().signal };
    const first = await prepareTutorTurn(turnInput);
    const second = await prepareTutorTurn(turnInput);
    const results = await Promise.allSettled([Array.fromAsync(first), Array.fromAsync(second)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
    expect((await getConversation({ ...input, conversationId: done.conversationId })).messages).toHaveLength(4);
  });
  it("accepts consecutive maximum-length questions including their retrieval separator", async () => {
    const input = await readyTutorMaterial();
    const question = "photosynthesis".padEnd(2_000, "x");
    const done = (await tutorTurn({ ...input, question })).at(-1)!;
    if (done.type !== "done") throw new Error("No completion");
    const second = await tutorTurn({ ...input, question, conversationId: done.conversationId });
    expect(second.at(-1)?.type).toBe("done");
  });
  it("rejects a full conversation before retrieval or provider inference", async () => {
    const input = await readyTutorMaterial();
    const done = (await tutorTurn(input)).at(-1)!;
    if (done.type !== "done") throw new Error("No completion");
    const saved = await getConversation({ ...input, conversationId: done.conversationId });
    await db.update(conversations).set({ messages: Array.from({ length: 50 }, () => saved.messages).flat() }).where(eq(conversations.id, done.conversationId));
    await expect(tutorTurn({ ...input, conversationId: done.conversationId })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tutorProvider.streamTutorAnswer).toHaveBeenCalledTimes(1);
  });
  it("rolls back the entire exchange on persistence failure", async () => {
    const input = await readyTutorMaterial();
    await pool.query("ALTER TABLE conversations ADD CONSTRAINT test_reject_conversation CHECK (false)");
    try {
      await expect(tutorTurn(input)).rejects.toMatchObject({ code: "PERSISTENCE_ERROR" });
      expect(await db.select().from(conversations)).toEqual([]);
    } finally { await pool.query("ALTER TABLE conversations DROP CONSTRAINT test_reject_conversation"); }
  });
});

describe("tutor HTTP streaming and tRPC history", () => {
  it("sends SSE deltas then persisted completion with no-store headers", async () => {
    const input = await readyTutorMaterial();
    const response = await tutorPOST(tutorRequest(input.materialId), tutorParams(input.materialId));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const events = (await response.text()).split("\n\n").filter(Boolean).map((frame) => tutorEventSchema.parse(JSON.parse(frame.split("\ndata: ")[1])));
    expect(events.map((event) => event.type)).toEqual(["delta", "done"]);
    const done = events.at(-1)!;
    if (done.type !== "done") throw new Error("No completion");
    const caller = tutorRouter.createCaller(createCallerContext(owner));
    expect(await caller.listConversations({ materialId: input.materialId })).toHaveLength(1);
    expect((await caller.getConversation({ materialId: input.materialId, conversationId: done.conversationId })).messages).toHaveLength(2);
    await expect(tutorRouter.createCaller(createCallerContext(other)).getConversation({ materialId: input.materialId, conversationId: done.conversationId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(tutorRouter.createCaller(createCallerContext(null)).listConversations({ materialId: input.materialId })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("rejects origin, session, malformed input, foreign ownership and unready material before streaming", async () => {
    const input = await readyTutorMaterial();
    expect((await tutorPOST(tutorRequest(input.materialId, {}, "https://example.invalid"), tutorParams(input.materialId))).status).toBe(403);
    transport.createTRPCContext.mockResolvedValueOnce({ session: null });
    expect((await tutorPOST(tutorRequest(input.materialId), tutorParams(input.materialId))).status).toBe(401);
    expect((await tutorPOST(tutorRequest(input.materialId, { question: "" }), tutorParams(input.materialId))).status).toBe(400);
    expect((await tutorPOST(tutorRequest("invalid"), tutorParams("invalid"))).status).toBe(400);
    transport.createTRPCContext.mockResolvedValueOnce({ session: { user: { id: other } } });
    expect((await tutorPOST(tutorRequest(input.materialId), tutorParams(input.materialId))).status).toBe(404);
    const pending = await uploadPdf();
    expect((await tutorPOST(tutorRequest(pending.materialId), tutorParams(pending.materialId))).status).toBe(409);
    expect(tutorProvider.streamTutorAnswer).not.toHaveBeenCalled();
  });
  it("emits a safe error event after a partial stream and saves nothing", async () => {
    const input = await readyTutorMaterial();
    tutorProvider.streamTutorAnswer.mockImplementationOnce(async function* () {
      yield { type: "delta", text: "Partial" };
      throw new Error("private source and key");
    });
    const response = await tutorPOST(tutorRequest(input.materialId), tutorParams(input.materialId));
    const text = await response.text();
    expect(text).toContain("event: error");
    expect(text).not.toContain("private source");
    expect(text).not.toContain("event: done");
    expect(await db.select().from(conversations)).toEqual([]);
  });
  it("cancels provider inference when the response reader disconnects", async () => {
    const input = await readyTutorMaterial();
    const response = await tutorPOST(tutorRequest(input.materialId), tutorParams(input.materialId));
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(tutorProvider.streamTutorAnswer.mock.calls[0][0].signal.aborted).toBe(true);
    expect(await db.select().from(conversations)).toEqual([]);
  });
});
