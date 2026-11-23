import { describe, expect, it } from "vitest";
import { createBrowserTutorDone, createBrowserTutorSse, splitSseResponse } from "../../../../mocks/tutor-fixtures";
import { readTutorStream } from "./read-tutor-stream";

describe("browser tutor stream", () => {
  it.each([false, true])("buffers split UTF-8 and frames (CRLF=%s), returning authoritative done", async (crlf) => {
    const done = createBrowserTutorDone();
    const deltas: string[] = [];
    const response = splitSseResponse(createBrowserTutorSse([{ type: "delta", text: "Chlorophyll 🌿" }, done], crlf), 1);
    const result = await readTutorStream({ response, signal: new AbortController().signal, onDelta: (text) => deltas.push(text) });
    expect(deltas.join("")).toBe("Chlorophyll 🌿");
    expect(result).toEqual(done);
  });

  it("rejects post-delta errors instead of returning a completed answer", async () => {
    const response = splitSseResponse(createBrowserTutorSse([{ type: "delta", text: "Draft" }, { type: "error", code: "INVALID_OUTPUT", error: "Invalid citations" }]));
    await expect(readTutorStream({ response, signal: new AbortController().signal, onDelta: () => undefined })).rejects.toThrow("Invalid citations");
  });

  it("rejects EOF without confirmation", async () => {
    const response = splitSseResponse(createBrowserTutorSse([{ type: "delta", text: "Draft" }]));
    await expect(readTutorStream({ response, signal: new AbortController().signal, onDelta: () => undefined })).rejects.toThrow("before confirmation");
  });

  it("rejects mismatched event types", async () => {
    const response = splitSseResponse(createBrowserTutorSse([createBrowserTutorDone()]).replace("event: done", "event: delta"));
    await expect(readTutorStream({ response, signal: new AbortController().signal, onDelta: () => undefined })).rejects.toThrow("invalid event");
  });

  it("handles session errors without a code", async () => {
    const response = new Response(JSON.stringify({ error: "Sign in to continue" }), { status: 401 });
    await expect(readTutorStream({ response, signal: new AbortController().signal, onDelta: () => undefined })).rejects.toThrow("Sign in to continue");
  });

  it("honors cancellation before a done frame in the same read", async () => {
    const controller = new AbortController();
    const response = splitSseResponse(createBrowserTutorSse([{ type: "delta", text: "Draft" }, createBrowserTutorDone()]), 10000);
    await expect(readTutorStream({ response, signal: controller.signal, onDelta: () => controller.abort() })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("cancels when aborted during the stream", async () => {
    const controller = new AbortController();
    const response = splitSseResponse(createBrowserTutorSse([{ type: "delta", text: "Draft" }, createBrowserTutorDone()]));
    await expect(readTutorStream({ response, signal: controller.signal, onDelta: () => controller.abort() })).rejects.toMatchObject({ name: "AbortError" });
  });
});
