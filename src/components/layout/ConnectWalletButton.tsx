"use client";

import React, { useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { shortAddress } from "@/lib/format";
import { Wallet, LogOut, ChevronDown, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const { t } = useLocale();
  const { isAdmin, isStudent, isProjectOwner } = useRole();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFuji = chainId === TARGET_CHAIN_ID;

  const handleConnect = () => {
    setError(null);
    console.log(
      "Wallet connectors:",
      connectors.map((connector) => ({ name: connector.name, id: connector.id })),
    );

    const connector =
      connectors.find((c) => c.id === "app.core.extension" || /core/i.test(c.name)) ??
      connectors.find((c) => c.id === "injected") ??
      connectors[0];

    if (!connector) {
      setError("Wallet not found. Install/enable Core and reload.");
      return;
    }

    connect(
      { connector, chainId: TARGET_CHAIN_ID },
      {
        onError: (err) => {
          console.error("Connect failed:", err);
          setError(err.message.split("\n")[0]);
        },
      },
    );
  };

  const roleLabel = isAdmin
    ? "Admin"
    : isProjectOwner
    ? "Project Owner"
    : isStudent
    ? "Whitelisted Student"
    : "Visitor";

  if (!isConnected || !address) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button
          variant="primary"
          size="sm"
          onClick={handleConnect}
          disabled={isConnecting}
          className="font-bold"
        >
          <Wallet className="h-3.5 w-3.5 mr-1.5" />
          {isConnecting ? "Connecting..." : t.nav.connectWallet}
        </Button>
        {error && <p className="max-w-[260px] text-xs text-primary">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        {/* Avalanche Fuji chip */}
        <div
          className={`hidden sm:flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold ${
            isFuji
              ? "border-money/40 bg-money/10 text-money"
              : "border-primary/40 bg-primary/10 text-primary"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isFuji ? "bg-money animate-pulse" : "bg-primary"
            }`}
          />
          <span>{isFuji ? "Avalanche Fuji" : "Wrong Net"}</span>
        </div>
        {!isFuji && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
          >
            Switch to Fuji
          </Button>
        )}

        {/* Short address trigger button */}
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="mono-label flex items-center gap-2 border border-line-strong bg-surface px-3 py-1.5 text-foreground transition-colors hover:bg-surface-2 focus:outline-none"
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
        >
          <span className="font-mono">{shortAddress(address, 4)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </button>
      </div>

      {dropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 border border-line-strong bg-surface p-3 text-xs text-foreground shadow-2xl">
            <div className="mb-2 border-b border-line pb-2">
              <span className="mono-label text-muted text-[10px] uppercase tracking-wider">
                {roleLabel}
              </span>
              <p className="tabular-mono mt-0.5 truncate text-xs text-foreground font-mono">
                {address}
              </p>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <span>{copied ? "Copied!" : t.common.copyAddress}</span>
                {copied ? <Check className="h-3.5 w-3.5 text-money" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  disconnect();
                  setDropdownOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-primary hover:bg-primary/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t.nav.disconnect}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
