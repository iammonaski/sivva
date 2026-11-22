import { vi } from "vitest";

const transport = vi.hoisted(() => ({
  createTRPCContext: vi.fn(async () => ({ session: { user: { id: "test-owner" } } } as { session: { user: { id: string } } | null })),
  after: vi.fn<((callback: () => Promise<void>) => void)>(),
}));
vi.mock("@/server/trpc/context", () => ({ createTRPCContext: transport.createTRPCContext }));
vi.mock("next/server", () => ({ after: transport.after }));
export { transport };
