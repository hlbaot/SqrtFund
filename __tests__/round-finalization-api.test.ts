import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ chain: vi.fn(), read: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/roundGovernance", () => ({ governanceChain: f.chain }));
vi.mock("@/lib/finalization", () => ({ readFinalizationTiming: f.read }));
import { GET } from "@/app/api/round-finalization/route";
const request = (round: string) => new Request(`https://sqrt.test/api/round-finalization?round=${round}`);
beforeEach(() => { vi.clearAllMocks(); f.chain.mockResolvedValue({}); f.read.mockResolvedValue({ finalizedAt: 1000, blockNumber: "77" }); });
it("validates the round and caches only confirmed event timing", async () => {
  expect((await GET(request("bad"))).status).toBe(400); expect(f.chain).not.toHaveBeenCalled();
  const round = `0x${"1".repeat(40)}`;
  const result = await GET(request(round)); expect(await result.json()).toEqual({ timing: { finalizedAt: 1000, blockNumber: "77" } });
  await GET(request(round)); expect(f.chain).toHaveBeenCalledOnce(); expect(f.read).toHaveBeenCalledOnce();
});
it("fails closed on membership or archive failures and never caches them as a timestamp", async () => {
  const round = `0x${"2".repeat(40)}`;
  f.chain.mockRejectedValueOnce(Error("not in Factory")); expect((await GET(request(round))).status).toBe(503);
  f.read.mockRejectedValueOnce(Error("archive unavailable")); expect((await GET(request(round))).status).toBe(503);
  expect((await GET(request(round))).status).toBe(200);
});
it("does not cache a not-yet-finalized result", async () => {
  const round = `0x${"3".repeat(40)}`;
  f.read.mockResolvedValueOnce(null); expect(await (await GET(request(round))).json()).toEqual({ timing: null });
  expect(await (await GET(request(round))).json()).toEqual({ timing: { finalizedAt: 1000, blockNumber: "77" } });
  expect(f.read).toHaveBeenCalledTimes(2);
});
