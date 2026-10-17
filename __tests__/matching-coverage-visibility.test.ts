import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { matchingCoverage, computeMatchingBigInt, sqrtBigInt, SCALE } from "@/lib/qf";
import { canViewProject } from "@/lib/projectVisibility";
import { getContractErrorMessage } from "@/lib/errors";
import { toFunctionSelector } from "viem";
import { MatchingPoolWarning } from "@/components/project/MatchingPoolWarning";
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: "vi", t: copy.vi }) }; });
it.each([[500n,100n,"20.00",true],[3n,1n,"33.33",true],[500n,600n,"100.00",false],[100n,100n,"100.00",false],[0n,0n,"100.00",false],[10n,0n,"0.00",true],[10n**40n,10n**39n,"10.00",true]])("coverage %s raw, %s pool",(raw,pool,percent,underfunded)=>expect(matchingCoverage(raw,pool)).toEqual({percent,underfunded}));
it("renders a proportional-scaling warning only when raw exceeds the pool",()=>{
  const html=renderToStaticMarkup(createElement(MatchingPoolWarning,{totalRaw:500n,pool:100n}));
  expect(html).toContain("thu nhỏ theo tỉ lệ");expect(html).toContain("20.00%");
  expect(renderToStaticMarkup(createElement(MatchingPoolWarning,{totalRaw:100n,pool:100n}))).toBe("");
});
it("pending projects are visible only to their owner or round admin, ignoring case",()=>{
  const pending={approved:false,ownerAddress:"0xAbC"};
  expect(canViewProject(pending)).toBe(false);expect(canViewProject(pending,"0xOTHER","0xADMIN")).toBe(false);
  expect(canViewProject(pending,"0xabc","0xADMIN")).toBe(true);expect(canViewProject(pending,"0xadmin","0xADMIN")).toBe(true);
  expect(canViewProject({...pending,approved:true})).toBe(true);
});
it.each(["en","vi"] as const)("decodes OwnerProjectLimit as a clear %s error",locale=>expect(getContractErrorMessage({data:toFunctionSelector("OwnerProjectLimit()")},locale)).toContain("2"));
it("README QF examples use the actual integer sqrt and min/max units",()=>{
  const project=(count:number,amount:bigint)=>({id:count,sumSqrt:BigInt(count)*sqrtBigInt(amount*SCALE),totalDonated:BigInt(count)*amount});
  const results=computeMatchingBigInt([project(100,1_000_000n),project(20,5_000_000n)],100_000_000_000n,10000n);
  expect(results[0].raw).toBe(9_900_000_000n);
  // Integer sqrt floors the ideal 1900 USDC by one micro-USDC.
  expect(results[1].raw).toBe(1_899_999_999n);
});

it("zero pool still preserves raw demand and warns while every payout remains zero",()=>{
  const results=computeMatchingBigInt([{id:1,sumSqrt:2n*sqrtBigInt(1_000_000n*SCALE),totalDonated:2_000_000n}],0n,10000n);
  expect(results[0]).toMatchObject({raw:2_000_000n,payout:0n});
  expect(matchingCoverage(results[0].raw,0n)).toEqual({underfunded:true,percent:"0.00"});
});
