import { describe, expect, it, vi } from "vitest";
import { loadRoundNotificationSnapshot, roundProjectNotificationItems, roundLifecycleNotificationItems } from "@/lib/roundNotifications";

const round = `0x${"1".repeat(40)}` as const;
const admin = `0x${"2".repeat(40)}` as const;
const owner = `0x${"3".repeat(40)}` as const;
const projects = Array.from({ length: 51 }, (_, index) => ({ id: BigInt(index + 1), name: `Project ${index + 1}`, owner,
  approved: index === 0, rejected: index === 1 }));
const read = () => vi.fn(async (call: { functionName: string; args?: readonly unknown[] }) => {
  if (call.functionName === "admin") return admin;
  if (call.functionName === "endTime") return 1000n;
  if (call.functionName === "getProjects") { const offset = Number(call.args?.[0]); return [projects.slice(offset, offset + 50), 51n]; }
  return false;
});
describe("notification snapshots across rounds", () => {
  it("reads beyond the first 50 projects and scopes notices to the correct wallet", async () => {
    const reader = read();
    const snapshot = await loadRoundNotificationSnapshot(reader, round);
    expect(snapshot.projects).toHaveLength(51);
    const pending = roundProjectNotificationItems(snapshot, admin, 500);
    expect(pending).toHaveLength(49);
    expect(pending.at(-1)?.key).toBe(`projectPending:${round}:51`);
    const decisions = roundProjectNotificationItems(snapshot, owner, 500);
    expect(decisions.map(item => item.key)).toEqual([`projectApproved:${round}:1`, `projectRejected:${round}:2`]);
    expect(roundProjectNotificationItems(snapshot, `0x${"4".repeat(40)}`, 500)).toEqual([]);
    expect(roundProjectNotificationItems(snapshot, admin, 1000)).toEqual([]);
  });
  it("does not convert RPC errors into empty or approved snapshots", async () => {
    await expect(loadRoundNotificationSnapshot(vi.fn().mockRejectedValue(new Error("RPC down")), round)).rejects.toThrow("RPC down");
  });
  it("notifies donors and the round organizer as time crosses the end, with separate finalization acknowledgement", async () => {
    const snapshot = { ...await loadRoundNotificationSnapshot(read(), round), hasDonated: true };
    expect(roundLifecycleNotificationItems(snapshot, owner, 999)).toEqual([]);
    expect(roundLifecycleNotificationItems(snapshot, owner, 1000)).toEqual([{ key: `roundEnded:${round}`, scope: "activity" }]);
    expect(roundLifecycleNotificationItems(snapshot, admin, 1000)).toEqual([{ key: `roundEnded:${round}`, scope: "admin" }]);
    expect(roundLifecycleNotificationItems({ ...snapshot, hasDonated: false }, owner, 1000)).toEqual([]);
    const finalized = roundLifecycleNotificationItems({ ...snapshot, finalized: true }, owner, 1001);
    expect(finalized.map(item => item.key)).toEqual([`roundEnded:${round}`, `roundFinalized:${round}`]);
    expect(roundLifecycleNotificationItems({ ...snapshot, isCancelled: true }, owner, 1001)).toEqual([]);
    expect(roundLifecycleNotificationItems(snapshot, owner, 1001)).toEqual(roundLifecycleNotificationItems(snapshot, owner, 1002));
  });
  it("checks on-chain participation for the current wallet, including projects after the first page", async () => {
    const base = read();
    const reader = vi.fn(async (call: Parameters<Parameters<typeof loadRoundNotificationSnapshot>[0]>[0]) => {
      if (call.functionName === "donationOf") {
        expect(call.args?.[0]).toBe(owner);
        return call.args?.[1] === 51n ? 1n : 0n;
      }
      return base(call);
    });
    expect((await loadRoundNotificationSnapshot(reader, round, owner)).hasDonated).toBe(true);
    expect(reader.mock.calls.filter(([call]) => call.functionName === "donationOf")).toHaveLength(51);
    await expect(loadRoundNotificationSnapshot(async call => {
      if (call.functionName === "donationOf") throw new Error("RPC down");
      return base(call);
    }, round, owner)).rejects.toThrow("RPC down");
  });
});
it("loads settled matching and claimed state for claim notices across any round", async()=>{
  const reader=vi.fn(async(call:{functionName:string;args?:readonly unknown[]})=>{
    if(call.functionName==="admin")return admin;
    if(call.functionName==="endTime")return 1000n;
    if(call.functionName==="finalized")return true;
    if(call.functionName==="getProjects")return [[{id:1n,name:"Funded",owner,approved:true,claimed:false,totalDonated:5n}],1n];
    if(call.functionName==="payoutOf")return 7n;
    if(call.functionName==="donationOf")return 0n;
    return false;
  });
  const snapshot=await loadRoundNotificationSnapshot(reader,round,owner);
  expect(snapshot.projects[0].finalMatchingRaw).toBe(7n);
  expect(roundProjectNotificationItems(snapshot,owner,1001).some(x=>x.key===`claim:${round}:1`)).toBe(true);
  reader.mockImplementation(async call=>call.functionName==="getProjects"?[[{id:1n,name:"Funded",owner,approved:true,claimed:true,totalDonated:5n}],1n]:call.functionName==="admin"?admin:call.functionName==="endTime"?1000n:call.functionName==="donationOf"?0n:call.functionName==="finalized");
  expect(roundProjectNotificationItems(await loadRoundNotificationSnapshot(reader,round,owner),owner,1001).some(x=>x.key.startsWith("claim:"))).toBe(false);
});
it("notifies only the donating wallet about its outstanding cancelled-round refund",async()=>{
  const base=read();
  const reader=async(call:Parameters<Parameters<typeof loadRoundNotificationSnapshot>[0]>[0])=>call.functionName==="isCancelled"?true:call.functionName==="donationOf"?(call.args?.[1]===1n?4n:0n):base(call);
  const snapshot=await loadRoundNotificationSnapshot(reader,round,owner);
  expect(snapshot.refundTotal).toBe(4n);
  expect(roundProjectNotificationItems(snapshot,owner,1001).some(x=>x.key===`refund:${round}`)).toBe(true);
  const refunded=await loadRoundNotificationSnapshot(async call=>call.functionName==="donationOf"?0n:reader(call),round,owner);
  expect(roundProjectNotificationItems(refunded,owner,1001).some(x=>x.key.startsWith("refund:"))).toBe(false);
});
