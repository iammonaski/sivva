import { vi } from "vitest";
export const geminiFetch = vi.fn<typeof fetch>();
export function installGeminiFetch() {
  geminiFetch.mockReset();
  vi.stubGlobal("fetch", geminiFetch);
}

export function controlGeminiTimeout() {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  return { controller, timeout };
}
