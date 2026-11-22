import { vi } from "vitest";

const storage = vi.hoisted(() => ({
  uploadOriginal: vi.fn(async ({ storageId }: { buffer: Buffer; storageId: string }) => ({ storageId })),
  deleteOriginal: vi.fn(async (_storageId: string) => {}),
  getSignedOriginalUrl: vi.fn((storageId: string) => `https://example.invalid/download/${encodeURIComponent(storageId)}`),
}));
vi.mock("@/lib/storage/cloudinary", () => storage);
export { storage };
