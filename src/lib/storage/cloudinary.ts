import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { env } from "@/lib/env";
import { MaterialError } from "@/features/materials/material-error";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

const uploadResultSchema = z.object({ public_id: z.string().min(1) });

export async function uploadOriginal({ buffer, storageId }: { buffer: Buffer; storageId: string }) {
  try {
    return await new Promise<{ storageId: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        public_id: storageId,
        resource_type: "raw",
        type: "authenticated",
        overwrite: false,
        timeout: 60_000,
      }, (error, result) => {
        if (error) return reject(error);
        const parsed = uploadResultSchema.safeParse(result);
        if (!parsed.success) return reject(parsed.error);
        resolve({ storageId: parsed.data.public_id });
      });
      stream.on("error", reject);
      stream.end(buffer);
    });
  } catch (cause) {
    throw new MaterialError("STORAGE_ERROR", "The document could not be stored. Please try again.", { cause });
  }
}

export async function deleteOriginal(storageId: string) {
  try {
    const result: unknown = await cloudinary.uploader.destroy(storageId, {
      resource_type: "raw", type: "authenticated", invalidate: true,
    });
    const parsed = z.object({ result: z.enum(["ok", "not found"]) }).safeParse(result);
    if (!parsed.success) throw new Error("Unexpected storage deletion result.");
  } catch (cause) {
    throw new MaterialError("STORAGE_ERROR", "The document could not be deleted. Please try again.", { cause });
  }
}

export function getSignedOriginalUrl(storageId: string) {
  // Raw public IDs retain their extension. The download API's format is empty
  // because appending it again would target a different raw asset.
  return cloudinary.utils.private_download_url(storageId, "", {
    resource_type: "raw",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 60,
    attachment: true,
  });
}
