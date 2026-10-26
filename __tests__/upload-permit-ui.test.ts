// @vitest-environment jsdom
import { webcrypto, createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import {
  createUploadPermit,
  uploadMessage,
  UPLOAD_TTL_MS,
} from "@/lib/uploadPermit";
afterEach(() => vi.unstubAllGlobals());
it("constructs an origin-bound permit for exactly the selected bytes and normalized wallet/registry", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const file = {
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    size: bytes.length,
    type: "image/png",
  } as File;
  const p = await createUploadPermit(
    file,
    `0x${"AB".repeat(20)}`,
    `0x${"CD".repeat(20)}`,
  );
  expect(p.digest).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(p.origin).toBe(window.location.origin);
  expect(p.wallet).toBe(`0x${"ab".repeat(20)}`);
  expect(p.registry).toBe(`0x${"cd".repeat(20)}`);
  expect(p.expiresAt - p.issuedAt).toBe(UPLOAD_TTL_MS);
  expect(p.nonce).toMatch(/^[a-f0-9]{32}$/);
  const next = await createUploadPermit(file, p.wallet, p.registry);
  expect(next.nonce).not.toBe(p.nonce);
  expect(uploadMessage(p)).toContain(`SHA-256: ${p.digest}`);
  expect(uploadMessage(p)).toContain("Upload project image");
  expect(uploadMessage(p)).toContain(`Bytes: ${bytes.length}`);
});
