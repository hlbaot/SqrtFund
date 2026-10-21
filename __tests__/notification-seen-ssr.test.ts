import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { useNotificationSeen } from "@/hooks/useNotificationSeen";
import { NotificationBadge } from "@/components/ui/NotificationBadge";
import { copy } from "@/lib/copy";

const locale = vi.hoisted(() => ({ value: "vi" as "vi" | "en" }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy[locale.value], locale: locale.value }) };
});
afterEach(() => vi.unstubAllGlobals());

it("never reads localStorage or exposes unread badges during SSR", () => {
  const readStorage = vi.fn(() => { throw new Error("storage read during render"); });
  vi.stubGlobal("window", Object.defineProperty({}, "localStorage", { get: readStorage }));
  function Probe() {
    const seen = useNotificationSeen("0xabc");
    return createElement("span", null, `${seen.ready}:${seen.keys.length}`);
  }
  expect(renderToString(createElement(Probe))).toBe("<span>false:0</span>");
  expect(readStorage).not.toHaveBeenCalled();
});

it.each(["vi", "en"] as const)("caps the visible badge at 9+ and exposes the full localized count in %s", value => {
  locale.value = value;
  expect(renderToString(createElement(NotificationBadge, { count: 0 }))).toBe("");
  const two = renderToString(createElement(NotificationBadge, { count: 2 }));
  expect(two).toContain(copy[value].wallet.newNotifications.replace("{count}", "2"));
  expect(two).toContain(">2</span>");
  const many = renderToString(createElement(NotificationBadge, { count: 12 }));
  expect(many).toContain(">9+</span>");
  expect(many).toContain(copy[value].wallet.newNotifications.replace("{count}", "12"));
});
