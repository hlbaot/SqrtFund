import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ToastItem } from "@/lib/txToast";
import { ToastContainer } from "@/components/ui/Toast";
const f = vi.hoisted(() => ({ toasts: [] as ToastItem[] }));
vi.mock("react-dom", () => ({ createPortal: (children: ReactNode) => children }));
vi.mock("@/lib/context/toast", () => ({ useToast: () => ({ toasts: f.toasts, removeToast: vi.fn() }) }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi }) };
});
beforeEach(() => vi.stubGlobal("document", { body: {} }));
afterEach(() => vi.unstubAllGlobals());
it.each([{}, { hash: "0x123" }, 123, true, "invalid", "0x123"])("renders a toast without crashing for malformed transaction data: %j", txHash => {
  f.toasts = [{ id: "grant", type: "pending", title: "Cấp quyền Organizer", txHash: txHash as unknown as string }];
  const html = renderToStaticMarkup(createElement(ToastContainer));
  expect(html).toContain("Cấp quyền Organizer");
  expect(html).not.toContain("Snowtrace:");
});
it("renders a valid transaction link and preserves the confirmation message", () => {
  const hash = `0x${"a".repeat(64)}`;
  f.toasts = [{ id: "grant", type: "success", title: "Đã cấp quyền", txHash: hash }];
  const html = renderToStaticMarkup(createElement(ToastContainer));
  expect(html).toContain("Đã cấp quyền");
  expect(html).toContain(`/tx/${hash}`);
  expect(html).toContain("Snowtrace:");
});
