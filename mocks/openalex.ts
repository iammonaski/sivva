import { vi } from "vitest";

export const openAlexFetch = vi.fn<typeof fetch>();

export function openAlexWork({
  id = "https://openalex.org/W123",
  title = "Photosynthesis in plants" as string | null,
  year = 2024 as number | null,
  type = "article",
  isOpen = true,
  url = "https://example.invalid/read/w123" as string | null,
  abstract = null as Record<string, number[]> | null,
} = {}) {
  return {
    id, title, type, publication_year: year,
    open_access: { is_oa: isOpen, oa_url: url },
    abstract_inverted_index: abstract,
  };
}

export function mockOpenAlexResponse() {
  openAlexFetch.mockReset().mockImplementation(async () => Response.json({ results: [openAlexWork()] }));
  vi.stubGlobal("fetch", openAlexFetch);
}
