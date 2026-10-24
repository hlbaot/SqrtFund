import { describe, expect, it, vi } from "vitest";
import { createFormDraftStore, formDraftKey } from "@/lib/formDrafts";

const defaults = { name: "", description: "", category: "technology", imageUrl: "" };
const key = formDraftKey("project", 43113, "factory", "wallet-a", "round-a")!;
function setup() {
  const data = new Map<string, string>();
  const storage = { getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }) };
  return { data, storage, store: createFormDraftStore(() => storage) };
}

describe("persistent form drafts", () => {
  it("saves the last keystroke immediately and restores all fields after leaving or reloading", () => {
    const { store, storage } = setup();
    store.hydrate(key, defaults);
    for (const [field, value] of Object.entries({ name: "Robotics", description: "Proposal", category: "education", imageUrl: "https://images.example/project.webp" })) store.setField(key, field, value);
    const restarted = createFormDraftStore(() => storage);
    restarted.hydrate(key, defaults);
    expect(restarted.snapshot(key)).toMatchObject({ ready: true, hasDraft: true,
      values: { name: "Robotics", description: "Proposal", category: "education", imageUrl: "https://images.example/project.webp" } });
  });
  it("does not overwrite an existing draft with empty defaults during hydration", () => {
    const { store, storage, data } = setup();
    data.set(key, JSON.stringify({ version: 1, values: { ...defaults, name: "Keep me" } }));
    store.hydrate(key, defaults);
    expect(store.snapshot(key)?.values.name).toBe("Keep me");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("isolates drafts by wallet, round, chain, factory and form", () => {
    const { store } = setup();
    const others = [formDraftKey("project", 43113, "factory", "wallet-b", "round-a"),
      formDraftKey("project", 43113, "factory", "wallet-a", "round-b"),
      formDraftKey("project", 1, "factory", "wallet-a", "round-a"),
      formDraftKey("project", 43113, "other-factory", "wallet-a", "round-a"),
      formDraftKey("round", 43113, "factory", "wallet-a")];
    store.hydrate(key, defaults); store.setField(key, "name", "Wallet A");
    for (const other of others) {
      store.hydrate(other!, defaults);
      expect(store.snapshot(other!)?.values.name).toBe("");
    }
    expect(store.snapshot(key)?.values.name).toBe("Wallet A");
    expect(formDraftKey("project", 43113, "factory", undefined, "round")).toBeUndefined();
    expect(formDraftKey("project", 43113, "factory", "wallet")).toBeUndefined();
    expect(formDraftKey("round", 43113, "FACTORY", "WALLET")).toBe(formDraftKey("round", 43113, "factory", "wallet"));
  });
  it("clears only the successfully submitted version and preserves edits made while a transaction was pending", () => {
    const { store, data } = setup();
    store.hydrate(key, defaults); store.setField(key, "name", "Submitted");
    const submitted = store.snapshot(key)!.values;
    store.setField(key, "description", "New edits after leaving the form");
    store.clear(key, defaults, submitted);
    expect(data.has(key)).toBe(true);
    expect(store.snapshot(key)?.values.description).toBe("New edits after leaving the form");
    store.clear(key, defaults, store.snapshot(key)!.values);
    expect(data.has(key)).toBe(false);
    expect(store.snapshot(key)).toMatchObject({ values: defaults, hasDraft: false });
  });
  it("does not delete another wallet's draft when an earlier transaction finishes", () => {
    const { store } = setup();
    const other = formDraftKey("project", 43113, "factory", "wallet-b", "round-a")!;
    store.hydrate(key, defaults); store.setField(key, "name", "A");
    store.hydrate(other, defaults); store.setField(other, "name", "B");
    store.clear(key, defaults, store.snapshot(key)!.values);
    expect(store.snapshot(other)?.values.name).toBe("B");
  });
  it("discard removes storage and does not recreate an empty draft on remount", () => {
    const { store, storage, data } = setup();
    store.hydrate(key, defaults); store.setField(key, "name", "Discard");
    store.clear(key, defaults); storage.setItem.mockClear();
    store.hydrate(key, defaults);
    expect(data.has(key)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.snapshot(key)?.hasDraft).toBe(false);
  });
  it("keeps round dates, matching cap and pool text exactly as entered", () => {
    const { store, storage } = setup();
    const roundKey = formDraftKey("round", 43113, "factory", "wallet")!;
    const fields = { roundName: "", organizer: "", startDateTime: "", endDateTime: "", maxMatchPercent: "30", initialPool: "" };
    const initial = { ...fields, startDateTime: "2026-11-01T10:00", endDateTime: "2026-11-08T10:00" };
    store.hydrate(roundKey, fields, () => initial);
    store.setField(roundKey, "initialPool", "200.000001");
    const restarted = createFormDraftStore(() => storage);
    restarted.hydrate(roundKey, fields, () => ({ ...initial, startDateTime: "2030-01-01T00:00" }));
    expect(restarted.snapshot(roundKey)?.values).toEqual({ ...initial, initialPool: "200.000001" });
  });
  it("handles corrupt, incompatible or oversized storage without crashing", () => {
    const { store, data } = setup();
    for (const raw of ["not-json", JSON.stringify({ version: 2, values: defaults }),
      JSON.stringify({ version: 1, values: { name: 123 } }), "x".repeat(100_001)]) {
      data.set(key, raw); store.hydrate(key, defaults);
      expect(store.snapshot(key)).toMatchObject({ ready: true, values: defaults, hasDraft: false });
    }
  });
  it("retains input in memory and reports storage failures without claiming it was saved", () => {
    const { store, storage } = setup();
    store.hydrate(key, defaults);
    storage.setItem.mockImplementation(() => { throw new Error("Quota exceeded"); });
    store.setField(key, "name", "Keep in memory");
    store.hydrate(key, defaults);
    expect(store.snapshot(key)).toMatchObject({ values: { name: "Keep in memory" }, storageError: true });
  });
  it("updates subscribers and handles another tab discarding the draft", () => {
    const { store } = setup();
    store.hydrate(key, defaults);
    const changed = vi.fn(); const unsubscribe = store.subscribe(key, changed);
    store.setField(key, "name", "Typing");
    expect(changed).toHaveBeenCalledTimes(1);
    store.stored(key, null, () => defaults);
    expect(store.snapshot(key)).toMatchObject({ hasDraft: false, values: defaults });
    unsubscribe(); store.setField(key, "name", "No listener");
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
