import { afterEach, expect, it } from "vitest";
import { computeMatchingBigInt, simulateDonationBatch, simulateDonationImpact, sqrtBigInt, SCALE } from "@/lib/qf";
import { TransactionFlow, cancelTransactionFlows, txToast } from "@/lib/txToast";
const hash = `0x${"a".repeat(64)}`;
afterEach(() => { cancelTransactionFlows(); txToast.dismiss(); });
it("batch preview includes all selected projects before dividing a limited shared pool", () => {
  const projects = [1,2].map(id => ({ id: String(id), sumSqrt: sqrtBigInt(1_000_000n*SCALE), totalDonated: 1_000_000n }));
  const result = simulateDonationBatch(projects, {}, [{id:"1",amount:1_000_000n},{id:"2",amount:1_000_000n}], 2_000_000n, 10000n);
  expect(result[0].payout).toBe(1_000_000n); expect(result[1].payout).toBe(1_000_000n);
  expect(projects[0].totalDonated).toBe(1_000_000n);
});
it("duplicate allocations accumulate before sqrt exactly like repeated donations, including six decimals", () => {
  const initial = [{id:"1",sumSqrt:sqrtBigInt(1_000_001n*SCALE),totalDonated:1_000_001n}];
  const result = simulateDonationBatch(initial,{"1":1_000_001n},[{id:"1",amount:1_000_002n},{id:"1",amount:1_000_003n}],100_000_000n,3000n);
  const once = simulateDonationImpact({projectId:"1",currentSumSqrt:initial[0].sumSqrt,currentTotalDonated:initial[0].totalDonated,donorCurrentTotal:1_000_001n,donationAmount:2_000_005n,allProjects:initial,pool:100_000_000n,maxMatchBps:3000n});
  expect(result[0].payout).toBe(once.newPayout);
  expect(simulateDonationBatch(initial,{},[],100_000_000n,3000n)).toEqual(computeMatchingBigInt(initial,100_000_000n,3000n));
});
it("updates expected matching immediately when the input amount changes", () => {
  const projects=[{id:"1",sumSqrt:sqrtBigInt(1_000_000n*SCALE),totalDonated:1_000_000n}];
  const preview=(amount:bigint)=>simulateDonationBatch(projects,{},[{id:"1",amount}],100_000_000n,10000n)[0].payout;
  expect(preview(2_000_000n)).toBeGreaterThan(preview(1_000_000n));
});
it("success toast uses exact receipt gasUsed times effectiveGasPrice and the matching hash", async () => {
  const flow=new TransactionFlow();await flow.wait(async()=>({transactionHash:hash,gasUsed:21001n,effectiveGasPrice:1234567891n}));
  flow.toast.success("paid","Done",undefined,hash);
  expect(txToast.getToasts()[0]).toMatchObject({txHash:hash,feeWei:21001n*1234567891n});
  flow.toast.success("other","Other",undefined,`0x${"b".repeat(64)}`);
  expect(txToast.getToasts()[1].feeWei).toBeUndefined();
});
it("a reverted mined transaction still reports the receipt fee and explorer hash",async()=>{
  const flow=new TransactionFlow();flow.toast.pending("refund","Pending",undefined,hash);
  await flow.wait(async()=>({transactionHash:hash,status:"reverted",gasUsed:30000n,effectiveGasPrice:1000000000n}));
  flow.error("refund",new Error("Transaction reverted"));
  expect(txToast.getToasts()[0]).toMatchObject({type:"error",txHash:hash,feeWei:30000000000000n});
});
it("never fabricates a fee before a receipt exists",()=>{
  const flow=new TransactionFlow();flow.toast.pending("sign","Pending",undefined,hash);flow.toast.success("sign","Done",undefined,hash);
  expect(txToast.getToasts()[0].feeWei).toBeUndefined();
});
