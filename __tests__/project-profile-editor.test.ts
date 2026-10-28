// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectProfilePanel } from "@/components/project/ProjectProfilePanel";
const f = vi.hoisted(() => ({
  wallet: `0x${"1".repeat(40)}`,
  sign: vi.fn(),
  fetch: vi.fn(),
  toast: vi.fn(),
  refetch: vi.fn(),
  error: false,
}));
const doc = {
  profile: {
    leadName: "Team lead",
    goal: "Deliver kits",
    budgetUsdc: "12.5",
    budgetPlan: "10 for materials, 2.5 for transport",
    milestones: "Ten kits delivered",
  },
  revision: 1,
  reports: [],
  updated_at: "2026-10-28T00:00:00Z",
};
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: f.wallet, isConnected: true, chainId: 43113 }),
  useSignMessage: () => ({ signMessageAsync: f.sign }),
}));
vi.mock("@/lib/context/locale", () => ({
  useLocale: () => ({ locale: "vi" }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: doc, isError: f.error, refetch: f.refetch }),
  useQueryClient: () => ({ invalidateQueries: f.refetch }),
}));
vi.mock("@/hooks/useTxFlow", () => ({
  useTxFlow: () => () => ({
    wait: async (fn: () => unknown) => await fn(),
    toast: { success: f.toast },
    finish: vi.fn(),
    cancelled: false,
  }),
}));
const project = {
  id: "1",
  name: "Project",
  roundId: "round",
  category: "technology" as const,
  shortDescription: "",
  description: "",
  contactUrl: "",
  ownerAddress: `0x${"1".repeat(40)}`,
  totalDonated: 5,
  estimatedMatching: 10,
  supporterCount: 2,
  status: "approved" as const,
  claimed: false,
};
let host: HTMLDivElement, root: Root;
const render = () =>
  act(async () =>
    root.render(
      createElement(ProjectProfilePanel, {
        project,
        roundAddress: `0x${"2".repeat(40)}`,
      }),
    ),
  );
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  f.wallet = project.ownerAddress;
  f.error = false;
  f.sign.mockResolvedValue(`0x${"a".repeat(130)}`);
  f.fetch.mockResolvedValue(
    new Response(JSON.stringify({ code: "PROFILE_UNAVAILABLE" }), {
      status: 503,
    }),
  );
  vi.stubGlobal("fetch", f.fetch);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("keeps owner inputs and reports no success after a failed database save", async () => {
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(f.sign).toHaveBeenCalledOnce();
  expect(f.fetch).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("Chưa lưu được hồ sơ");
  expect(f.toast).not.toHaveBeenCalled();
  expect([...host.querySelectorAll("input")].map((i) => i.value)).toEqual([
    "Team lead",
    "12.5",
  ]);
  const body = JSON.parse(f.fetch.mock.calls[0][1].body);
  expect(body.revision).toBe(1);
  expect(body.report).toBeNull();
});
it("shows saved public content but removes editing when another wallet is connected", async () => {
  f.wallet = `0x${"3".repeat(40)}`;
  await render();
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).toContain("Deliver kits");
});
it("does not offer editing or invent an empty saved proposal after read failure", async () => {
  f.error = true;
  await render();
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).toContain("Chưa đọc được hồ sơ đã lưu");
  expect(f.sign).not.toHaveBeenCalled();
});
