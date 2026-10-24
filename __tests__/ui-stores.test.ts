import { beforeEach, describe, expect, it } from "vitest";
import { roundsStore } from "@/lib/store/roundsStore";
import { organizerStore } from "@/lib/store/organizerStore";
import { projectsStore, projectKey, storedProject } from "@/lib/store/projectsStore";
import type { EnrichedProject } from "@/hooks/useProjects";
const a = `0x${"a".repeat(40)}` as const, b = `0x${"b".repeat(40)}` as const;
const project = (roundId = a): EnrichedProject => ({ id: "1", contractId: 1n, roundId, ownerAddress: a, name: "Student project",
  description: "Proposal", shortDescription: "Proposal", category: "technology", contactUrl: "", supporterCount: 0,
  totalDonated: 0, estimatedMatching: 0, status: "pending", approved: false, rejected: false, claimed: false,
  sumSqrtRaw: 0n, totalDonatedRaw: 0n, estimatedMatchingRaw: 0n });
beforeEach(() => { roundsStore.getState().reset(); projectsStore.getState().reset(); organizerStore.getState().reset(); });
describe("roundsStore", () => {
  it("upserts case-insensitively, patches and removes with rollback", () => {
    const store = roundsStore.getState;
    store().upsert({ id: a.toUpperCase(), address: a, name: "One" });
    store().upsert({ id: a, address: a, name: "Two" }); expect(store().rounds).toHaveLength(1);
    const patch = store().patch(a, { name: "Optimistic" }, true);
    expect(store().rounds[0].name).toBe("Optimistic"); patch.rollback(); expect(store().rounds[0].name).toBe("Two");
    const remove = store().remove(a, true); expect(store().rounds).toEqual([]); remove.rollback(); expect(store().rounds).toHaveLength(1);
  });
  it("fences stale query hydration until receipt verification; old rollback cannot overwrite confirmation", () => {
    const store = roundsStore.getState;
    store().upsert({ id: a, address: a, name: "Old" });
    const change = store().patch(a, { name: "New" }, true);
    store().hydrate([{ id: a, address: a, name: "Stale in-flight read" }], Date.now() + 10); expect(store().rounds[0].name).toBe("New");
    change.commit(); store().hydrate([{ id: a, address: a, name: "Confirmed" }], Date.now() + 20);
    change.rollback(); expect(store().rounds[0].name).toBe("Confirmed");
  });
  it("reverses all patches from a failed batch rather than leaving an earlier optimistic field", () => {
    const s = roundsStore.getState; s().upsert({ id: a, address: a, name: "Old", admin: a });
    const c1 = s().patch(a, { name: "Temp" }, true), c2 = s().patch(a, { admin: b }, true);
    c2.rollback(); c1.rollback(); expect(s().entities[a]).toMatchObject({ name: "Old", admin: a });
  });
  it("does not resurrect a failed earlier patch when a newer pending write also fails", () => {
    const s = roundsStore.getState; s().upsert({ id: a, address: a, name: "Old" });
    const c1 = s().patch(a, { name: "First" }, true), c2 = s().patch(a, { name: "Second" }, true);
    c1.rollback(); expect(s().entities[a].name).toBe("Second"); c2.rollback(); expect(s().entities[a].name).toBe("Old");
  });
});
describe("projectsStore", () => {
  it("separates project #1 in different rounds and updates the per-round selector immediately", () => {
    const s = projectsStore.getState; s().upsert(storedProject(project())); s().upsert(storedProject({ ...project(), roundId: b }));
    expect(Object.keys(s().projectsByRound)).toHaveLength(2);
    const patch = s().patch(projectKey(a, 1n), { approved: true, status: "approved" }, true);
    expect(s().projectsByRound[a][0]).toMatchObject({ id: "1", approved: true });
    expect(s().projectsByRound[b][0].approved).toBe(false); patch.rollback(); expect(s().projectsByRound[a][0].status).toBe("pending");
    const remove = s().remove(projectKey(a, 1n), true); expect(s().projectsByRound[a]).toBeUndefined(); remove.rollback(); expect(s().projectsByRound[a]).toHaveLength(1);
  });
});
describe("organizerStore", () => {
  it("patches rights, rolls back removal and preserves the other wallet", () => {
    const s = organizerStore.getState; s().upsert({ id: a, authorized: false }); s().upsert({ id: b, authorized: true });
    const grant = s().patch(a, { authorized: true }, true); expect(s().organizersByWallet[a].authorized).toBe(true);
    grant.rollback(); expect(s().organizersByWallet[a].authorized).toBe(false);
    const remove = s().remove(a, true); remove.rollback(); expect(s().organizersByWallet[b].authorized).toBe(true);
  });
});
