"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSignMessage } from "wagmi";
import type { Address } from "viem";
import {
  createUploadPermit,
  imageMatchesMime,
  MAX_UPLOAD_BYTES,
  UPLOAD_TYPES,
  uploadMessage,
} from "@/lib/uploadPermit";

interface UploadContext {
  scope: string;
  wallet?: Address;
  registry: Address;
  allowed: boolean;
  onUploaded: (url: string) => void;
}

/** Own the complete upload lifecycle, including work waiting for a wallet signature. */
export function useProjectImageUpload({
  scope,
  wallet,
  registry,
  allowed,
  onUploaded,
}: UploadContext) {
  const { signMessageAsync } = useSignMessage();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const submitting = useRef(false);
  const controller = useRef<AbortController | undefined>(undefined);

  const invalidate = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = undefined;
    submitting.current = false;
  }, []);
  const reset = useCallback(() => {
    invalidate();
    setIsUploading(false);
    setError(null);
  }, [invalidate]);
  useEffect(() => {
    reset();
    return invalidate;
  }, [scope, wallet, registry, allowed, reset, invalidate]);

  async function upload(file: File) {
    if (submitting.current) return;
    if (!allowed || !wallet) {
      setError("UPLOAD_FORBIDDEN");
      return;
    }
    if (file.size === 0) {
      setError("UPLOAD_INVALID_FILE");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("UPLOAD_TOO_LARGE");
      return;
    }
    const run = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    const active = () => generation.current === run && !abort.signal.aborted;
    submitting.current = true;
    setIsUploading(true);
    setError(null);
    try {
      // Some OS/browser file pickers leave MIME empty or use the image/jpg alias.
      if (!file.type || file.type === "image/jpg") {
        const prefix = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        if (!active()) return;
        const mime = UPLOAD_TYPES.find(type => imageMatchesMime(prefix, type));
        if (!mime) {
          setError("UPLOAD_INVALID_FILE");
          return;
        }
        file = new File([file], file.name, { type: mime, lastModified: file.lastModified });
      }
      if (!UPLOAD_TYPES.includes(file.type as (typeof UPLOAD_TYPES)[number])) {
        setError("UPLOAD_INVALID_FILE");
        return;
      }
      const permit = await createUploadPermit(file, wallet, registry);
      if (!active()) return;
      const signature = await signMessageAsync({
        account: wallet,
        message: uploadMessage(permit),
      });
      if (!active()) return;
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${btoa(JSON.stringify({ ...permit, signature }))}`,
        },
        body: form,
        signal: abort.signal,
      });
      // Infrastructure errors (e.g. a body-size rejection) may return plain text.
      const data = await response.json().catch(() => null);
      if (!active()) return;
      if (!response.ok) {
        setError(
          response.status === 413 ? "UPLOAD_TOO_LARGE"
            : typeof data?.error === "string" ? data.error : "UPLOAD_UNAVAILABLE",
        );
        return;
      }
      if (
        typeof data?.url !== "string" ||
        !data.url.startsWith("https://res.cloudinary.com/")
      ) {
        setError("UPLOAD_UNAVAILABLE");
        return;
      }
      onUploaded(data.url);
    } catch (cause) {
      if (active())
        setError(
          cause instanceof Error && /reject|denied|4001/i.test(cause.message)
            ? "WALLET_REJECTED"
            : "UPLOAD_UNAVAILABLE",
        );
    } finally {
      if (active()) {
        submitting.current = false;
        setIsUploading(false);
        controller.current = undefined;
      }
    }
  }
  return { upload, isUploading, error, reset };
}
