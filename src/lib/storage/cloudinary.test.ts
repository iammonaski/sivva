import { afterEach, describe, expect, it, vi } from "vitest";
import { mockCloudinaryDeletion, mockCloudinaryUpload } from "../../../mocks/cloudinary";
import { uploadOriginal, deleteOriginal, getSignedOriginalUrl } from "./cloudinary";

afterEach(() => vi.restoreAllMocks());

describe("private Cloudinary originals", () => {
  it("uploads raw authenticated assets without filenames or public URLs", async () => {
    const upload = mockCloudinaryUpload();
    expect(await uploadOriginal({ buffer: Buffer.from("test"), storageId: "materials/test.pdf" })).toEqual({ storageId: "materials/test.pdf" });
    expect(upload.mock.calls[0][0]).toMatchObject({ public_id: "materials/test.pdf", resource_type: "raw", type: "authenticated", overwrite: false });
  });

  it("wraps upload failures and rejects invalid provider responses", async () => {
    mockCloudinaryUpload({ error: new Error("provider secret error") });
    await expect(uploadOriginal({ buffer: Buffer.from("test"), storageId: "materials/test.pdf" })).rejects.toMatchObject({ code: "STORAGE_ERROR", message: expect.not.stringContaining("secret") });
    vi.restoreAllMocks();
    mockCloudinaryUpload({ result: { public_id: "" } });
    await expect(uploadOriginal({ buffer: Buffer.from("test"), storageId: "materials/test.pdf" })).rejects.toMatchObject({ code: "STORAGE_ERROR" });
  });

  it.each(["ok", "not found"])("accepts deletion result %s with matching delivery type", async (result) => {
    const deletion = mockCloudinaryDeletion({ result });
    await deleteOriginal("materials/test.docx");
    expect(deletion).toHaveBeenCalledWith("materials/test.docx", { resource_type: "raw", type: "authenticated", invalidate: true });
  });

  it("rejects unexpected deletion results", async () => {
    mockCloudinaryDeletion({ result: "error" });
    await expect(deleteOriginal("materials/test.pdf")).rejects.toMatchObject({ code: "STORAGE_ERROR" });
  });

  it("signs short-lived raw downloads without duplicating extensions", () => {
    const now = Math.floor(Date.now() / 1000);
    const url = new URL(getSignedOriginalUrl("materials/test.docx"));
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toContain("/raw/download");
    expect(url.searchParams.get("public_id")).toBe("materials/test.docx");
    expect(url.searchParams.get("format")).toBeNull();
    expect(url.searchParams.get("type")).toBe("authenticated");
    expect(url.searchParams.get("attachment")).toBe("true");
    expect(Number(url.searchParams.get("expires_at"))).toBeGreaterThanOrEqual(now + 60);
    expect(url.searchParams.get("signature")).toBeTruthy();
    expect(url.toString()).not.toContain("test-secret");
  });
});
