import React from "react";
import { ExternalLink } from "lucide-react";
import { getExplorerTxUrl, getExplorerAddressUrl, shortAddress } from "@/lib/format";

export interface ExplorerLinkProps {
  txHash?: string;
  address?: string;
  label?: string;
  className?: string;
  truncateChars?: number;
}

export function ExplorerLink({
  txHash,
  address,
  label,
  className = "",
  truncateChars = 4,
}: ExplorerLinkProps) {
  const url = address ? getExplorerAddressUrl(address) : txHash ? getExplorerTxUrl(txHash) : "#";
  const display = label || (address ? shortAddress(address, truncateChars) : txHash ? shortAddress(txHash, truncateChars) : "");
  const title = address ? `View address ${address} on Snowtrace` : txHash ? `View transaction ${txHash} on Snowtrace` : "View on Snowtrace";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={`inline-flex items-center gap-1 font-mono text-xs text-money hover:text-foreground hover:underline focus:outline-none focus:ring-1 focus:ring-money px-1 py-0.5 ${className}`}
    >
      <span>{display}</span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

