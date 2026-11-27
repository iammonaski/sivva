import { vi } from "vitest";

export const youtubeFetch = vi.fn<typeof fetch>();

export function youtubeVideo({ id = "vid00000001", title = "Photosynthesis explained", description = "", channelTitle = "Biology &amp; more" } = {}) {
  return { id: { videoId: id }, snippet: { title, description, channelTitle } };
}

export function mockYouTubeResponse() {
  youtubeFetch.mockReset().mockImplementation(async () => Response.json({ items: [youtubeVideo()] }));
  vi.stubGlobal("fetch", youtubeFetch);
}
