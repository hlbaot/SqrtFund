import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ContractFunctionZeroDataError, HttpRequestError, type Address } from "viem";
import { useInitialPoolDeposit } from "@/hooks/useInitialPoolDeposit";

const f = vi.hoisted(() => ({ data: [] as { status: string; result?: unknown; error?: unknown }[] }));
const owner = "0x1111111111111111111111111111111111111111" as Address;
const organizer = "0x2222222222222222222222222222222222222222" as Address;
vi.mock("wagmi", () => ({ useReadContracts: () => ({ data: f.data, isPending: false, isError: false }) }));
function probe(wallet: Address = owner) {
  let result: ReturnType<typeof useInitialPoolDeposit> | undefined;
  function Probe() { result = useInitialPoolDeposit(wallet); return null; }
  renderToStaticMarkup(createElement(Probe)); return result!;
}
beforeEach(() => { f.data = [1n, 25_000_000n, owner, false].map(result => ({ status: "success", result })); });
it("preserves owner funding on the deployed factory without Organizer getters", () => {
  f.data[3] = { status: "failure", error: new ContractFunctionZeroDataError({ functionName: "authorizedOrganizers" }) };
  expect(probe()).toMatchObject({ supported: true, canDeposit: true, isOwner: true, isError: false, credit: 25_000_000n });
});
it("allows an authorized Organizer to use the same deposit-first flow", () => {
  f.data[3] = { status: "success", result: true };
  expect(probe(organizer)).toMatchObject({ supported: true, canDeposit: true, isOwner: false, isError: false });
});
it("blocks an unauthorized or revoked Organizer but retains its refundable credit", () => {
  expect(probe(organizer)).toMatchObject({ canDeposit: false, isOwner: false, credit: 25_000_000n });
});
it("treats an Organizer RPC failure as an error rather than a grant", () => {
  f.data[3] = { status: "failure", error: new HttpRequestError({ url: "https://rpc.invalid", status: 503 }) };
  expect(probe(organizer)).toMatchObject({ canDeposit: false, isError: true });
});
it("does not authorize deposits on a Factory without the funding API", () => {
  f.data[0] = { status: "failure", error: new ContractFunctionZeroDataError({ functionName: "fundingVersion" }) };
  expect(probe()).toMatchObject({ supported: false, isUnsupported: true, isError: true });
});
