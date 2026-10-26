// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMyOrganizerApplication, useOrganizerApplicationsAdmin } from "@/hooks/useOrganizerApplications";
import { clearOrganizerReadAccess, organizerReadStore } from "@/lib/store/organizerReadStore";
import { organizerStore } from "@/lib/store/organizerStore";
import { ApiError } from "@/lib/api";

const f = vi.hoisted(() => ({ address: `0x${"1".repeat(40)}`, chainId: 43113, connected: true, admin: false, get: vi.fn(), sign: vi.fn() }));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: f.address, chainId: f.chainId, isConnected: f.connected }),
  useSignMessage: () => ({ signMessageAsync: f.sign }) }));
vi.mock("@/hooks/useVisiblePolling", () => ({ useVisiblePolling: () => false }));
vi.mock("@/lib/contracts/addresses", () => ({ factoryAddress: `0x${"f".repeat(40)}`, TARGET_CHAIN_ID: 43113 }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("@/lib/api")>(), api: { get: f.get } }));

let root: Root, host: HTMLDivElement, queries: QueryClient;
let mine: ReturnType<typeof useMyOrganizerApplication>;
let admin: ReturnType<typeof useOrganizerApplicationsAdmin>;
const alice = `0x${"1".repeat(40)}`, bob = `0x${"2".repeat(40)}`;
const application = (wallet: string) => ({ id: wallet, walletAddress: wallet, organizationName: "Synthetic Club",
  contactEmail: wallet === alice ? "alice@example.invalid" : "bob@example.invalid", reason: "Synthetic application", status: "pending",
  createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z" });
function Probe() {
  const myResult = useMyOrganizerApplication(f.connected ? f.address : undefined);
  const adminResult = useOrganizerApplicationsAdmin("all", f.admin);
  useEffect(() => { mine = myResult; admin = adminResult; });
  return createElement("div", null, myResult.application?.contactEmail ?? "locked", "|", adminResult.applications.map(a => a.contactEmail).join(","));
}
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); }); }
async function render() {
  await act(async () => root.render(createElement(QueryClientProvider, { client: queries }, createElement(Probe))));
  await settle();
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  Object.assign(f, { address: alice, chainId: 43113, connected: true, admin: false });
  clearOrganizerReadAccess();
  queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  f.sign.mockResolvedValue(`0x${"a".repeat(130)}`);
  f.get.mockImplementation(async (_url, options) => ({ data: { ok: true,
    applications: options.params?.walletAddress ? [application(options.params.walletAddress)] : [application(alice), application(bob)] } }));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); queries.clear(); clearOrganizerReadAccess(); vi.unstubAllGlobals();
});

it("does not read private data or request signatures automatically; a signed user can read their own application", async () => {
  expect(f.get).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
  expect(mine.readAccess.needsAuth).toBe(true);
  await act(async () => mine.readAccess.authorize()); await settle();
  expect(host.textContent).toContain("alice@example.invalid");
  expect(f.get).toHaveBeenCalledWith("/api/organizer-applications", expect.objectContaining({
    params: { walletAddress: alice }, headers: { Authorization: expect.stringMatching(/^Bearer /) }, signal: expect.anything(),
  }));
  expect(f.sign).toHaveBeenCalledOnce();
  await act(async () => { await queries.invalidateQueries(); }); await settle();
  expect(f.sign).toHaveBeenCalledOnce();
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  expect(JSON.stringify(queries.getQueryCache().getAll().map(q => q.queryKey))).not.toContain("a".repeat(130));
});
it("loads the admin queue after verification without exposing it before verification", async () => {
  f.admin = true; await render();
  expect(admin.applications).toEqual([]); expect(f.get).not.toHaveBeenCalled();
  await act(async () => admin.readAccess.authorize()); await settle();
  expect(admin.applications).toHaveLength(2);
  expect(host.textContent).toContain("bob@example.invalid");
});
it("clears credentials and private data when changing wallets", async () => {
  await act(async () => mine.readAccess.authorize()); await settle();
  expect(mine.application?.walletAddress).toBe(alice);
  f.address = bob; await render();
  expect(mine.application).toBeNull(); expect(organizerReadStore.getState().credential).toBeUndefined();
  expect(Object.values(organizerStore.getState().entities)).toHaveLength(0);
  expect(host.textContent).not.toContain("alice@example.invalid");
  const cached = queries.getQueryCache().getAll().map(query => query.state.data);
  expect(JSON.stringify(cached)).not.toContain("alice@example.invalid");
});
it("clears access on disconnect and does not use a wrong-chain wallet", async () => {
  await act(async () => mine.readAccess.authorize()); await settle();
  f.connected = false; await render();
  expect(mine.application).toBeNull(); expect(organizerReadStore.getState().credential).toBeUndefined();
  f.connected = true; f.chainId = 1; f.get.mockClear(); await render();
  await act(async () => mine.readAccess.authorize());
  expect(mine.readAccess.canSign).toBe(false); expect(f.get).not.toHaveBeenCalled();
});
it("does not restore access when a signature completes after an account change", async () => {
  let finish!: (signature: `0x${string}`) => void;
  f.sign.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  let signing!: Promise<void>;
  await act(async () => { signing = mine.readAccess.authorize(); });
  f.address = bob; await render();
  await act(async () => { finish(`0x${"b".repeat(130)}`); await signing; });
  expect(organizerReadStore.getState().credential).toBeUndefined(); expect(f.get).not.toHaveBeenCalled();
});
it("keeps access locked after a rejected signature and allows retry", async () => {
  f.sign.mockRejectedValueOnce(new Error("User rejected"));
  await act(async () => mine.readAccess.authorize()); await settle();
  expect(mine.readAccess.error).toBe("ORGANIZER_READ_SIGN_FAILED"); expect(f.get).not.toHaveBeenCalled();
  await act(async () => mine.readAccess.authorize()); await settle();
  expect(mine.application?.walletAddress).toBe(alice);
});
it("hides private data on credential expiration", async () => {
  await act(async () => mine.readAccess.authorize()); await settle();
  await act(async () => {
    const credential = organizerReadStore.getState().credential!;
    organizerReadStore.setState({ credential: { ...credential, expiresAt: Date.now() + 10 } });
  });
  await settle();
  expect(mine.application).toBeNull(); expect(mine.readAccess.needsAuth).toBe(true);
  expect(host.textContent).not.toContain("alice@example.invalid");
});
it("drops a server-rejected credential instead of repeatedly reading with it", async () => {
  f.get.mockRejectedValue(new ApiError("ORGANIZER_READ_AUTH_INVALID"));
  await act(async () => mine.readAccess.authorize()); await settle();
  expect(mine.application).toBeNull(); expect(mine.readAccess.needsAuth).toBe(true);
  expect(organizerReadStore.getState().credential).toBeUndefined();
});

it("does not revive an old signature after switching A to B and back to A", async () => {
  let finish!: (signature: `0x${string}`) => void;
  f.sign.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  let signing!: Promise<void>;
  await act(async () => { signing = mine.readAccess.authorize(); });
  f.address = bob; await render();
  f.address = alice; await render();
  await act(async () => { finish(`0x${"b".repeat(130)}`); await signing; });
  expect(organizerReadStore.getState().credential).toBeUndefined(); expect(f.get).not.toHaveBeenCalled();
});
