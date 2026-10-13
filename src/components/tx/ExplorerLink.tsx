import React from "react";
import { ExternalLink } from "lucide-react";
import { getExplorerTxUrl, shortAddress } from "@/lib/format";

export interface ExplorerLinkProps {
  txHash: string;
  label?: string;
  className?: string;
  truncateChars?: number;
}

export function ExplorerLink({
  txHash,
  label,
  className = "",
  truncateChars = 4,
}: ExplorerLinkProps) {
  const display = label || shortAddress(txHash, truncateChars);

  return (
    <a
      href={getExplorerTxUrl(txHash)}
      target="_blank"
      rel="noopener noreferrer"
      title={`View transaction ${txHash} on Snowtrace`}
      className={`inline-flex items-center gap-1 font-mono text-xs text-money hover:text-foreground hover:underline focus:outline-none focus:ring-1 focus:ring-money px-1 py-0.5 ${className}`}
    >
      <span>{display}</span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}
