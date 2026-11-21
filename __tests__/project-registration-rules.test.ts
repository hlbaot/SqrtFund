// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { ProjectForm } from "@/components/project/ProjectForm";
import { RULES_VERSION } from "@/lib/roundGovernance";

const first = `0x${"1".repeat(40)}` as Address;
const second = `0x${"2".repeat(40)}` as Address;
const wallet = `0x${"3".repeat(40)}` as Address;
let selected: Address;
let loading: boolean;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: wallet, isConnected: true, chainId: 43113 }),
  usePublicClient: () => ({}),
  useWriteContract: () => ({}),
}));
vi.mock("@/hooks/useRound", () => ({
  useRound: (address: Address) => ({ roundAddress: address, admin: wallet, status: "open", projectCount: 0n }),
}));
vi.mock("@/hooks/useRegistrationRounds", () => ({
  useRegistrationRounds: () => ({
    roundAddress: selected,
    rounds: [{ address: first, number: 1, name: "First fund" }, { address: second, number: 2, name: "Second fund" }],
    isLoading: loading,
    selectRound: vi.fn(),
  }),
}));
vi.mock("@/hooks/useRoundGovernance", () => ({
  useRoundGovernance: (address: Address) => ({ data: address === first ? [{
    kind: "policy", created_at: "2026-11-21",
    payload: { kind: "policy", round: address, rulesVersion: RULES_VERSION, policy: { theme: "Robotics proposals", eligibility: "Students", funding: "Materials", criteria: "Clear plan" } },
  }] : [] }),
  usePublishGovernance: () => vi.fn(),
}));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isStudent: true, canParticipate: true }) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => vi.fn() }));
vi.mock("@/hooks/useProjectImageUpload", () => ({ useProjectImageUpload: () => ({}) }));
vi.mock("@/hooks/useFormDraft", () => ({ useFormDraft: (_key: string, values: object) => ({ values, ready: true }) }));
vi.mock("@/components/project/ProjectCard", () => ({ ProjectCard: () => null }));
vi.mock("@/components/verify/StudentAccessGate", () => ({ StudentAccessGate: () => null }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});

let root: Root;
let host: HTMLDivElement;
const dialog = () => document.querySelector('[role="dialog"]');
const render = () => act(async () => root.render(createElement(ProjectForm)));
const click = (text: string) => act(async () => {
  const button = [...document.querySelectorAll("button")].find(button => button.textContent === text);
  expect(button).toBeDefined();
  button!.click();
});

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  selected = first;
  loading = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("opens the selected round's rules as soon as the round is ready, and can reopen after continuing", async () => {
  loading = true;
  await render();
  expect(dialog()).toBeNull();

  loading = false;
  await render();
  expect(dialog()?.textContent).toContain("First fund");
  expect(dialog()?.textContent).toContain("Robotics proposals");
  expect(dialog()?.querySelector('[aria-label="Quy định chung"]')).not.toBeNull();
  expect(document.activeElement).toBe(dialog()?.querySelector("[data-autofocus]"));

  await click("Tiếp tục đăng ký");
  expect(dialog()).toBeNull();
  expect(host.querySelector("form")).not.toBeNull();
  await click("Xem lại quy định");
  expect(dialog()?.textContent).toContain("Robotics proposals");
});

it("opens a new read-only popup when the selected round changes, even for its Organizer", async () => {
  await render();
  await click("Tiếp tục đăng ký");
  selected = second;
  await render();
  expect(dialog()?.textContent).toContain("Second fund");
  expect(dialog()?.textContent).toContain("Organizer chưa công bố");
  expect(dialog()?.querySelector("form")).toBeNull();
});
