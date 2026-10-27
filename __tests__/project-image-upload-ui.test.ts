// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useProjectImageUpload } from "@/hooks/useProjectImageUpload";
const f = vi.hoisted(() => ({
  sign: vi.fn(),
  fetch: vi.fn(),
  uploaded: vi.fn(),
  permit: vi.fn(),
}));
vi.mock("wagmi", () => ({
  useSignMessage: () => ({ signMessageAsync: f.sign }),
}));
vi.mock("@/lib/uploadPermit", async (original) => ({
  ...(await original<typeof import("@/lib/uploadPermit")>()),
  createUploadPermit: f.permit,
}));
const wallet = `0x${"1".repeat(40)}` as const;
const registry = `0x${"2".repeat(40)}` as const;
const file = new File(["fixture"], "fixture.png", { type: "image/png" });
let root: Root, state: ReturnType<typeof useProjectImageUpload>;
function Probe({
  scope = "alice-round1",
  allowed = true,
  walletAddress = wallet,
  registryAddress = registry,
}: {
  scope?: string;
  allowed?: boolean;
  walletAddress?: `0x${string}`;
  registryAddress?: `0x${string}`;
}) {
  const result = useProjectImageUpload({
    scope,
    allowed,
    wallet: walletAddress,
    registry: registryAddress,
    onUploaded: f.uploaded,
  });
  useEffect(() => {
    state = result;
  });
  return null;
}
async function render(
  scope?: string,
  allowed?: boolean,
  walletAddress?: `0x${string}`,
  registryAddress?: `0x${string}`,
) {
  await act(async () =>
    root.render(
      createElement(Probe, { scope, allowed, walletAddress, registryAddress }),
    ),
  );
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  vi.stubGlobal("fetch", f.fetch);
  f.sign.mockResolvedValue(`0x${"a".repeat(130)}`);
  f.permit.mockResolvedValue({
    wallet,
    registry,
    origin: "https://sqrt.test",
    chainId: 43113,
    digest: "a".repeat(64),
    size: 7,
    mime: "image/png",
    issuedAt: 0,
    expiresAt: 300000,
    nonce: "a".repeat(32),
  });
  f.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ url: "https://res.cloudinary.com/fixture/image.png" }),
  });
  root = createRoot(document.createElement("div"));
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
it("signs the selected file before sending a single authenticated request", async () => {
  expect(f.sign).not.toHaveBeenCalled();
  expect(f.fetch).not.toHaveBeenCalled();
  await act(async () => state.upload(file));
  expect(f.fetch).toHaveBeenCalledOnce();
  expect(f.sign).toHaveBeenCalledOnce();
  expect(f.fetch.mock.calls[0][1].headers.Authorization).toMatch(/^Bearer /);
  expect(f.uploaded).toHaveBeenCalledWith(
    "https://res.cloudinary.com/fixture/image.png",
  );
});
it("does not request a signature or upload for an ineligible identity", async () => {
  await render(undefined, false);
  await act(async () => state.upload(file));
  expect(f.sign).not.toHaveBeenCalled();
  expect(f.fetch).not.toHaveBeenCalled();
});
it("does not upload when the signature was rejected", async () => {
  f.sign.mockRejectedValueOnce(new Error("User rejected"));
  await act(async () => state.upload(file));
  expect(state.error).toBe("WALLET_REJECTED");
  expect(f.fetch).not.toHaveBeenCalled();
});
it("does not send a signature completed after wallet/round changes, including returning to the old scope", async () => {
  let finish!: (signature: string) => void;
  f.sign.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = state.upload(file);
  });
  await render("bob-round2");
  await render("alice-round1");
  await act(async () => {
    finish(`0x${"a".repeat(130)}`);
    await pending;
  });
  expect(f.fetch).not.toHaveBeenCalled();
  expect(f.uploaded).not.toHaveBeenCalled();
});
it("aborts an in-flight request and ignores late responses when scope changes", async () => {
  let finish!: (response: unknown) => void;
  f.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = state.upload(file);
  });
  const signal = f.fetch.mock.calls[0][1].signal as AbortSignal;
  await render("bob-round2");
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish({
      ok: true,
      json: async () => ({ url: "https://res.cloudinary.com/fixture/old.png" }),
    });
    await pending;
  });
  expect(f.uploaded).not.toHaveBeenCalled();
  expect(state.isUploading).toBe(false);
});
it("does not submit two concurrent uploads from repeated clicks", async () => {
  let finish!: (signature: string) => void;
  f.sign.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = state.upload(file);
  });
  await act(async () => state.upload(file));
  await act(async () => {
    finish(`0x${"a".repeat(130)}`);
    await pending;
  });
  expect(f.sign).toHaveBeenCalledOnce();
  expect(f.fetch).toHaveBeenCalledOnce();
});
it("reset cancels a pending signature so removing the image cannot restore it later", async () => {
  let finish!: (signature: string) => void;
  f.sign.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = state.upload(file);
  });
  await act(async () => state.reset());
  await act(async () => {
    finish(`0x${"a".repeat(130)}`);
    await pending;
  });
  expect(f.fetch).not.toHaveBeenCalled();
  expect(state.isUploading).toBe(false);
});

it.each(["wallet", "registry"])(
  "invalidates a pending signature when only %s changes without a new scope string",
  async (field) => {
    let finish!: (signature: string) => void;
    f.sign.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    let pending!: Promise<void>;
    await act(async () => {
      pending = state.upload(file);
    });
    await render(
      undefined,
      true,
      field === "wallet" ? `0x${"3".repeat(40)}` : wallet,
      field === "registry" ? `0x${"4".repeat(40)}` : registry,
    );
    await act(async () => {
      finish(`0x${"a".repeat(130)}`);
      await pending;
    });
    expect(f.fetch).not.toHaveBeenCalled();
    expect(f.uploaded).not.toHaveBeenCalled();
  },
);

it("does not sign when identity changes while the file digest is being calculated", async () => {
  let finish!: (permit: unknown) => void;
  f.permit.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = state.upload(file);
  });
  await render("bob-round2");
  await act(async () => {
    finish({});
    await pending;
  });
  expect(f.sign).not.toHaveBeenCalled();
  expect(f.fetch).not.toHaveBeenCalled();
  expect(f.uploaded).not.toHaveBeenCalled();
});
it("an old response cannot unlock a newer upload after a scope change", async () => {
  let finishOld!: (response: unknown) => void;
  let finishNew!: (signature: string) => void;
  f.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  let old!: Promise<void>;
  let next!: Promise<void>;
  await act(async () => {
    old = state.upload(file);
  });
  await render("bob-round2");
  f.sign.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishNew = resolve;
      }),
  );
  await act(async () => {
    next = state.upload(file);
  });
  await act(async () => {
    finishOld({
      ok: true,
      json: async () => ({ url: "https://res.cloudinary.com/fixture/old.png" }),
    });
    await old;
  });
  expect(state.isUploading).toBe(true);
  expect(f.uploaded).not.toHaveBeenCalled();
  await act(async () => state.upload(file));
  expect(f.sign).toHaveBeenCalledTimes(2);
  await act(async () => {
    finishNew(`0x${"a".repeat(130)}`);
    await next;
  });
  expect(f.uploaded).toHaveBeenCalledTimes(1);
  expect(state.isUploading).toBe(false);
});
