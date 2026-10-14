import { describe, expect, it } from "vitest";
import { matchesNavRoute } from "../src/lib/navigation";

describe("header route matching", () => {
  it("only selects Home at the root", () => {
    expect(matchesNavRoute("/", "/")).toBe(true);
    expect(matchesNavRoute("/round/1", "/")).toBe(false);
  });
  it("selects nested routes without matching unrelated prefixes", () => {
    expect(matchesNavRoute("/my", "/my")).toBe(true);
    expect(matchesNavRoute("/my/projects", "/my")).toBe(true);
    expect(matchesNavRoute("/my-other", "/my")).toBe(false);
    expect(matchesNavRoute("/round/1", "/round")).toBe(true);
  });
});
