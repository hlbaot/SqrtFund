import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { canViewProject, canRejectProject, isPublicProject, isPendingProject } from "@/lib/projectVisibility";
import { rankProjects, type LeaderboardProject } from "@/components/leaderboard/model";
import { RejectProjectButton } from "@/components/admin/RejectProjectButton";
import { getContractErrorMessage } from "@/lib/errors";
import { toFunctionSelector } from "viem";
import { copy } from "@/lib/copy";
const locale = vi.hoisted(() => ({ value: "vi" as "vi" | "en" }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: locale.value, t: copy[locale.value] }) }; });
const project = { approved: false, rejected: false, ownerAddress: "0xOwner" };
const round = { admin: "0xAdmin", finalized: false, isCancelled: false, supportsRejection: true };
it("rejected projects leave pending/public lists but remain visible to their owner and round admin", () => {
  const rejected = { ...project, rejected: true };
  expect([rejected].filter(isPublicProject)).toEqual([]);
  expect([rejected].filter(isPendingProject)).toEqual([]);
  expect(canViewProject(rejected)).toBe(false);
  expect(canViewProject(rejected, "0xOther", round.admin)).toBe(false);
  expect(canViewProject(rejected, "0xowner", round.admin)).toBe(true);
  expect(canViewProject(rejected, "0xadmin", round.admin)).toBe(true);
  expect(isPublicProject({ ...rejected, approved: true })).toBe(false);
});
it.each([
  ["round admin", {}, {}, "0xadmin", true],
  ["other admin/factory owner", {}, {}, "0xFactoryOwner", false],
  ["owner", {}, {}, "0xOwner", false],
  ["disconnected or wrong-chain viewer", {}, {}, undefined, false],
  ["approved", { approved: true }, {}, "0xAdmin", false],
  ["rejected", { rejected: true }, {}, "0xAdmin", false],
  ["finalized", {}, { finalized: true }, "0xAdmin", false],
  ["cancelled", {}, { isCancelled: true }, "0xAdmin", false],
] as const)("renders reject only in the allowed state: %s", (_, patch, roundPatch, viewer, expected) => {
  const p = { ...project, ...patch }; const r = { ...round, ...roundPatch };
  expect(canRejectProject(p, r, viewer)).toBe(expected);
  const html = renderToStaticMarkup(createElement(RejectProjectButton, { project: p, round: r, viewer, pending: false, onClick: vi.fn() }));
  expect(Boolean(html)).toBe(expected);
});
it.each(["vi", "en"] as const)("shows translated rejection and disables it while a transaction is pending (%s)", value => {
  locale.value = value;
  const html = renderToStaticMarkup(createElement(RejectProjectButton, { project, round, viewer: "0xAdmin", pending: true, onClick: vi.fn() }));
  expect(html).toContain(copy[value].rejection.action); expect(html).toMatch(/\sdisabled(?:=|\s|>)/);
  expect(copy[value].rejection.confirm.length).toBeGreaterThan(20);
});
it("rejected or pending projects never enter leaderboard rankings even when passed directly", () => {
  const base: LeaderboardProject = { id: "1", roundId: "r", name: "Good", description: "", shortDescription: "", category: "technology", contactUrl: "", ownerAddress: "0xOwner", supporterCount: 1, totalDonated: 1, estimatedMatching: 0, status: "approved" };
  const ranked = rankProjects([base, { ...base, id: "2", rejected: true, status: "rejected", supporterCount: 100 }, { ...base, id: "3", status: "pending", supporterCount: 10 }]);
  expect(ranked.map(p => p.id)).toEqual(["1"]);
});
it.each(["en", "vi"] as const)("decodes ProjectAlreadyRejected clearly in %s", lang => {
  expect(getContractErrorMessage({ data: toFunctionSelector("ProjectAlreadyRejected()") }, lang)).toContain(lang === "vi" ? "từ chối" : "rejected");
});

it("shows a disabled reject action with an explicit explanation for the old round", () => {
  const old = { ...round, supportsRejection: false };
  expect(canRejectProject(project, old, "0xAdmin")).toBe(false);
  const html = renderToStaticMarkup(createElement(RejectProjectButton, { project, round: old, viewer: "0xAdmin", pending: false, onClick: vi.fn() }));
  expect(html).toContain(copy[locale.value].rejection.action);
  expect(html).toContain(copy[locale.value].rejection.unavailable);
  expect(html).toMatch(/<button[^>]*\sdisabled(?:=|\s|>)/);
});
