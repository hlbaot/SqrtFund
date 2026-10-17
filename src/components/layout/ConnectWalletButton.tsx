"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useBalance, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { Wallet, LogOut, ChevronDown, Check, Copy, Loader2, Pencil } from "lucide-react";
import { AvatarPickerDialog } from "./AvatarPickerDialog";
import { Avatar } from "@/components/ui/Avatar";
import { useAvatar } from "@/hooks/useAvatar";
import { shortAddress, formatCooldown, formatUsdcFixed } from "@/lib/format";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { useClaim } from "@/hooks/useClaim";
import { TARGET_CHAIN_ID, usdcAddress } from "@/lib/contracts/addresses";
import { mockUsdcAbi } from "@/lib/contracts/abis";
import { txToast } from "@/lib/txToast";
import { getContractErrorMessage, isUserRejected } from "@/lib/errors";
import { logoutWallet, markWalletConnected } from "@/lib/walletSession";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GradientBorder } from "@/components/ui/GradientBorder";
import { Skeleton } from "@/components/ui/Skeleton";
import { NotificationBadge } from "@/components/ui/NotificationBadge";

export function ConnectWalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const queryClient = useQueryClient();
  const { t, locale } = useLocale();
  const { role, isReady, isStudent } = useRole();
  const counts = useNotificationCounts(isReady ? role : "guest");
  const { canClaim, remainingSeconds } = useClaim();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const { avatar } = useAvatar(address);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 16 });
  const trigger = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(false);
  const menuId = useId();
  const closeAvatarPicker = useCallback(() => {
    setAvatarPickerOpen(false);
    window.requestAnimationFrame(() => trigger.current?.focus());
  }, []);
  const openAvatarPicker = () => {
    setDropdownOpen(false);
    setAvatarPickerOpen(true);
  };
  const isFuji = chainId === TARGET_CHAIN_ID;
  const { data: avax } = useBalance({ address, chainId: TARGET_CHAIN_ID, query: { enabled: isConnected && isFuji, refetchInterval: 30_000 } });
  const { data: usdc } = useReadContract({
    address: usdcAddress, abi: mockUsdcAbi, functionName: "balanceOf", args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID, query: { enabled: Boolean(isConnected && isFuji && usdcAddress), refetchInterval: 30_000 },
  });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(copyTimer.current); };
  }, []);
  useEffect(() => {
    if (!dropdownOpen) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setDropdownOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setDropdownOpen(false); trigger.current?.focus(); }
    };
    const reposition = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) });
    };
    reposition();
    panel.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [dropdownOpen]);

  const isReadyRef = useRef(isReady);
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  const handleConnect = async () => {
    const connector = connectors.find(c => c.id === "app.core.extension" || /core/i.test(c.name)) ?? connectors.find(c => c.id === "injected") ?? connectors[0];
    if (!connector) { txToast.error("wallet-connect", t.wallet.connectionFailed, t.wallet.walletMissing); return; }
    try {
      await connectAsync({ connector, chainId: TARGET_CHAIN_ID });
      markWalletConnected();

      // Wait up to 1500ms for role to resolve so toast and profile appear smoothly together
      const start = Date.now();
      while (!isReadyRef.current && Date.now() - start < 1500) {
        await new Promise(r => setTimeout(r, 50));
      }

      if (mounted.current) txToast.success("wallet-connect", t.wallet.connected, undefined, undefined, 3000);
    } catch (error) {
      if (mounted.current) txToast.error("wallet-connect", isUserRejected(error) ? t.wallet.connectionRejected : t.wallet.connectionFailed, getContractErrorMessage(error, locale));
    }
  };
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address!);
      if (!mounted.current) return;
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch { if (mounted.current) txToast.error("wallet-copy", t.wallet.copyFailed); }
  };

  const handleDisconnect = async () => {
    setDropdownOpen(false);
    try {
      await logoutWallet(disconnectAsync, queryClient);
    } catch (err) {
      console.error("Disconnect failed:", err);
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="flex min-h-10 min-w-[170px] items-center justify-end transition-opacity duration-200 ease-in-out">
        <GradientBorder className="inline-flex rounded-sm">
          <Button variant="ghost" size="sm" onClick={handleConnect} disabled={isConnecting} className="text-foreground font-bold">
            {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Wallet className="h-3.5 w-3.5" aria-hidden="true" />}
            {isConnecting ? t.wallet.connecting : t.nav.connectWallet}
          </Button>
        </GradientBorder>
      </div>
    );
  }

  return (
    <div ref={root} className="relative flex min-h-10 min-w-[170px] items-center justify-end transition-opacity duration-200 ease-in-out" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !panel.current?.contains(event.relatedTarget as Node | null)) setDropdownOpen(false);
    }}>
      <button ref={trigger} type="button" onClick={() => { const rect = trigger.current?.getBoundingClientRect(); if (rect) setPosition({ top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) }); setDropdownOpen(open => !open); }} aria-label={t.wallet.profile}
        aria-expanded={dropdownOpen} aria-haspopup="dialog" aria-controls={menuId}
        className="mono-label relative flex max-w-full min-h-10 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-foreground hover:bg-surface-2">
        <Avatar address={address} size={24} avatarId={avatar} />
        <span className={`h-2 w-2 shrink-0 rounded-full ${isFuji ? "bg-money" : "bg-amber-400"}`} aria-hidden="true" />
        <span className="min-w-0 truncate whitespace-nowrap text-xs border border-line px-1.5 py-0.5">{isFuji ? t.common.testnetBadge : t.wallet.switchNetwork}</span>
        <span>{shortAddress(address, 4)}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${dropdownOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        {counts.total > 0 && <span aria-label={t.wallet.notifications} className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-bg" />}
      </button>
      {dropdownOpen && createPortal(
        <div ref={panel} style={{ "--profile-top": `${position.top}px`, "--profile-right": `${position.right}px` } as React.CSSProperties}
          onKeyDown={event => { if (event.key === "Escape") { setDropdownOpen(false); trigger.current?.focus(); } }}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !root.current?.contains(event.relatedTarget as Node | null)) setDropdownOpen(false); }}
          id={menuId} role="dialog" aria-label={t.wallet.profile} className="fixed left-4 right-4 bottom-4 z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-sm border border-line-strong bg-bg p-4 text-xs text-foreground shadow-2xl lg:left-auto lg:bottom-auto lg:right-[var(--profile-right)] lg:top-[var(--profile-top)] lg:w-80">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <button type="button" onClick={openAvatarPicker} aria-label={t.avatar.change}
              className="group relative shrink-0 rounded-full">
              <Avatar address={address} size={48} avatarId={avatar} />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
            <div className="min-w-0 space-y-1">
              <p className="role-label text-muted">{t.common.testnetBadge}</p>
              {isReady ? <Badge variant={role === "admin" ? "warning" : role === "student" ? "accent" : role === "owner" ? "owner" : "default"}>{t.wallet[role]}</Badge> : <Skeleton className="h-6 w-32" />}
            </div>
          </div>
          <p className="mt-4 break-all font-mono leading-relaxed">{address}</p>
          <button type="button" onClick={copyAddress} className="mono-label my-2 flex w-full items-center justify-between px-2 py-2 text-muted hover:bg-surface hover:text-foreground">
            <span aria-live="polite">{copied ? t.wallet.copied : t.common.copyAddress}</span>
            {copied ? <Check className="h-3.5 w-3.5 text-money" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {(avax || usdc !== undefined) && <div className="mb-3 space-y-2 border-y border-line py-3 font-mono" aria-label={t.wallet.balance}>
            {avax && <p className="flex justify-between"><span className="text-muted">AVAX</span><span className="tabular-nums">{Number(formatUnits(avax.value, avax.decimals)).toFixed(4)}</span></p>}
            {usdc !== undefined && <p className="flex justify-between"><span className="text-muted">USDC</span><span className="tabular-nums">{formatUsdcFixed(Number(formatUnits(usdc, 6)))}</span></p>}
          </div>}

          {/* Student Verification section for non-admin, non-student wallets */}
          {!isStudent && (
            <div className="mb-3 space-y-2 border-b border-line pb-3">
              <span className="role-label text-muted block">
                {t.verification.title}
              </span>

              <Link
                href="/verify"
                onClick={() => setDropdownOpen(false)}
                className="mono-label block border border-primary p-3 text-center font-bold hover:bg-primary/10 transition-colors"
              >
                {locale === "vi" ? "Xác thực bằng email trường" : "Verify university email"}
              </Link>
            </div>
          )}

          <div className="space-y-1">
            {isReady && role === "admin" && <Link href="/admin" onClick={() => setDropdownOpen(false)} className="mono-label flex justify-between px-2 py-2 hover:bg-surface">{t.nav.admin}<NotificationBadge count={counts.admin} /></Link>}
            <Link href="/my" onClick={() => setDropdownOpen(false)} className="mono-label flex justify-between px-2 py-2 hover:bg-surface">{t.wallet.myProjects}<NotificationBadge count={counts.owner} /></Link>
            {isReady && role === "student" && (
              <Link
                href="/my#claim-usdc"
                onClick={() => setDropdownOpen(false)}
                className="mono-label flex items-center justify-between px-2 py-2 hover:bg-surface"
              >
                <span>{t.wallet.claimUsdc}</span>
                {canClaim ? (
                  <NotificationBadge count={counts.student} />
                ) : (
                  <span className="tabular-mono text-xs text-muted border border-line px-1.5 py-0.5 rounded">
                    {t.faucet.nextClaimIn.toUpperCase()} {formatCooldown(remainingSeconds)}
                  </span>
                )}
              </Link>
            )}
          </div>
          <button type="button" onClick={handleDisconnect} className="mono-label mt-3 flex w-full items-center gap-2 border-t border-line px-2 pt-4 pb-1 text-primary hover:bg-primary/10">
            <LogOut className="h-3.5 w-3.5" />{t.nav.disconnect}
          </button>
        </div>, document.body
      )}
      {avatarPickerOpen && <AvatarPickerDialog key={address.toLowerCase()} address={address} onClose={closeAvatarPicker} />}
    </div>
  );
}
