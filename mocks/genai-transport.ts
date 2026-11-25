import { vi } from "vitest";

// Stub only the network boundary; gemini-client tests exercise the real SDK.
export const genaiFetch = vi.fn<typeof fetch>();
export function installGenaiFetch() {
  genaiFetch.mockReset();
  vi.stubGlobal("fetch", genaiFetch);
}
