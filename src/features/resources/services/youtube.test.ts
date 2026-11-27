import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockYouTubeResponse, youtubeFetch, youtubeVideo } from "../../../../mocks/youtube";
import { env } from "@/lib/env";
import { searchYouTube } from "./youtube";

beforeEach(mockYouTubeResponse);
afterEach(() => vi.unstubAllGlobals());

describe("YouTube lesson discovery", () => {
  it("searches only the selected title plus a tutorial qualifier and builds links from video IDs", async () => {
    const videos = await searchYouTube("Photosynthesis");
    expect(videos).toEqual([{
      id: "vid00000001", title: "Photosynthesis explained", channel: "Biology & more",
      reason: "The video title mentions “Photosynthesis”.",
      url: "https://www.youtube.com/watch?v=vid00000001",
      thumbnail: "https://i.ytimg.com/vi/vid00000001/mqdefault.jpg",
    }]);
    const [request, options] = youtubeFetch.mock.calls[0];
    const url = new URL(String(request));
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/search");
    expect(url.searchParams.get("q")).toBe("Photosynthesis tutorial");
    expect(url.searchParams.get("type")).toBe("video");
    expect(url.searchParams.has("key")).toBe(false);
    expect(options).toMatchObject({ headers: { "x-goog-api-key": "test_youtube_key" }, cache: "no-store", redirect: "error", signal: expect.any(AbortSignal) });
  });

  it("filters weak and malformed matches, deduplicates, and ranks title matches first", async () => {
    youtubeFetch.mockResolvedValueOnce(Response.json({ items: [
      youtubeVideo({ id: "description", title: "Plants explained", description: "Photosynthesis &amp; chemical energy" }),
      youtubeVideo({ id: "irrelevant1", title: "Photosynthesis" }),
      youtubeVideo({ id: "titlematch1", title: "Photosynthesis &amp; energy" }),
      youtubeVideo({ id: "titlematch1", title: "Duplicate Photosynthesis Energy" }),
      youtubeVideo({ id: "invalid/id?", title: "Photosynthesis Energy" }),
    ] }));
    const videos = await searchYouTube("Photosynthesis and energy");
    expect(videos.map(({ id }) => id)).toEqual(["titlematch1", "description"]);
    expect(videos[0].title).toBe("Photosynthesis & energy");
    expect(videos[1].reason).toBe("The video description mentions “Photosynthesis”, “energy”.");
  });

  it("does not send a request when the key is missing or the topic has no search terms", async () => {
    const key = env.YOUTUBE_API_KEY;
    try {
      env.YOUTUBE_API_KEY = undefined;
      await expect(searchYouTube("Photosynthesis")).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    } finally {
      env.YOUTUBE_API_KEY = key;
    }
    await expect(searchYouTube("the & --")).resolves.toEqual([]);
    expect(youtubeFetch).not.toHaveBeenCalled();
  });

  it("returns no matches for a successful empty response and caps the number of suggestions", async () => {
    youtubeFetch.mockResolvedValueOnce(Response.json({ items: [] }));
    await expect(searchYouTube("Photosynthesis")).resolves.toEqual([]);
    youtubeFetch.mockResolvedValueOnce(Response.json({ items: Array.from({ length: 8 }, (_, index) =>
      youtubeVideo({ id: `vid0000000${index}` }),
    ) }));
    await expect(searchYouTube("Photosynthesis")).resolves.toHaveLength(5);
  });

  it("reports quota exhaustion separately and does not expose provider errors", async () => {
    youtubeFetch.mockResolvedValueOnce(Response.json({ error: { errors: [{ reason: "quotaExceeded" }] } }, { status: 403 }));
    await expect(searchYouTube("Photosynthesis")).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    youtubeFetch.mockRejectedValueOnce(new Error("provider message containing test_youtube_key"));
    await expect(searchYouTube("Photosynthesis")).rejects.toMatchObject({ code: "UNAVAILABLE", message: "YouTube search is unavailable right now. Try again in a moment." });
    youtubeFetch.mockResolvedValueOnce(Response.json({ unexpected: true }));
    await expect(searchYouTube("Photosynthesis")).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
