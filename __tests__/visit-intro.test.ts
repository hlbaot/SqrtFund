import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { markVisitIntroSeen, VISIT_INTRO_BOOTSTRAP, VISIT_INTRO_SEEN_KEY } from "../src/lib/visitIntro";

beforeEach(() => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("window", { sessionStorage: storage });
  vi.stubGlobal("document", { documentElement: { classList: { add: vi.fn() } } });
});
afterEach(() => { vi.unstubAllGlobals(); });

it("shows the intro on the first visit before hydration, once per tab session", () => {
  new Function(VISIT_INTRO_BOOTSTRAP)();
  expect(document.documentElement.classList.add).toHaveBeenCalledWith("splash-active");
  expect(sessionStorage.getItem(VISIT_INTRO_SEEN_KEY)).toBe("1");
  vi.mocked(document.documentElement.classList.add).mockClear();
  new Function(VISIT_INTRO_BOOTSTRAP)();
  expect(document.documentElement.classList.add).not.toHaveBeenCalled();
});

it("does not show an intro after wallet connect or logout navigation", () => {
  markVisitIntroSeen();
  new Function(VISIT_INTRO_BOOTSTRAP)();
  expect(document.documentElement.classList.add).not.toHaveBeenCalled();
});

it("still shows the entry intro if session storage is unavailable", () => {
  vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("Storage disabled"); } });
  expect(() => new Function(VISIT_INTRO_BOOTSTRAP)()).not.toThrow();
  expect(document.documentElement.classList.add).toHaveBeenCalledWith("splash-active");
});
