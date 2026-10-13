import type { Address } from "viem";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const USDC_DECIMALS = 6;
export const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113);

export const factoryAddress = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "") as Address;
export const usdcAddress = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "") as Address;

export function getContractAddresses(): {
  factoryAddress: Address;
  usdcAddress: Address;
  isConfigured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!factoryAddress || factoryAddress === ZERO_ADDRESS) {
    missing.push("NEXT_PUBLIC_FACTORY_ADDRESS");
  }
  if (!usdcAddress || usdcAddress === ZERO_ADDRESS) {
    missing.push("NEXT_PUBLIC_USDC_ADDRESS");
  }

  return {
    factoryAddress,
    usdcAddress,
    isConfigured: missing.length === 0,
    missing,
  };
}
