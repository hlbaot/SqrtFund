import { describe, expect, it } from "vitest";
import { copy } from "../src/lib/copy";

function getAllKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.keys(obj).flatMap((key) => {
    const val = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      return getAllKeys(val as Record<string, unknown>, path);
    }
    return [path];
  });
}

describe("copy key parity", () => {
  it("en and vi have identical translation keys", () => {
    const enKeys = getAllKeys(copy.en).sort();
    const viKeys = getAllKeys(copy.vi).sort();

    const missingInVi = enKeys.filter((k) => !viKeys.includes(k));
    const missingInEn = viKeys.filter((k) => !enKeys.includes(k));

    expect(missingInVi).toEqual([]);
    expect(missingInEn).toEqual([]);
    expect(enKeys).toEqual(viKeys);
  });
});
