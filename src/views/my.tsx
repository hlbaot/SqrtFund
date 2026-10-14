"use client";

import { useTxFlow } from "@/hooks/useTxFlow";

import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi, mockUsdcAbi } from "@/lib/contracts/abis";
import { usdcAddress } from "@/lib/contracts/addresses";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRole } from "@/hooks/useRole";
import { useClaim } from "@/hooks/useClaim";
import { formatUsdc } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarPickerDialog } from "@/components/layout/AvatarPickerDialog";
import { useAvatar } from "@/hooks/useAvatar";
import { EmptyState } from "@/components/common/EmptyState";
import { MyActivitySkeleton } from "@/components/common/PageSkeletons";
import { Container } from "@/components/layout/Container";
import {
  Check,
  Coins,
  FolderKanban,
  Pencil,
  User,
  ShieldCheck,
  ExternalLink,
  Droplets,
} from "lucide-react";

export function MyView() {
  const beginFlow = useTxFlow();
  const router = useRouter();
  const { t, locale } = useLocale();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { roundAddress, finalized, isLoading: isRoundLoading } = useRound();
  const { projects, isLoading: isProjectsLoading, refetch: refetchProjects } = useProjects();
  const { isStudent, hasRequested } = useRole();
  const { claim, isPending: isClaimPending } = useClaim();

  const [activeTab, setActiveTab] = useState("donations");
  const [isMintingFaucet, setIsMintingFaucet] = useState(false);

  const { avatar } = useAvatar(address);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const closeAvatarDialog = useCallback(() => setIsAvatarDialogOpen(false), []);
  const handleOpenAvatarDialog = () => setIsAvatarDialogOpen(true);

  // Read donations for all projects via multicall
  const approvedProjects = useMemo(() => projects.filter((p) => p.approved), [projects]);

  const donationContracts = useMemo(() => {
    if (!roundAddress || !address) return [];
    return approvedProjects.map((p) => ({
      address: roundAddress,
      abi: qfRoundAbi,
      functionName: "donationOf" as const,
      args: [address, p.contractId] as const,
    }));
  }, [roundAddress, address, approvedProjects]);

  const { data: donationsData, isLoading: isDonationsLoading } = useReadContracts({
    contracts: donationContracts,
    query: {
      enabled: Boolean(donationContracts.length > 0),
      refetchInterval: 5000,
    },
  });

  const myDonations = useMemo(() => {
    if (!donationsData) return [];
    const list: { project: (typeof approvedProjects)[0]; amount: bigint; amountNum: number; }[] = [];
    for (let i = 0; i < donationsData.length; i++) {
      const amt = donationsData[i]?.result as bigint | undefined;
      if (amt && amt > 0n) {
        list.push({
          project: approvedProjects[i],
          amount: amt,
          amountNum: Number(amt) / 1_000_000,
        });
      }
    }
    return list;
  }, [donationsData, approvedProjects]);

  // Filter projects owned by the user
  const myProjects = useMemo(() => {
    if (!address) return [];
    const addr = address.toLowerCase();
    return projects.filter((p) => p.ownerAddress.toLowerCase() === addr);
  }, [projects, address]);

  // Faucet Mint
  const handleFaucetMint = async () => {
    const flow = beginFlow();
    if (!address || !publicClient) return;
    const toastId = "faucet-mint";
    setIsMintingFaucet(true);
    try {
      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang yêu cầu USDC thử nghiệm..." : "Requesting test USDC...",
        locale === "vi" ? "Đang nhận 100 USDC từ faucet Fuji." : "Minting 100 USDC from Fuji faucet."
      );

      const hash = await flow.wait(() => writeContractAsync({
        address: usdcAddress,
        abi: mockUsdcAbi,
        functionName: "faucetMint",
      }));

      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang xác nhận nhận USDC..." : "Confirming faucet mint...",
        locale === "vi" ? "Đang chờ xác nhận khối trên Avalanche Fuji." : "Waiting for block confirmation on Avalanche Fuji.",
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("faucetMint transaction reverted.");
      }

      flow.toast.success(
        toastId,
        locale === "vi" ? "Đã nhận 100 USDC!" : "100 USDC received!",
        locale === "vi" ? "USDC testnet đã được cộng vào ví của bạn." : "Testnet USDC has been credited to your wallet.",
        hash
      );
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        locale === "vi" ? "Yêu cầu faucet thất bại" : "Faucet request failed",
        locale
      );
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsMintingFaucet(false);
      }
    }
  };

  const handleClaim = async (projectId: bigint) => {
    const ok = await claim(projectId);
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
            Wallet Connection Required
          </h1>
          <p className="text-sm text-muted">
            Connect your wallet to view your quadratic donations, manage your projects, or claim grant allocations.
          </p>
        </div>
      </Container>
    );
  }

  if (isRoundLoading || isProjectsLoading) {
    return (
      <Container className="py-8 sm:py-10">
        <MyActivitySkeleton />
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-10 space-y-8">
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
                className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-foreground hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary transition-transform hover:scale-110"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  Wallet Activity
                </h1>
                {isStudent ? (
                  <Badge variant="accent" className="gap-1 font-semibold text-[11px]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Verified Student</span>
                  </Badge>
                ) : hasRequested ? (
                  <Badge variant="warning" className="text-[11px]">
                    Verification Pending
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px]">
                    Unverified
                  </Badge>
                )}
              </div>
              <p className="font-mono text-xs text-muted">
                {address ? address : "Not connected"}
              </p>
            </div>
          </div>

          {/* Test Faucets & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="accent"
              size="sm"
              id="claim-usdc"
              onClick={handleFaucetMint}
              disabled={isMintingFaucet}
              isLoading={isMintingFaucet}
              className="text-xs font-bold gap-1.5"
            >
              <Droplets className="h-3.5 w-3.5" />
              <span>Get 100 test USDC</span>
            </Button>
            <a
              href="https://faucet.avax.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label inline-flex items-center gap-1 border border-line bg-surface-2 px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-surface focus:outline-none"
            >
              <span>AVAX Faucet</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenAvatarDialog}
              className="text-xs font-semibold gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>{t.avatar.change}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs: My Donations & My Projects */}
      <div data-aos="fade-up" data-aos-duration="600">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="donations">{t.myActivity.tabDonations}</TabsTrigger>
            <TabsTrigger value="projects">{t.myActivity.tabProjects}</TabsTrigger>
          </TabsList>

          {/* Tab 1: My Donations */}
          <TabsContent value="donations">
            {isDonationsLoading ? (
              <div className="py-8 text-center text-xs text-muted">Loading your on-chain donation history...</div>
            ) : myDonations.length === 0 ? (
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
                    {myDonations.length} projects supported
                  </span>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.myActivity.colProject}</TableHead>
                      <TableHead>{t.myActivity.colAmount}</TableHead>
                      <TableHead>Project Matching Total</TableHead>
                      <TableHead className="text-right">Project Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myDonations.map((item) => (
                      <TableRow key={item.project.id}>
                        <TableCell className="font-medium text-foreground">
                          {item.project.name}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-money">
                          {formatUsdc(item.amountNum)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted">
                          +{formatUsdc(item.project.estimatedMatching)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/round/${roundAddress}/project/${item.project.id}`)}
                            className="h-7 text-xs font-semibold text-primary"
                          >
                            View
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
                actionLabel={t.myActivity.projectsEmptyCta}
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
                    {myProjects.length} registered
                  </span>
                </div>

                <div className="divide-y divide-line">
                  {myProjects.map((proj) => {
                    const totalPayout = proj.totalDonated + proj.estimatedMatching;

                    return (
                      <div
                        key={proj.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5"
                      >
                        <div className="space-y-1.5 max-w-md">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground text-base">
                              {proj.name}
                            </h3>
                            <Badge
                              variant={proj.approved ? "accent" : "warning"}
                            >
                              {proj.approved
                                ? t.myActivity.statusApproved
                                : t.myActivity.statusPending}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted line-clamp-1">
                            {proj.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs font-mono text-muted pt-1">
                            <span>{proj.supporterCount} supporters</span>
                            <span>•</span>
                            <span>Raised: {formatUsdc(proj.totalDonated)}</span>
                          </div>
                        </div>

                        {/* Financial payout & claim button */}
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="block text-[11px] text-muted">
                              {t.myActivity.estimatedPayout}
                            </span>
                            <span className="font-mono text-lg font-black text-money">
                              {formatUsdc(totalPayout)}
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
                                  disabled={!finalized || !proj.approved || isClaimPending}
                                  isLoading={isClaimPending}
                                  onClick={() => handleClaim(proj.contractId)}
                                  className="font-bold text-xs"
                                >
                                  {t.myActivity.claimButton}
                                </Button>

                                {!finalized && (
                                  <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-20 w-52 border border-line-strong bg-bg p-2 text-center text-[11px] text-muted">
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
      </div>

      {isAvatarDialogOpen && address && <AvatarPickerDialog key={address.toLowerCase()} address={address} onClose={closeAvatarDialog} />}
    </Container>
  );
}
