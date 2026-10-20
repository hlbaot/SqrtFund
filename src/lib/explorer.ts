import { explorerUrl } from "@/lib/chains";

export const explorerBaseUrl = explorerUrl.replace(/\/+$/, "");

export function explorerAddressUrl(address: string, transactions = false): string {
  return `${explorerBaseUrl}/address/${encodeURIComponent(address)}${transactions ? "#transactions" : ""}`;
}

export function explorerTxUrl(txHash: string): string {
  return `${explorerBaseUrl}/tx/${encodeURIComponent(txHash)}`;
}
