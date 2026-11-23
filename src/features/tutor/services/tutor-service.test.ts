import { describe, expect, it } from "vitest";
import { createTutorAnswer, createTutorSources } from "../../../../mocks/tutor-fixtures";
import { validateTutorAnswer } from "./tutor-service";
import { readTutorRequest } from "./tutor-request";
import { tutorRequestSchema } from "../schemas/tutor";

const sources = createTutorSources();
describe("tutor citation validation", () => {
  it("resolves genuine page and DOCX heading metadata from retrieved chunks", () => {
    const citations = validateTutorAnswer({ sources, answer: createTutorAnswer({ answer: "Explanation [S1] [S2].", sourceIds: ["S1", "S2"] }) });
    expect(citations[0]).toMatchObject({ pageNumber: 2, chunkId: sources[0].chunkId, text: sources[0].content });
    expect(citations[1]).toMatchObject({ sectionHeading: "Chlorophyll" });
    expect(citations[1]).not.toHaveProperty("pageNumber");
  });
  it.each([
    { sourceIds: ["S6"], answer: "Invented [S6]." }, { sourceIds: ["S1", "S1"] },
    { sourceIds: [] }, { answer: "Uncited claim." }, { answer: "Wrong [S2]." },
    { grounding: "unsupported" as const }, { answer: "Wrong [S99]." },
  ])("rejects nonexistent, duplicate, missing or inconsistent citations: %#", (overrides) => {
    expect(() => validateTutorAnswer({ sources, answer: createTutorAnswer(overrides) })).toThrow();
  });
  it("preserves whole Unicode chunk excerpts within the extractor budget", () => {
    const unicodeSources = [{ ...sources[0], content: "🌿".repeat(3_000) }];
    expect(validateTutorAnswer({ sources: unicodeSources, answer: createTutorAnswer() })[0].text).toBe(unicodeSources[0].content);
  });
  it("permits a source-free unsupported answer", () => {
    expect(validateTutorAnswer({ sources: [], answer: createTutorAnswer({ answer: "The material does not support this answer.", sourceIds: [], grounding: "unsupported" }) })).toEqual([]);
  });
});
describe("tutor JSON request", () => {
  const request = (body: string, type = "application/json") => new Request("http://localhost/tutor", { method: "POST", body, headers: { "content-type": type } });
  it("trims and validates the question", async () => {
    expect(await readTutorRequest(request('{"question":"  Light?  "}'))).toEqual({ question: "Light?" });
  });
  it.each(["", "not JSON", '{"question":""}', '{"question":"Q","userId":"spoofed"}', JSON.stringify({ question: "x".repeat(2_001) }), "x".repeat(16_385)])("rejects invalid or oversized request: %#", async (body) => {
    await expect(readTutorRequest(request(body))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("rejects non-JSON and malformed conversation IDs", async () => {
    await expect(readTutorRequest(request("question", "text/plain"))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(tutorRequestSchema.safeParse({ question: "Q", conversationId: "foreign" }).success).toBe(false);
  });
});
