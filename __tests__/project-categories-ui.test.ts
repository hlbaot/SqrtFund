// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ProjectCategoryPanel } from "@/components/project/ProjectCategoryPanel";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import type { Project } from "@/types";
import type { GovernanceRecord } from "@/lib/roundGovernance";
import type { RankedProject } from "@/components/leaderboard/model";
const f = vi.hoisted(() => ({ records: [] as GovernanceRecord[], owner: true, error: false, publish: vi.fn(), refetch: vi.fn() }));
const round = `0x${"1".repeat(40)}` as const, wallet = `0x${"2".repeat(40)}`;
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: "vi", t: copy.vi }) }; });
vi.mock("wagmi", () => ({ useAccount: () => ({ address: wallet, isConnected: f.owner, chainId: 43113 }) }));
vi.mock("@/hooks/useRoundGovernance", () => ({ useRoundGovernance: () => ({ data: f.records, isError: f.error, refetch: f.refetch }), usePublishGovernance: () => f.publish }));
vi.mock("@/components/leaderboard/Podium", () => ({ Podium: ({ projects }: { projects: RankedProject[] }) => createElement("div", { "data-testid": "podium" }, projects.map(p => p.name).join(", ")) }));
let host: HTMLDivElement, root: Root;
const project = { id: "1", name: "Robotics", ownerAddress: wallet, category: "uncategorized", contactUrl: "", description: "Prototype", shortDescription: "Prototype", supporterCount: 3, totalDonated: 2, estimatedMatching: 4, status: "pending", roundId: round } as Project;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); Object.assign(f, { records: [], owner: true, error: false }); vi.clearAllMocks(); f.publish.mockResolvedValue({ id: 1 }); vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} })); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const renderCategory = () => act(async () => root.render(createElement(ProjectCategoryPanel, { project, roundAddress: round })));
it("offers five meaningful primary categories only to the owner and retains input after failed save", async () => {
  await renderCategory();
  expect(host.querySelectorAll("option")).toHaveLength(6);
  expect(host.textContent).toContain("Cộng đồng và thiện nguyện");
  const select = host.querySelector("select")!;
  await act(async () => { select.value = "community"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.textContent).toContain("minh chứng hỗ trợ");
  f.publish.mockRejectedValueOnce(Error("DB down"));
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(f.publish).toHaveBeenCalledWith(expect.objectContaining({ kind: "category", projectId: "1", category: "community" }));
  expect(host.textContent).toContain("Chưa lưu được lĩnh vực");
  expect(host.querySelector("select")!.value).toBe("community");
  f.owner = false; await renderCategory(); expect(host.querySelector("form")).toBeNull();
});
it("only offers categories allowed by a themed round", async () => {
  f.records = [{ id: 1, kind: "policy", owner_address: wallet, transaction_hash: null, created_at: "2026-10-30", payload: { kind: "policy", round, rulesVersion: "2026-10-30", policy: { theme: "Green", eligibility: "Students", funding: "Materials", criteria: "Measurable impact", categories: ["environment"] } } }];
  await renderCategory();
  expect(Array.from(host.querySelectorAll("option")).map(o => o.value)).toEqual(["", "environment"]);
});
it("uses a saved category after reload and never presents a database error as missing classification", async () => {
  f.records = [{ id: 2, kind: "category", owner_address: wallet, transaction_hash: null, created_at: "2026-10-30", payload: { kind: "category", round, rulesVersion: "2026-10-30", projectId: "1", category: "arts" } }];
  await renderCategory(); expect(host.textContent).toContain("Văn hóa và nghệ thuật"); expect(host.querySelector("form")).toBeNull();
  f.error = true; await renderCategory(); expect(host.textContent).toContain("Chưa đọc được lĩnh vực đã lưu"); expect(host.textContent).not.toContain("Chưa phân loại.");
});
it("filters both the project list and podium while keeping round-wide rank", async () => {
  const projects = [{ ...project, status: "approved" as const, category: "technology" as const }, { ...project, status: "approved" as const, id: "2", name: "Community kits", category: "community" as const, supporterCount: 1 }];
  await act(async () => root.render(createElement(Leaderboard, { projects, roundId: round, pool: 10, finalized: false, canDonate: false })));
  const filter = host.querySelector("select")!;
  await act(async () => { filter.value = "community"; filter.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.querySelector('[data-testid="podium"]')!.textContent).toBe("Community kits");
  expect(host.querySelector("tbody")!.textContent).toContain("Community kits");
  expect(host.querySelector("tbody")!.textContent).not.toContain("Robotics");
  expect(host.querySelector("tbody")!.textContent).toContain("#2");
  expect(projects[0].estimatedMatching).toBe(4);
});
