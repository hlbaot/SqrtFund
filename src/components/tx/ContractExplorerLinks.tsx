"use client";

import { isAddress } from "viem";
import { factoryAddress, studentRegistryAddress, usdcAddress, ZERO_ADDRESS } from "@/lib/contracts/addresses";
import { useLocale } from "@/lib/context/locale";
import { ExplorerLink } from "./ExplorerLink";

const contracts = [
  { name: "RoundFactory", address: factoryAddress },
  { name: "StudentRegistry", address: studentRegistryAddress },
  { name: "MockUSDC", address: usdcAddress },
];

export function ContractExplorerLinks() {
  const { t } = useLocale();
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2">
      {contracts.map(({ name, address }) => (
        <li key={name}>
          {isAddress(address) && address.toLowerCase() !== ZERO_ADDRESS ? (
            <ExplorerLink address={address} label={name} />
          ) : (
            <span className="text-xs text-muted">{name}: {t.onChain.unavailable}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
