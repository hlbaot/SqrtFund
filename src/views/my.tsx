"use client";
import type { Address } from "viem";
import { projectsStore } from "@/lib/store/projectsStore";
import { roundsStore } from "@/lib/store/roundsStore";
import { useShallow } from "zustand/react/shallow";
import { RoundCancellationPanel } from "@/components/round/RoundCancellationPanel";
import { StudentVerifyBox } from "@/components/verify/DeferredStudentVerifyBox";

import { AOSInit } from "@/components/common/AOSInit";

import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useWalletDonationHistory } from "@/hooks/useWalletDonationHistory";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRole } from "@/hooks/useRole";
import { useWalletProfile, defaultWalletProfile } from "@/hooks/useWalletProfile";
import { useAdminRounds } from "@/hooks/useAdminRounds";
import { useClaim } from "@/hooks/useClaim";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { formatUsdcFixed, formatCooldown, shortAddress } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import dynamic from "next/dynamic";
import { useAvatar } from "@/hooks/useAvatar";
import { EmptyState } from "@/components/common/EmptyState";
import { MyActivitySkeleton } from "@/components/common/PageSkeletons";
import { Container } from "@/components/layout/Container";
import { ExplorerLink } from "@/components/tx/ExplorerLink";
const AvatarPickerDialog = dynamic(() => import("@/components/layout/AvatarPickerDialog").then(module => module.AvatarPickerDialog), { ssr: false });
import {
  Check,
  Coins,
  FolderKanban,
  Pencil,
  User,
  ShieldCheck,
  ExternalLink,
  Droplets,
  Clock,
  Layers,
  Settings,
  Plus,
} from "lucide-react";

export function MyView() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const now = useCurrentTimestamp();
  const { address, isConnected } = useAccount();

  const { roundAddress, isCancelled, isLoading: isRoundLoading } = useRound();
  const { projects, isLoading: isProjectsLoading, refetch: refetchProjects } = useProjects();
  const {
    isStudent,
    isOrganizer,
    isPlatformOwner,
    canCreateRound,
    isRoundAdmin,
    role,
    isReady,
  } = useRole();
  useNotificationCounts(isReady ? role : "guest", { markViewed: true });

  const { chainId } = useAccount();
  const isOrgRole = isOrganizer || isPlatformOwner || isRoundAdmin || canCreateRound;
  const { profile } = useWalletProfile(
    address,
    chainId,
    defaultWalletProfile(isOrgRole, isStudent)
  );
  const isOrgMode = profile === "organizer" || (!isStudent && isOrgRole) || (!profile && isOrgRole);

  const managedRounds = useAdminRounds(isOrgMode && address ? address : undefined);
  const {
    canClaim,
    nextClaimAt,
    remainingSeconds,
    cooldownDuration,
    isClaiming,
    claim,
    isPending: isClaimPending,
  } = useClaim();

  const [activeTab, setActiveTab] = useState(isOrgMode ? "projects" : "donations");

  const { avatar } = useAvatar(address);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const closeAvatarDialog = useCallback(() => setIsAvatarDialogOpen(false), []);
  const handleOpenAvatarDialog = () => setIsAvatarDialogOpen(true);

  const { donations: myDonations, isLoading: isDonationsLoading, isError: isDonationsError, refetch: refetchDonations } = useWalletDonationHistory();

  const allProjects = projectsStore(useShallow(state => state.projectsByRound));
  const roundSnapshots = roundsStore(useShallow(state => state.entities));
  // Filter projects owned by the user
  const myProjects = useMemo(() => {
    if (!address) return [];
    const addr = address.toLowerCase();
    return Object.values(allProjects).flat().filter((p) => p.ownerAddress.toLowerCase() === addr);
  }, [allProjects, address]);

  const remainingMinutes = Math.floor(remainingSeconds / 60);

  const handleClaim = async (projectId: bigint, targetRound: Address) => {
    const ok = await claim(projectId, targetRound);
    if (ok) {
      refetchProjects();
    }
  };

  if (!isConnected || !address) {
    return (
      <Container className="py-8 sm:py-10">
        <div className="mx-auto max-w-xl py-16 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
            <User className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            {t.common.walletRequired}
          </h1>
          <p className="text-sm text-muted">
            {t.common.walletRequiredDesc}
          </p>
        </div>
      </Container>
    );
  }

  if (isRoundLoading || isProjectsLoading) {
    return (
      <Container className="py-8 sm:py-10">
        <AOSInit />
        <StudentVerifyBox />
        <MyActivitySkeleton />
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-10 space-y-8">
      <AOSInit />
      <StudentVerifyBox />
      {/* User Profile Header with Change Avatar Feature */}
      <div
        className="border border-line bg-surface p-6"
        data-aos="fade-down"
        data-aos-duration="600"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {/* Avatar with edit button */}
            <div className="relative group shrink-0">
              <Avatar address={address} size={64} avatarId={avatar} />

              {/* Avatar edit button */}
              <button
                type="button"
                onClick={handleOpenAvatarDialog}
                aria-label={t.avatar.change}
                title={t.avatar.change}
                className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-foreground hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer transition-transform hover:scale-110 active:scale-95"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {t.common.walletActivity}
                </h1>
                {isStudent && (
                  <Badge variant="accent" className="gap-1 font-semibold text-xs">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{t.common.verifiedStudent}</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Test Faucets & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {canClaim ? (
              <Button
                variant="accent"
                size="sm"
                id="claim-usdc"
                onClick={() => void claim()}
                disabled={isClaiming}
                isLoading={isClaiming}
                className="text-xs font-bold gap-1.5"
              >
                <Droplets className="h-3.5 w-3.5" />
                <span>{isClaiming ? t.faucet.claiming : t.faucet.getTestUsdc}</span>
              </Button>
            ) : (
              <div className="relative inline-flex flex-col">
                <button
                  type="button"
                  id="claim-usdc"
                  disabled
                  aria-disabled="true"
                  aria-label={`${t.faucet.nextClaimIn} ${formatCooldown(remainingSeconds)}`}
                  title={`${t.faucet.claimAgainAt} ${nextClaimAt > 0 ? new Date(nextClaimAt * 1000).toLocaleTimeString() : ""}`}
                  className="mono-label tabular-mono inline-flex items-center gap-1.5 border border-line bg-surface px-3 py-1.5 text-xs text-muted cursor-not-allowed select-none transition-colors"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="font-bold">{t.faucet.nextClaimIn.toUpperCase()}</span>
                  <span className="font-bold text-foreground tabular-nums">{formatCooldown(remainingSeconds)}</span>
                </button>
                <div
                  className="h-0.5 w-full bg-line overflow-hidden mt-0.5 rounded-full"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-primary/70 transition-all duration-1000"
                    style={{
                      width: `${cooldownDuration > 0 ? Math.min(100, Math.max(0, ((cooldownDuration - remainingSeconds) / cooldownDuration) * 100)) : 0}%`,
                    }}
                  />
                </div>
                <span className="sr-only" aria-live="polite">
                  {remainingMinutes > 0 ? t.common.minutesRemaining.replace("{count}", String(remainingMinutes)) : ""}
                </span>
              </div>
            )}
            <a
              href="https://faucet.avax.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label inline-flex items-center gap-1 border border-line bg-surface-2 px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-surface cursor-pointer transition-colors active:scale-[0.98] focus:outline-none"
            >
              <span>AVAX Faucet</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            {isOrgMode && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/admin?tab=organizer&action=create")}
                className="text-xs font-bold gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.myActivity.createRound}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {isCancelled && <RoundCancellationPanel projectNames={Object.fromEntries(projects.map(project => [project.id, project.name]))} roundAddress={roundAddress} />}

      {/* Organizer: Vòng gọi vốn của tôi (Không có tab donate) / Student: Tabs Ủng hộ & Dự án */}
      <div data-aos="fade-up" data-aos-duration="600">
        {isOrgMode ? (
          managedRounds.isLoading ? (
            <div className="py-8 text-center text-xs text-muted">
              {t.common.loading}
            </div>
          ) : managedRounds.rounds.length === 0 ? (
            <EmptyState
              title={t.myActivity.roundsEmptyTitle}
              description={t.myActivity.roundsEmptyDesc}
              actionLabel={t.myActivity.roundsEmptyCta}
              onAction={() => router.push("/admin?tab=organizer&action=create")}
              icon={<Layers className="h-6 w-6 text-muted" />}
            />
          ) : (
            <div className="border border-line bg-surface p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {t.myActivity.tabRounds}
                  </h2>
                  <span className="font-mono text-xs text-muted">
                    {t.common.registered.replace("{count}", String(managedRounds.rounds.length))}
                  </span>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push("/admin?tab=organizer&action=create")}
                  className="text-xs font-bold gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t.myActivity.createRound}</span>
                </Button>
              </div>

              <div className="divide-y divide-line">
                {managedRounds.rounds.map((rnd) => (
                  <div
                    key={rnd.address}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5"
                  >
                    <div className="space-y-1.5 max-w-md">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground text-base">
                          {rnd.name || shortAddress(rnd.address)}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-muted">
                        <span>{rnd.address}</span>
                        <ExplorerLink address={rnd.address} iconOnly />
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/round/${rnd.address}`)}
                        className="text-xs font-semibold gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>{t.myActivity.viewRound}</span>
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => router.push(`/admin?tab=organizer&round=${rnd.address}`)}
                        className="text-xs font-bold gap-1.5"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>{t.myActivity.manageRound}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="donations">{t.myActivity.tabDonations}</TabsTrigger>
              <TabsTrigger value="projects">{t.myActivity.tabProjects}</TabsTrigger>
            </TabsList>

            {/* Tab 1: My Donations */}
            <TabsContent value="donations">
              {isDonationsError && <div role="alert" className="mb-4 space-y-2 border border-primary/40 bg-surface p-4 text-sm">
                <p>{locale === "vi" ? "Chưa tải đủ lịch sử ủng hộ của tất cả các vòng. Vui lòng thử lại." : "Donation history is incomplete. Some rounds could not be loaded. Please retry."}</p>
                <Button variant="secondary" size="sm" onClick={refetchDonations}>{locale === "vi" ? "Thử lại" : "Retry"}</Button>
              </div>}
              {isDonationsLoading ? (
                <div className="py-8 text-center text-xs text-muted">{t.common.loadingDonations}</div>
              ) : myDonations.length === 0 && isDonationsError ? null : myDonations.length === 0 ? (
                <EmptyState
                  title={t.myActivity.donationsEmptyTitle}
                  description={t.myActivity.donationsEmptyDesc}
                  actionLabel={t.myActivity.donationsEmptyCta}
                  onAction={() => router.push("/#projects-list")}
                  icon={<Coins className="h-6 w-6 text-muted" />}
                />
              ) : (
                <div className="border border-line bg-surface p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-foreground">
                      {t.myActivity.tabDonations}
                    </h2>
                    <span className="font-mono text-xs text-muted">
                      {t.common.projectsSupported.replace("{count}", String(myDonations.length))}
                    </span>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="role-label">{t.myActivity.colProject}</TableHead>
                        <TableHead className="role-label">{t.myActivity.colAmount}</TableHead>
                        <TableHead className="role-label">{t.common.projectMatchingTotal}</TableHead>
                        <TableHead className="text-right role-label">{t.common.projectDetails}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myDonations.map((item) => (
                        <TableRow key={`${item.roundAddress}:${item.project.id}`}>
                          <TableCell className="font-medium text-foreground">
                            {item.project.name}
                            <div className="mt-1 text-xs text-muted" title={item.roundAddress}>
                              {shortAddress(item.roundAddress)} · {item.isCancelled ? (locale === "vi" ? "Đã hủy" : "Cancelled") : item.finalized || now > 0 && BigInt(now) >= item.endTime ? (locale === "vi" ? "Đã kết thúc" : "Ended") : (locale === "vi" ? "Đang mở" : "Open")}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-money tabular-nums">
                            {formatUsdcFixed(Number(item.amount) / 1_000_000)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted tabular-nums">
                            {item.project.matching === undefined ? "—" : `+${formatUsdcFixed(Number(item.project.matching) / 1_000_000)}`}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/round/${item.roundAddress}/project/${item.project.id}`)}
                              className="h-7 text-xs font-semibold text-primary"
                            >
                              {t.common.view}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Tab 2: My Projects */}
            <TabsContent value="projects">
              {myProjects.length === 0 ? (
                <EmptyState
                  title={t.myActivity.projectsEmptyTitle}
                  description={t.myActivity.projectsEmptyDesc}
                  actionLabel={isCancelled ? undefined : t.myActivity.projectsEmptyCta}
                  onAction={() => router.push("/register")}
                  icon={<FolderKanban className="h-6 w-6 text-muted" />}
                />
              ) : (
                <div className="border border-line bg-surface p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-foreground">
                      {t.myActivity.tabProjects}
                    </h2>
                    <span className="font-mono text-xs text-muted">
                      {t.common.registered.replace("{count}", String(myProjects.length))}
                    </span>
                  </div>

                  <div className="divide-y divide-line">
                    {myProjects.map((proj) => {
                      const projectRound = roundSnapshots[proj.roundId.toLowerCase()]?.fields;
                      const projectFinalized = projectRound?.results[8]?.result === true;
                      const projectCancelled = projectRound?.results[15]?.result === true;
                      const totalPayout = proj.totalDonated + (projectFinalized ? proj.finalMatching ?? 0 : proj.estimatedMatching);

                      return (
                        <div
                          key={`${proj.roundId}:${proj.id}`}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5"
                        >
                          <div className="space-y-1.5 max-w-md">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-foreground text-base">
                                {proj.name}
                              </h3>
                              <Badge
                                variant={proj.rejected ? "primary" : proj.approved ? "accent" : "warning"}
                              >
                                {proj.rejected ? t.rejection.status : proj.approved
                                  ? t.myActivity.statusApproved
                                  : t.myActivity.statusPending}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted line-clamp-1">
                              {proj.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs font-mono text-muted pt-1">
                              <span>{t.common.supporters_count.replace("{count}", String(proj.supporterCount))}</span>
                              <span>•</span>
                              <span>{t.common.raised.replace("{amount}", formatUsdcFixed(proj.totalDonated))}</span>
                            </div>
                          </div>

                          {/* Financial payout & claim button */}
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="block role-label text-muted">
                                {projectFinalized ? (locale === "vi" ? "Khoản nhận đã chốt" : "Final payout") : t.myActivity.estimatedPayout}
                              </span>
                              <span className="role-value-md text-money block">
                                {projectFinalized && proj.finalMatching === undefined ? "—" : formatUsdcFixed(totalPayout)}
                              </span>
                            </div>

                            {/* Claim Button */}
                            <div>
                              {proj.claimed ? (
                                <Badge variant="accent" className="px-3 py-1.5 text-xs font-bold">
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  {t.myActivity.claimedBadge}
                                </Badge>
                              ) : (
                                <div className="relative group">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={projectCancelled || proj.rejected || !projectFinalized || !proj.approved || isClaimPending}
                                    isLoading={isClaimPending}
                                    onClick={() => handleClaim(proj.contractId, proj.roundId as Address)}
                                    className="font-bold text-xs"
                                  >
                                    {t.myActivity.claimButton}
                                  </Button>

                                  {!projectFinalized && (
                                    <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-20 w-52 border border-line-strong bg-bg p-2 text-center text-xs text-muted">
                                      {t.myActivity.claimDisabledTooltip}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {isAvatarDialogOpen && address && <AvatarPickerDialog key={address.toLowerCase()} address={address} onClose={closeAvatarDialog} />}
    </Container>
  );
}
