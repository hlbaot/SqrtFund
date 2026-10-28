import "server-only";
import { VerificationError } from "@/lib/verify/errors";

/** Accept Cloudinary's standard URL as well as separately configured credentials. */
export function cloudinaryConfig() {
  let cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  let apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  let secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if ((!cloudName || !apiKey || !secret) && process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL.trim());
      if (url.protocol !== "cloudinary:" || url.port || (url.pathname && url.pathname !== "/")) throw new Error();
      cloudName ||= url.hostname;
      apiKey ||= decodeURIComponent(url.username);
      secret ||= decodeURIComponent(url.password);
    } catch {
      throw new VerificationError("UPLOAD_CONFIG_MISSING", 503, { missing: ["CLOUDINARY_URL"] });
    }
  }
  if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !secret) {
    const missing = [
      ...(!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName) ? ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"] : []),
      ...(!apiKey ? ["CLOUDINARY_API_KEY"] : []),
      ...(!secret ? ["CLOUDINARY_API_SECRET"] : []),
    ];
    throw new VerificationError("UPLOAD_CONFIG_MISSING", 503, { missing });
  }
  return { cloudName, apiKey, secret };
}
