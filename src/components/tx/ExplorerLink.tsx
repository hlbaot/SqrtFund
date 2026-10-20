"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { shortAddress } from "@/lib/format";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";
import { useLocale } from "@/lib/context/locale";
import { fmt } from "@/lib/copy";
import { isAddress, isHash } from "viem";

export interface ExplorerLinkProps {
  txHash?: string;
  address?: string;
  label?: string;
  className?: string;
  truncateChars?: number;
  transactions?: boolean;
  iconOnly?: boolean;
}

export function ExplorerLink({
  txHash,
  address,
  label,
  className = "",
  truncateChars = 4,
  transactions = false,
  iconOnly = false,
}: ExplorerLinkProps) {
  const { t } = useLocale();
  if (address ? !isAddress(address) || /^0x0{40}$/i.test(address) : !txHash || !isHash(txHash)) return null;
  const url = address ? explorerAddressUrl(address, transactions) : explorerTxUrl(txHash!);
  const display = label || (address ? shortAddress(address, truncateChars) : txHash ? shortAddress(txHash, truncateChars) : "");
  const title = address
    ? fmt(t.onChain.viewAddress, { address })
    : fmt(t.onChain.viewTransaction, { hash: txHash! });

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={iconOnly ? `${label || t.onChain.roundContract}: ${title}` : undefined}
      className={`inline-flex items-center gap-1 font-mono text-xs text-money hover:text-foreground hover:underline focus:outline-none focus:ring-1 focus:ring-money px-1 py-0.5 ${className}`}
    >
      {!iconOnly && <span>{display}</span>}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

