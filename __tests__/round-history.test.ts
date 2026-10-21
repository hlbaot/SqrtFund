import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { RoundHistory } from "@/components/admin/RoundHistory";

const state = vi.hoisted(() => ({
  data: [] as { status: string; result?: unknown }[],
  isError: false,
  locale: "vi" as "vi" | "en",
  read: vi.fn(),
}));
vi.mock("wagmi", () => ({ useReadContracts: (args: unknown) => { state.read(args); return state; } }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy[state.locale] }) };
});
const addresses: Address[] = ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333"];
const render = (selected = addresses[1], disabled = false) => renderToStaticMarkup(createElement(RoundHistory, {
  addresses, selected, disabled, onSelect: vi.fn(),
}));
const optionLabels = (html: string) => [...html.matchAll(/<option[^>]*>(.*?)<\/option>/g)].map(match => match[1]);
beforeEach(() => {
  state.locale = "vi"; state.isError = false; state.read.mockClear();
  state.data = ["First round", "Second round", "Third round"].map(result => ({ status: "success", result }));
});
it("loads every round name and shows newest first, regardless of which is selected", () => {
  expect(optionLabels(render())).toEqual(["Vòng 3 · Third round", "Vòng 2 · Second round", "Vòng 1 · First round"]);
  expect(optionLabels(render(addresses[0]))).toEqual(optionLabels(render()));
  expect(state.read).toHaveBeenCalledWith(expect.objectContaining({ contracts: addresses.map(address => expect.objectContaining({ address, functionName: "name" })) }));
});
it("keeps readable stable numbers for unnamed legacy rounds and failed name reads", () => {
  state.data = [{ status: "success", result: "   " }, { status: "failure" }, { status: "success", result: "Third round" }];
  const html = render();
  expect(optionLabels(html)).toEqual(["Vòng 3 · Third round", "Vòng 2", "Vòng 1"]);
  expect(optionLabels(html).join(" ")).not.toContain("0x");
  expect(html).toContain("Thử lại");
});
it("keeps selection disabled during a pending round action", () => {
  expect(render(addresses[1], true)).toMatch(/<select[^>]*disabled=""/);
});
it("localizes round numbering and handles an empty history", () => {
  state.locale = "en";
  expect(optionLabels(render())[0]).toBe("Round 3 · Third round");
  const html = renderToStaticMarkup(createElement(RoundHistory, { addresses: [], onSelect: vi.fn() }));
  expect(html).toContain("No round yet");
  expect(html).toMatch(/<select[^>]*disabled=""/);
});
