import "server-only";
import sharp from "sharp";
import { imageMatchesMime } from "@/lib/uploadPermit";
import { VerificationError } from "@/lib/verify/errors";

const MAX_PIXELS = 16_000_000;
const MAX_DIMENSION = 8192;
const formats: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
};

/** Validate decoded content, not just the MIME header or a recognizable file prefix. */
export async function validateUploadImage(
  bytes: Uint8Array,
  mime: string,
): Promise<void> {
  const invalid = () => new VerificationError("UPLOAD_INVALID_FILE", 400);
  if (!formats[mime] || !imageMatchesMime(bytes, mime)) throw invalid();
  try {
    const image = sharp(bytes, {
      limitInputPixels: MAX_PIXELS,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== formats[mime] ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > MAX_DIMENSION ||
      metadata.height > MAX_DIMENSION ||
      metadata.width * metadata.height > MAX_PIXELS ||
      (metadata.pages ?? 1) !== 1
    )
      throw invalid();
    // metadata() alone accepts some truncated images. stats() forces a full decode.
    await image.stats();
  } catch {
    throw invalid();
  }
}
