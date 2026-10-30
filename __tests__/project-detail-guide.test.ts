// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ProjectDetailView } from "@/views/project-detail";
const f = vi.hoisted(() => ({ finalized: false }));
const round = `0x${"2".repeat(40)}`;
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: `0x${"2".repeat(40)}`, projectId: "1" }),
}));
vi.mock("@/hooks/useRound", () => ({
  useRound: () => ({
    roundAddress: `0x${"2".repeat(40)}`,
    status: f.finalized ? "finalized" : "open",
    finalized: f.finalized,
    isCancelled: false,
  }),
}));
vi.mock("@/hooks/useProjects", () => ({
  useProjects: () => ({
    projects: [
      {
        id: "1",
        contractId: 1n,
        name: "Fixture project",
        shortDescription: "Example",
        description: "Fixture only",
        category: "technology",
        contactUrl: "",
        ownerAddress: `0x${"1".repeat(40)}`,
        supporterCount: 2,
        totalDonated: 5,
        estimatedMatching: 7,
        finalMatching: 3,
        approved: true,
        status: "approved",
      },
    ],
    refetch: vi.fn(),
  }),
}));
vi.mock("@/components/common/AOSInit", () => ({ AOSInit: () => null }));
vi.mock("@/components/round/RoundCancellationPanel", () => ({
  RoundCancellationPanel: () => null,
}));
vi.mock("@/components/project/ProjectProfilePanel", () => ({
  ProjectProfilePanel: () => null,
}));
vi.mock("@/components/project/ProjectClaimPanel", () => ({
  ProjectClaimPanel: () => createElement("div", { id: "claim" }, "Claim panel"),
}));
vi.mock("@/components/project/DonateBox", () => ({
  DonateBox: () => createElement("div", null, "Contribution panel"),
}));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ locale: "vi", t: copy.vi }) };
});
let host: HTMLDivElement, root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  f.finalized = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(ProjectDetailView)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("opens the mobile contribution region from the visible newcomer guide", async () => {
  const trigger = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Mở hướng dẫn và đóng góp"),
  )!;
  expect(trigger).toBeDefined();
  expect(host.querySelector("#mobile-contribution-panel")).toBeNull();
  await act(async () => trigger.click());
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(
    host.querySelector("#mobile-contribution-panel")?.textContent,
  ).toContain("Contribution panel");
});
it("replaces the mobile contribution action with the correct claim destination after finalization", async () => {
  f.finalized = true;
  await act(async () => root.render(createElement(ProjectDetailView)));
  expect(host.querySelector('a[href="#claim"]')?.textContent).toBe(
    "Trạng thái nhận tiền",
  );
  expect(host.querySelector("#mobile-contribution-panel")).toBeNull();
  expect(
    [...host.querySelectorAll("button")].some((b) =>
      b.textContent?.includes("Mở hướng dẫn và đóng góp"),
    ),
  ).toBe(false);
  expect(
    host.querySelector('a[href="#claim"]')!.getAttribute("href"),
  ).not.toContain(round);
});

vi.mock("@/hooks/useRoundGovernance", () => ({ useRoundGovernance: () => ({ data: [], isLoading: false, isError: false }), usePublishGovernance: () => vi.fn() }));
vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: false }) }));
