import { beforeAll, beforeEach, afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { POST } from "@/app/api/upload/route";
import {
  UPLOAD_TTL_MS,
  MAX_UPLOAD_BYTES,
  uploadMessage,
  type UploadPermit,
} from "@/lib/uploadPermit";
const f = vi.hoisted(() => ({
  chain: vi.fn(),
  read: vi.fn(),
  quota: vi.fn(),
  provider: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("viem", async (original) => ({
  ...(await original<typeof import("viem")>()),
  createPublicClient: () => ({ getChainId: f.chain, readContract: f.read }),
}));
vi.mock("@/lib/verify/supabaseAdmin", () => ({
  supabaseAdmin: () => ({ rpc: f.quota }),
}));
const account = privateKeyToAccount(`0x${"17".repeat(32)}`);
const attacker = privateKeyToAccount(`0x${"18".repeat(32)}`);
const registry = `0x${"1".repeat(40)}`;
let bytes: Buffer;
beforeAll(async () => {
  bytes = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
});
function permit(): UploadPermit {
  const issuedAt = Date.now();
  return {
    wallet: account.address.toLowerCase(),
    origin: "https://sqrt.test",
    registry,
    chainId: 43113,
    digest: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
    mime: "image/png",
    issuedAt,
    expiresAt: issuedAt + UPLOAD_TTL_MS,
    nonce: "ab".repeat(16),
  };
}
async function token(p = permit(), signer = account) {
  return `Bearer ${Buffer.from(JSON.stringify({ ...p, signature: await signer.signMessage({ message: uploadMessage(p) }) })).toString("base64")}`;
}
async function req(auth?: string, data = bytes, mime = "image/png") {
  const form = new FormData();
  form.append(
    "file",
    new Blob([Uint8Array.from(data)], { type: mime }),
    "fixture.png",
  );
  return new Request("https://sqrt.test/api/upload", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: form,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", f.provider);
  vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", "43113");
  vi.stubEnv("NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS", registry);
  vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "fixture");
  vi.stubEnv("CLOUDINARY_API_KEY", "fixture");
  vi.stubEnv("CLOUDINARY_API_SECRET", "fixture-secret");
  f.chain.mockResolvedValue(43113);
  f.read.mockResolvedValue(true);
  f.quota.mockResolvedValue({ data: { status: "OK" }, error: null });
  f.provider.mockResolvedValue(
    new Response(
      JSON.stringify({
        secure_url:
          "https://res.cloudinary.com/fixture/image/upload/fixture.png",
      }),
      { status: 200 },
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function denied(r: Request, status: number) {
  expect((await POST(r)).status).toBe(status);
  expect(f.provider).not.toHaveBeenCalled();
}
it("anonymous requests do not parse bodies, read chain, reserve quota or call provider", async () => {
  const r = await req();
  const parse = vi.spyOn(r, "formData");
  await denied(r, 401);
  expect(parse).not.toHaveBeenCalled();
  expect(f.read).not.toHaveBeenCalled();
  expect(f.quota).not.toHaveBeenCalled();
});
it("rejects a real attacker signature targeting another wallet before chain/provider calls", async () => {
  await denied(await req(await token(permit(), attacker)), 401);
  expect(f.read).not.toHaveBeenCalled();
  expect(f.quota).not.toHaveBeenCalled();
});
it.each(["origin", "registry", "chainId", "expiresAt", "size", "mime"])(
  "rejects signed invalid %s without provider calls",
  async (field) => {
    const p = permit();
    Object.assign(p, {
      [field]: {
        origin: "https://evil.test",
        registry: `0x${"2".repeat(40)}`,
        chainId: 1,
        expiresAt: 0,
        size: MAX_UPLOAD_BYTES + 1,
        mime: "image/svg+xml",
      }[field],
    });
    await denied(await req(await token(p)), 401);
    expect(f.quota).not.toHaveBeenCalled();
  },
);
it("rejects a tampered digest", async () => {
  const p = permit();
  p.digest = "00".repeat(32);
  await denied(await req(await token(p)), 400);
  expect(f.quota).not.toHaveBeenCalled();
});
it("rejects a non-Student wallet", async () => {
  f.read.mockResolvedValue(false);
  await denied(await req(await token()), 403);
  expect(f.quota).not.toHaveBeenCalled();
});
it("fails closed on RPC failure", async () => {
  f.chain.mockRejectedValue(new Error("RPC failed"));
  await denied(await req(await token()), 503);
  expect(f.quota).not.toHaveBeenCalled();
});
it("rejects wrong RPC chain", async () => {
  f.chain.mockResolvedValue(1);
  await denied(await req(await token()), 503);
});
it("rejects MIME spoofing even with a valid signature for the spoofed file", async () => {
  const data = Buffer.alloc(bytes.length, 65);
  const p = permit();
  p.digest = createHash("sha256").update(data).digest("hex");
  await denied(await req(await token(p), data), 400);
  expect(f.quota).not.toHaveBeenCalled();
});
it("rejects an oversized Content-Length before quota/provider", async () => {
  const r = await req(await token());
  r.headers.set("content-length", String(MAX_UPLOAD_BYTES + 65537));
  await denied(r, 413);
  expect(f.quota).not.toHaveBeenCalled();
});
it("bounds streamed bodies without Content-Length", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_UPLOAD_BYTES + 65537));
      controller.close();
    },
  });
  const r = new Request("https://sqrt.test/api/upload", {
    method: "POST",
    headers: {
      Authorization: await token(),
      "Content-Type": "multipart/form-data; boundary=fixture",
    },
    body,
    duplex: "half",
  } as RequestInit);
  await denied(r, 413);
  expect(f.quota).not.toHaveBeenCalled();
});
it.each(["RATE_LIMITED", "REPLAY", "UNEXPECTED"])(
  "%s does not call provider",
  async (status) => {
    f.quota.mockResolvedValue({ data: { status, retryAfter: 3600 } });
    await denied(
      await req(await token()),
      status === "RATE_LIMITED" ? 429 : status === "REPLAY" ? 409 : 503,
    );
  },
);
it.each(["error", "throw", "empty"])(
  "quota %s fails closed without provider",
  async (mode) => {
    if (mode === "throw")
      f.quota.mockRejectedValue(new Error("DB unavailable"));
    else
      f.quota.mockResolvedValue(
        mode === "error" ? { error: { code: "PGRST202" } } : { data: null },
      );
    await denied(await req(await token()), 503);
  },
);
it("never falls back to an unsigned preset", async () => {
  vi.stubEnv("CLOUDINARY_API_SECRET", "");
  vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET", "public-fixture");
  await denied(await req(await token()), 503);
  expect(f.quota).not.toHaveBeenCalled();
});
it("uploads exactly once after ownership, eligibility, file and quota checks", async () => {
  const response = await POST(await req(await token()));
  expect(response.status).toBe(200);
  expect(f.provider).toHaveBeenCalledOnce();
  expect(f.quota).toHaveBeenCalledWith("reserve_project_upload", {
    p_wallet: account.address.toLowerCase(),
    p_nonce: "ab".repeat(16),
    p_bytes: bytes.length,
  });
  expect(f.quota.mock.invocationCallOrder[0]).toBeLessThan(
    f.provider.mock.invocationCallOrder[0],
  );
  const body = f.provider.mock.calls[0][1].body as FormData;
  expect(body.has("signature")).toBe(true);
  expect(body.has("upload_preset")).toBe(false);
});
it("sanitizes provider errors and does not retry or refund quota", async () => {
  f.provider.mockResolvedValue(
    new Response("private provider diagnostics", { status: 400 }),
  );
  const response = await POST(await req(await token()));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private");
  expect(f.provider).toHaveBeenCalledOnce();
  expect(f.quota).toHaveBeenCalledOnce();
});
it("rejects mismatched multipart type without provider", async () => {
  await denied(await req(await token(), bytes, "text/plain"), 400);
});
it("rejects a cross-origin request before any calls", async () => {
  const r = await req(await token());
  r.headers.set("Origin", "https://evil.test");
  await denied(r, 401);
  expect(f.read).not.toHaveBeenCalled();
});

it("rejects a signed fake PNG that has the correct magic bytes but cannot decode", async () => {
  const data = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const p = permit();
  p.size = data.length;
  p.digest = createHash("sha256").update(data).digest("hex");
  await denied(await req(await token(p), data), 400);
  expect(f.quota).not.toHaveBeenCalled();
});
it("rejects images exceeding decoded pixel limits before quota/provider", async () => {
  const data = await sharp({
    create: { width: 8193, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const p = permit();
  p.size = data.length;
  p.digest = createHash("sha256").update(data).digest("hex");
  await denied(await req(await token(p), data), 400);
  expect(f.quota).not.toHaveBeenCalled();
});

it("rejects truncated image data even when metadata can be read", async () => {
  const full = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const data = full.subarray(0, 64);
  expect((await sharp(data).metadata()).format).toBe("png");
  const p = permit();
  p.size = data.length;
  p.digest = createHash("sha256").update(data).digest("hex");
  await denied(await req(await token(p), data), 400);
  expect(f.quota).not.toHaveBeenCalled();
});
it.each(["jpeg", "webp"] as const)(
  "accepts a real decodable %s file",
  async (format) => {
    const data = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "white" },
    })
      .toFormat(format)
      .toBuffer();
    const p = permit();
    p.mime = `image/${format}`;
    p.size = data.length;
    p.digest = createHash("sha256").update(data).digest("hex");
    const response = await POST(await req(await token(p), data, p.mime));
    expect(response.status).toBe(200);
    expect(f.provider).toHaveBeenCalledOnce();
  },
);
