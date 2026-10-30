// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { SponsorInterest, sponsorContactUrl } from "@/components/project/SponsorInterest";
import type { Project } from "@/types";
vi.mock("@/lib/context/locale", () => ({ useLocale: () => ({ locale: "vi", t: { common: { close: "Đóng" } } }) }));
afterEach(() => vi.unstubAllGlobals());
it.each(["javascript:alert(1)", "data:text/html,hello", "https://user:pass@example.com", "", "/local"])("does not expose unsafe contact %s", value => {
  expect(sponsorContactUrl(value)).toBeUndefined();
});
it("opens an editable sponsorship message and reports clipboard failure honestly", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const writeText = vi.fn().mockRejectedValue(Error("denied"));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(SponsorInterest, {
      project: { id: "2", name: "Student kits", contactUrl: "https://example.com/contact" } as Project,
      roundAddress: `0x${"1".repeat(40)}`,
    })));
    await act(async () => host.querySelector("button")!.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Lời nhắn chưa được gửi");
    expect(dialog.querySelector("a")!.href).toBe("https://example.com/contact");
    expect(dialog.querySelector("textarea")!.value).toContain("/project/2");
    const copy = Array.from(dialog.querySelectorAll("button")).find(b => b.textContent === "Sao chép lời nhắn")!;
    await act(async () => copy.click());
    expect(dialog.textContent).toContain("Không sao chép được");
    expect(writeText).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
