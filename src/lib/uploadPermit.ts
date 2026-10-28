import { sha256 } from "viem";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const UPLOAD_TTL_MS = 5 * 60_000;
export const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type UploadPermit = {
  wallet: string;
  origin: string;
  registry: string;
  chainId: number;
  digest: string;
  size: number;
  mime: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};
export function uploadMessage(p: UploadPermit) {
  return [
    "SqrtFund: Upload project image",
    "Authorize one upload of this exact image, subject to server quota. No transaction or funds transfer.",
    `Wallet: ${p.wallet}`,
    `Origin: ${p.origin}`,
    `Registry: ${p.registry}`,
    `Chain ID: ${p.chainId}`,
    `SHA-256: ${p.digest}`,
    `Bytes: ${p.size}`,
    `MIME: ${p.mime}`,
    `Issued at: ${p.issuedAt}`,
    `Expires at: ${p.expiresAt}`,
    `Nonce: ${p.nonce}`,
  ].join("\n");
}
export function imageMatchesMime(bytes: Uint8Array, mime: string) {
  if (mime === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (mime === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp")
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}

/** Browser event handler helper; no credential is persisted. */
export async function createUploadPermit(
  file: File,
  wallet: string,
  registry: string,
): Promise<UploadPermit> {
  const issuedAt = Date.now();
  // subtle is unavailable on HTTP LAN development origins; viem hashes the same bytes.
  const digest = sha256(new Uint8Array(await file.arrayBuffer())).slice(2);
  return {
    wallet: wallet.toLowerCase(),
    origin: window.location.origin,
    registry: registry.toLowerCase(),
    chainId: 43113,
    digest,
    size: file.size,
    mime: file.type,
    issuedAt,
    expiresAt: issuedAt + UPLOAD_TTL_MS,
    nonce: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
