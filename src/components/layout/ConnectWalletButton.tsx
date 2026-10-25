"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";
import {
  Wallet,
  LogOut,
  ChevronDown,
  Check,
  Copy,
  Loader2,
  Pencil,
  Building2,
  GraduationCap,
  User,
  ShieldCheck,
  Award,
  ShieldOff,
} from "lucide-react";
import { ExplorerLink } from "@/components/tx/ExplorerLink";
import dynamic from "next/dynamic";
import { Avatar } from "@/components/ui/Avatar";
import { useAvatar } from "@/hooks/useAvatar";
import { shortAddress, formatUsdcFixed } from "@/lib/format";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { useMyOrganizerApplication } from "@/hooks/useOrganizerApplications";
import { ApplyOrganizerModal } from "@/components/organizer/ApplyOrganizerModal";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { useTokenBalance } from "@/hooks/useTokenBalance";
const AvatarPickerDialog = dynamic(() => import("./AvatarPickerDialog").then(module => module.AvatarPickerDialog), { ssr: false });
import { txToast } from "@/lib/txToast";
import { getContractErrorMessage, isUserRejected } from "@/lib/errors";
import { logoutWallet, markWalletConnected, isWalletLoggedOut, markWalletLoggedOut } from "@/lib/walletSession";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GradientBorder } from "@/components/ui/GradientBorder";
import { WalletRoleStatus } from "@/components/layout/WalletRoleStatus";
import { WalletProfilePicker } from "@/components/layout/WalletProfilePicker";
import { defaultWalletProfile, useWalletProfile } from "@/hooks/useWalletProfile";
import { NotificationBadge } from "@/components/ui/NotificationBadge";
import { fmt } from "@/lib/copy";

export function ConnectWalletButton() {
  const { address, isConnected, chainId, status, connector } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const { disconnectAsync } = useDisconnect();

  useEffect(() => {
    console.log("[LOGOUT_DEBUG] useAccount state:", { status, address, connectorId: connector?.id });
  }, [status, address, connector]);
  const queryClient = useQueryClient();
  const { t, locale } = useLocale();
  const {
    role,
    isReady,
    isStudent,
    isAdmin,
    isPlatformOwner,
    isOrganizer,
    isRoundAdmin,
    hasManagedRounds,
    studentStatus,
    organizerStatus,
    refetchWalletRoles,
    canCreateRound,
  } = useRole();
  const counts = useNotificationCounts(isReady ? role : "guest");
  const hasOrganizerRole = isOrganizer || isRoundAdmin || hasManagedRounds || canCreateRound;
  const confirmedProfile = defaultWalletProfile(hasOrganizerRole, isStudent);
  const { profile, selectProfile } = useWalletProfile(address, chainId, confirmedProfile);
  const chosenProfileConfirmed = profile === "student" ? isStudent : profile === "organizer" ? hasOrganizerRole : false;
  const activeProfile = chosenProfileConfirmed ? profile : confirmedProfile ?? profile;
  // Khi ví mới đã chọn role hoặc đã xác minh thành công thì không được đổi lại
  const hasConfirmedRole = isPlatformOwner || isStudent || isOrganizer || isRoundAdmin || hasManagedRounds || canCreateRound;
  const choosingProfile = isReady && !hasConfirmedRole && activeProfile === null;
  const myApp = useMyOrganizerApplication(isConnected && activeProfile === "organizer" ? address : undefined);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
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
  const closeApplyModal = useCallback(() => {
    setApplyModalOpen(false);
  }, []);
  const openAvatarPicker = () => {
    setDropdownOpen(false);
    setAvatarPickerOpen(true);
  };
  const isFuji = chainId === TARGET_CHAIN_ID;
  const { data: avax } = useBalance({ address, chainId: TARGET_CHAIN_ID, query: { enabled: isConnected && isFuji, refetchInterval: 30_000 } });
  const tokenBalance = useTokenBalance(address);
  const usdc = tokenBalance.balance;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(copyTimer.current); };
  }, []);
  useEffect(() => {
    if (!dropdownOpen) return;
    // Clicking non-focusable panel content can blur a button with relatedTarget=null.
    // Close only when the pointer or actual new focus is outside both portal and trigger.
    const outside = (event: PointerEvent | FocusEvent) => {
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
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => { window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [dropdownOpen]);

  const isReadyRef = useRef(isReady);
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  const notifiedRevocationRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeProfile === "organizer" && myApp.isRevoked && myApp.application && notifiedRevocationRef.current !== myApp.application.id) {
      notifiedRevocationRef.current = myApp.application.id;
      txToast.error(
        "organizer-revoked",
        locale === "vi" ? "Quyền Organizer đã bị thu hồi" : "Organizer access revoked",
        myApp.application.revocationReason
          ? (locale === "vi" ? `Lí do: ${myApp.application.revocationReason}` : `Reason: ${myApp.application.revocationReason}`)
          : (locale === "vi" ? "Mở menu ví để xem chi tiết lý do và gửi yêu cầu lại" : "Open wallet menu to view reason and re-apply"),
        8000
      );
    }
  }, [activeProfile, myApp.isRevoked, myApp.application, locale]);

  const handleConnect = async () => {
    const connector = connectors.find(c => c.id === "app.core.extension" || /core/i.test(c.name)) ?? connectors.find(c => c.id === "injected") ?? connectors[0];
    if (!connector) { txToast.error("wallet-connect", t.wallet.connectionFailed, t.wallet.walletMissing); return; }
    const wasLoggedOut = isWalletLoggedOut();
    markWalletConnected();
    try {
      await connectAsync({ connector, chainId: TARGET_CHAIN_ID });

      // Wait up to 1500ms for role to resolve so toast and profile appear smoothly together
      const start = Date.now();
      while (!isReadyRef.current && Date.now() - start < 1500) {
        await new Promise(r => setTimeout(r, 50));
      }

      if (mounted.current) txToast.success("wallet-connect", t.wallet.connected, undefined, undefined, 3000);
    } catch (error) {
      if (wasLoggedOut) markWalletLoggedOut();
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
    console.log("[LOGOUT_DEBUG] handleDisconnect clicked! connector:", connector?.id);
    setDropdownOpen(false);
    try {
      console.log("[LOGOUT_DEBUG] calling logoutWallet...");
      await logoutWallet(async () => {
        console.log("[LOGOUT_DEBUG] calling disconnectAsync...");
        try {
          const res = await disconnectAsync({ connector });
          console.log("[LOGOUT_DEBUG] disconnectAsync SUCCESS:", res);
        } catch (discErr) {
          console.error("[LOGOUT_DEBUG] disconnectAsync ERROR:", discErr);
          throw discErr;
        }
      }, queryClient);
      console.log("[LOGOUT_DEBUG] logoutWallet completed!");
    } catch (err) {
      console.error("[LOGOUT_DEBUG] Disconnect failed:", err);
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
    <>
      <div ref={root} className="relative flex min-h-10 min-w-[170px] items-center justify-end transition-opacity duration-200 ease-in-out">
      <button ref={trigger} type="button" onClick={() => { const rect = trigger.current?.getBoundingClientRect(); if (rect) setPosition({ top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) }); setDropdownOpen(open => !open); }} aria-label={t.wallet.profile}
        aria-expanded={dropdownOpen} aria-haspopup="dialog" aria-controls={menuId}
        className="mono-label relative flex max-w-full min-h-10 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-foreground hover:bg-surface-2 hover:border-line cursor-pointer transition-colors active:scale-[0.99]">
        <Avatar address={address} size={24} avatarId={avatar} />
        <span className={`h-2 w-2 shrink-0 rounded-full ${isFuji ? "bg-money" : "bg-amber-400"}`} aria-hidden="true" />
        <span className="min-w-0 truncate whitespace-nowrap text-xs border border-line px-1.5 py-0.5">{isFuji ? t.common.testnetBadge : t.wallet.switchNetwork}</span>
        <span>{shortAddress(address, 4)}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${dropdownOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        {(counts.activity > 0 || (activeProfile === "organizer" && myApp.isRevoked)) && (
          <span
            aria-label={myApp.isRevoked ? (locale === "vi" ? "Cảnh báo quyền ví" : "Wallet role alert") : fmt(t.wallet.newNotifications, { count: counts.activity })}
            className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-bg ${myApp.isRevoked ? "bg-destructive animate-pulse" : "bg-primary"}`}
          />
        )}
      </button>
      {dropdownOpen && createPortal(
        <div ref={panel} style={{ "--profile-top": `${position.top}px`, "--profile-right": `${position.right}px` } as React.CSSProperties}
          onKeyDown={event => { if (event.key === "Escape") { setDropdownOpen(false); trigger.current?.focus(); } }}
          id={menuId} role="dialog" aria-label={t.wallet.profile} className="fixed right-[var(--profile-right)] top-[var(--profile-top)] z-50 w-[352px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-var(--profile-top)-1rem)] overflow-y-auto rounded-lg border border-line bg-bg p-4 font-mono text-xs text-foreground shadow-2xl">

          {/* Header: Avatar + Network + Role Status */}
          <div className="flex items-start gap-4">
            <button type="button" onClick={openAvatarPicker} aria-label={t.avatar.change}
              className="group relative shrink-0 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 ring-1 ring-line">
              <Avatar address={address} size={44} avatarId={avatar} />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Pencil className="h-3.5 w-3.5 text-white" aria-hidden="true" />
              </span>
            </button>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 font-mono text-xs text-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${isFuji ? "bg-money animate-pulse" : "bg-amber-400"}`} />
                  <span>{isFuji ? "Avalanche Fuji" : t.wallet.switchNetwork}</span>
                </div>
                <ExplorerLink address={address} iconOnly className="shrink-0 rounded-sm p-2 hover:bg-surface-2" />
              </div>
              {isPlatformOwner || activeProfile ? (
                <WalletRoleStatus
                  profile={isPlatformOwner ? "platform" : activeProfile!}
                  studentStatus={studentStatus}
                  organizerStatus={organizerStatus}
                  locale={locale}
                  onRetry={refetchWalletRoles}
                  isRevoked={activeProfile === "organizer" && myApp.isRevoked}
                />
              ) : (
                <p className="text-xs text-muted">{locale === "vi" ? "Chọn loại tài khoản để tiếp tục" : "Choose your account type to continue"}</p>
              )}
            </div>
          </div>

          {choosingProfile && (
            <WalletProfilePicker
              locale={locale}
              currentProfile={activeProfile}
              onSelect={(newProfile) => {
                selectProfile(newProfile);
              }}
            />
          )}

          {/* Address & Quick Copy Card */}
          <div className="my-4 flex min-h-10 items-center justify-between gap-2 rounded-sm bg-surface-2/40 px-3 py-2">
            <span className="font-mono text-xs text-foreground select-all" title={address}>
              {shortAddress(address, 4)}
            </span>
            <button
              type="button"
              onClick={copyAddress}
              aria-label={copied ? t.wallet.copied : t.common.copyAddress}
              title={copied ? t.wallet.copied : t.common.copyAddress}
              className="flex items-center gap-1 shrink-0 text-[11px] font-mono text-muted hover:text-foreground rounded-sm p-2 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-money" />
                  <span className="sr-only" role="status">{t.wallet.copied}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="sr-only">{t.common.copyAddress}</span>
                </>
              )}
            </button>
          </div>

          {/* Available Balances Card */}
          {(avax || tokenBalance.isEnabled) && (
            <div className="mb-4" aria-label={t.wallet.balance}>
              <div className="grid grid-cols-2 gap-2">
                {avax && (
                  <div className="min-w-0 space-y-2 rounded-sm border border-line/60 bg-surface/60 p-3">
                    <span className="text-[10px] text-muted font-mono tracking-wider block">AVAX</span>
                    <span className="font-mono text-lg font-semibold tabular-nums text-foreground block [overflow-wrap:anywhere]">
                      {Number(formatUnits(avax.value, avax.decimals)).toFixed(4)}
                    </span>
                  </div>
                )}
                <div className="min-w-0 space-y-2 rounded-sm border border-line/60 bg-surface/60 p-3">
                  <span className="text-[10px] text-muted font-mono tracking-wider block">USDC</span>
                  <span className={`font-mono font-semibold tabular-nums text-money block [overflow-wrap:anywhere] ${usdc !== undefined ? "text-lg" : "text-xs"}`}>
                    {usdc !== undefined
                      ? `${formatUsdcFixed(Number(formatUnits(usdc, 6)), { includeSymbol: false })}`
                      : tokenBalance.isError
                      ? t.tokenBalance.error
                      : tokenBalance.isLoading
                      ? t.tokenBalance.loading
                      : t.tokenBalance.unavailable}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeProfile === "organizer" && !isPlatformOwner && myApp.isRevoked && (
            <div className="mb-4 space-y-2 rounded-sm border border-red-500/40 bg-red-500/10 p-3">
              <p className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-red-400">
                <ShieldOff className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                <span>{locale === "vi" ? "Quyền Organizer đã bị thu hồi" : "Organizer access revoked"}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  setApplyModalOpen(true);
                }}
                className="flex min-h-8 items-center rounded-sm text-left text-[11px] font-medium text-red-400 hover:text-red-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-red-400 cursor-pointer"
              >
                {locale === "vi" ? "Xem chi tiết & Gửi yêu cầu lại" : "View details & Re-apply"}
              </button>
            </div>
          )}

          {/* Student Verification Callout (if not verified) */}
          {activeProfile === "student" && !isPlatformOwner && !isStudent && (
            <div className="mb-3 p-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/25 rounded-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    {locale === "vi" ? "Bạn là sinh viên?" : "Are you a student?"}
                  </h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-snug">
                    {locale === "vi"
                      ? "Xác thực email .edu để tham gia đóng góp và nhận quỹ đối ứng."
                      : "Verify university email to donate and match projects."}
                  </p>
                </div>
              </div>
              <Link
                href="/verify"
                onClick={() => setDropdownOpen(false)}
                className="mono-label block w-full py-1.5 px-3 text-center text-xs font-semibold bg-primary text-black hover:bg-primary-hover rounded-sm transition-colors cursor-pointer"
              >
                {locale === "vi" ? "Xác thực bằng email trường" : "Verify university email"}
              </Link>
            </div>
          )}

          {/* Navigation & Action Links */}
          <div className="space-y-0 border-t border-line pt-2">
            {isPlatformOwner && (
              <Link
                href="/admin?tab=platform"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center justify-between min-h-11 px-2 py-2 hover:bg-surface hover:text-foreground cursor-pointer transition-colors rounded-sm group"
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  {t.nav.platformDashboard}
                </span>
                <Badge variant="primary" className="text-[10px] px-1 py-0">Owner</Badge>
              </Link>
            )}

            {(isPlatformOwner || (activeProfile === "organizer" && (canCreateRound || isRoundAdmin || hasManagedRounds))) && (
              <Link
                href="/admin?tab=organizer"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center justify-between min-h-11 px-2 py-2 hover:bg-surface hover:text-foreground cursor-pointer transition-colors rounded-sm group"
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <Award className="h-3.5 w-3.5 text-warning" />
                  {t.nav.organizerDashboard}
                </span>
                <NotificationBadge count={counts.admin} />
              </Link>
            )}

            {activeProfile === "organizer" && !isPlatformOwner && !canCreateRound && !isRoundAdmin && !hasManagedRounds && isAdmin && (
              <Link
                href="/admin?tab=organizer"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center justify-between min-h-11 px-2 py-2 hover:bg-surface hover:text-foreground cursor-pointer transition-colors rounded-sm group"
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  {t.nav.organizerDashboard}
                </span>
                <NotificationBadge count={counts.admin} />
              </Link>
            )}

            {activeProfile === "organizer" && !isPlatformOwner && !isOrganizer && !myApp.isRevoked && (
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  setApplyModalOpen(true);
                }}
                className="w-full flex min-h-11 items-center justify-between gap-2 px-2 py-2 text-left hover:bg-surface hover:text-foreground text-foreground cursor-pointer transition-colors rounded-sm group"
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted" />
                  {t.applyOrganizer.btnMenu}
                </span>
                {myApp.isPending ? (
                  <Badge variant="warning" className="shrink-0 rounded-sm text-[10px] px-1.5 py-0 normal-case tracking-normal">
                    {t.applyOrganizer.statusPendingBadge}
                  </Badge>
                ) : (
                  <span className="shrink-0 text-[10px] text-muted font-mono">{locale === "vi" ? "Đăng ký" : "Apply"} &rarr;</span>
                )}
              </button>
            )}


            <Link
              href="/my"
              onClick={() => { counts.markAllSeen(); setDropdownOpen(false); }}
              className="flex items-center justify-between min-h-11 px-2 py-2 hover:bg-surface hover:text-foreground cursor-pointer transition-colors rounded-sm group"
            >
              <span className="flex items-center gap-2 text-xs font-medium">
                <User className="h-3.5 w-3.5 text-muted group-hover:text-foreground transition-colors" />
                {t.nav.my}
              </span>
              <NotificationBadge count={counts.activity} />
            </Link>
          </div>

          {/* Disconnect Button */}
          <div className="border-t border-line pt-2 mt-2">
            <button
              type="button"
              onMouseDown={() => console.log("[LOGOUT_DEBUG] Disconnect button onMouseDown")}
              onClick={() => {
                console.log("[LOGOUT_DEBUG] Disconnect button onClick");
                handleDisconnect();
              }}
              className="flex min-h-11 w-full items-center gap-2 py-2 px-2 text-xs text-muted hover:text-foreground hover:bg-surface cursor-pointer transition-colors rounded-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{t.nav.disconnect}</span>
            </button>
          </div>
        </div>, document.body
      )}
      {avatarPickerOpen && <AvatarPickerDialog key={address.toLowerCase()} address={address} onClose={closeAvatarPicker} />}
    </div>
    {address && activeProfile === "organizer" && !isPlatformOwner && (
      <ApplyOrganizerModal
        isOpen={applyModalOpen}
        onClose={closeApplyModal}
        walletAddress={address}
        isOrganizer={isOrganizer}
        isPlatformOwner={isPlatformOwner}
      />
    )}
  </>
  );
}
