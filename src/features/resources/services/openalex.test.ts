import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import { mockOpenAlexResponse, openAlexFetch, openAlexWork } from "../../../../mocks/openalex";
import { searchOpenAlex } from "./openalex";

const originalKey = env.OPENALEX_API_KEY;
beforeEach(() => {
  env.OPENALEX_API_KEY = undefined;
  mockOpenAlexResponse();
});
afterEach(() => {
  env.OPENALEX_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

describe("OpenAlex paper discovery", () => {
  it("searches open-access articles and reviews without a key and explains title matches", async () => {
    await expect(searchOpenAlex("Photosynthesis")).resolves.toEqual([{
      id: "https://openalex.org/W123", title: "Photosynthesis in plants", year: 2024,
      url: "https://example.invalid/read/w123", reason: "The title mentions “Photosynthesis”.",
    }]);
    const [request, options] = openAlexFetch.mock.calls[0];
    const url = new URL(String(request));
    expect(url.origin + url.pathname).toBe("https://api.openalex.org/works");
    expect(url.searchParams.get("search")).toBe("Photosynthesis");
    expect(url.searchParams.get("filter")).toBe("is_oa:true,type:article|review");
    expect(url.searchParams.has("api_key")).toBe(false);
    expect(options).toMatchObject({ headers: undefined, redirect: "error", cache: "no-store", signal: expect.any(AbortSignal) });
  });

  it("sends the optional API key in the authorization header", async () => {
    env.OPENALEX_API_KEY = "test_openalex_key";
    await searchOpenAlex("Photosynthesis");
    const [request, options] = openAlexFetch.mock.calls[0];
    expect(String(request)).not.toContain(env.OPENALEX_API_KEY);
    expect(options?.headers).toEqual({ Authorization: "Bearer test_openalex_key" });
  });

  it("uses abstract words and excludes duplicates, closed works, unsafe links, and weak matches", async () => {
    openAlexFetch.mockResolvedValueOnce(Response.json({ results: [
      openAlexWork({ title: "Research on plants", type: "review", year: null, abstract: { Photosynthesis: [2], energy: [7] } }),
      openAlexWork({ title: "Photosynthesis and energy", url: "https://example.invalid/duplicate-id" }),
      openAlexWork({ id: "https://openalex.org/W124", title: "Photosynthesis and energy" }),
      openAlexWork({ id: "https://openalex.org/W125", title: "Photosynthesis and energy", url: "https://example.invalid/closed", isOpen: false }),
      openAlexWork({ id: "https://openalex.org/W126", title: "Photosynthesis and energy", url: "javascript:alert(1)" }),
      openAlexWork({ id: "https://openalex.org/W127", title: "Photosynthesis and energy", url: "https://example.invalid/book", type: "book" }),
      openAlexWork({ id: "https://openalex.org/W128", title: "Photosynthesis", url: "https://example.invalid/weak" }),
      openAlexWork({ id: "https://openalex.org/W129", title: "Photosynthesis and energy", url: null }),
      openAlexWork({ id: "https://openalex.org/W130", title: "Photosynthesis and energy", url: "https://user:pass@example.invalid/embedded" }),
    ] }));
    const papers = await searchOpenAlex("Photosynthesis and energy");
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({ year: null, reason: "The abstract mentions “Photosynthesis”, “energy”." });
  });

  it("caps results and returns an empty list for no matches or no search terms", async () => {
    await expect(searchOpenAlex("the & --")).resolves.toEqual([]);
    expect(openAlexFetch).not.toHaveBeenCalled();
    openAlexFetch.mockResolvedValueOnce(Response.json({ results: [] }));
    await expect(searchOpenAlex("Photosynthesis")).resolves.toEqual([]);
    openAlexFetch.mockResolvedValueOnce(Response.json({ results: Array.from({ length: 8 }, (_, i) =>
      openAlexWork({ id: `https://openalex.org/W${i}`, url: `https://example.invalid/${i}` }),
    ) }));
    await expect(searchOpenAlex("Photosynthesis")).resolves.toHaveLength(5);
  });

  it("handles rate limits, bad responses, and network errors without exposing provider details", async () => {
    openAlexFetch.mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(searchOpenAlex("Photosynthesis")).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    openAlexFetch.mockResolvedValueOnce(Response.json({ results: [{ unrelated: true }] }));
    await expect(searchOpenAlex("Photosynthesis")).rejects.toMatchObject({ code: "UNAVAILABLE" });
    openAlexFetch.mockRejectedValueOnce(new Error("internal provider info"));
    await expect(searchOpenAlex("Photosynthesis")).rejects.toMatchObject({ code: "UNAVAILABLE", message: "OpenAlex search is unavailable right now. Try again in a moment." });
  });
});
