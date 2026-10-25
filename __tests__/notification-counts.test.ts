import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { createNotificationSeenStore } from "@/lib/notifications";

const f = vi.hoisted(() => ({
  address: "0xabc", connected: true, chainId: 43113, ready: true,
  cancelled: true, finalized: false, refundReady: true, refund: 0n, projectsLoading: false,
  effects: [] as (() => void)[],
}));
let store: ReturnType<typeof createNotificationSeenStore>;
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => void) => { f.effects.push(effect); },
}));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: f.address, isConnected: f.connected, chainId: f.chainId }) }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ roundAddress: "0xround", projectCount: 1n, isCancelled: f.cancelled, finalized: f.finalized }) }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ projects: [], isLoading: f.projectsLoading, isError: false }) }));
vi.mock("@/hooks/useRoundNotifications", () => ({ useRoundNotifications: () => [] }));
vi.mock("@/hooks/useCurrentTimestamp", () => ({ useCurrentTimestamp: () => 0 }));
vi.mock("@/hooks/useRoundRefunds", () => ({ useRoundRefunds: vi.fn(() => ({ total: f.refund, isReady: f.refundReady })) }));
vi.mock("@/hooks/useNotificationSeen", () => ({ useNotificationSeen: (address?: string) => ({
  ...store.snapshot(address), ready: Boolean(address && f.ready),
  markSeen: (keys: string[]) => { if (address) store.markSeen(address, keys); },
}) }));
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { useRoundRefunds } from "@/hooks/useRoundRefunds";

beforeEach(() => {
  Object.assign(f, { address: "0xabc", connected: true, chainId: 43113, ready: true, cancelled: true, finalized: false, refundReady: true, refund: 0n, projectsLoading: false, effects: [] });
  const values = new Map<string, string>();
  store = createNotificationSeenStore(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } }));
  vi.clearAllMocks();
});
function render(markViewed = false) {
  let result: ReturnType<typeof useNotificationCounts> | undefined;
  function Probe() { result = useNotificationCounts("student", { markViewed }); return null; }
  renderToString(createElement(Probe));
  return result!;
}
const flushEffects = () => f.effects.splice(0).forEach(effect => effect());

it("regresses the cancelled/no-contribution phantom badge and reuses the existing refund reader", () => {
  expect(render().activity).toBe(0);
  expect(useRoundRefunds).toHaveBeenCalledWith("0xround", 1n, "0xabc", true);
  f.refund = 50n;
  expect(render().activity).toBe(1);
  f.refundReady = false;
  expect(render().activity).toBe(0);
});
it("acknowledges immediately on menu click for all hook consumers without removing the refund", () => {
  f.refund = 50n;
  const menu = render(), dot = render();
  expect(menu.activity).toBe(1); expect(dot.activity).toBe(1);
  menu.markAllSeen();
  expect(render().activity).toBe(0);
  expect(f.refund).toBe(50n);
});
it("acknowledges a direct /my visit and items that arrive after the page starts loading", () => {
  render(true); flushEffects();
  f.refund = 50n;
  render(true); flushEffects();
  expect(render().activity).toBe(0);
});
it("hides counts before seen hydration, on disconnect, and on the wrong chain", () => {
  f.refund = 50n; f.ready = false; expect(render().activity).toBe(0);
  f.ready = true; f.connected = false; expect(render().activity).toBe(0);
  f.connected = true; f.chainId = 1; expect(render().activity).toBe(0);
});
it("switches seen sets when the connected wallet changes", () => {
  f.refund = 50n;
  render().markAllSeen();
  f.address = "0xdef"; expect(render().activity).toBe(1);
  f.address = "0xABC"; expect(render().activity).toBe(0);
});
