"use client";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import type { Project } from "@/types";
import { useClaim } from "@/hooks/useClaim";
import { useLocale } from "@/lib/context/locale";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { projectFunding } from "@/lib/projectFunding";
import { formatUsdcFixed } from "@/lib/format";
import { Button } from "@/components/ui/Button";
export function ProjectClaimPanel({
  project,
  round,
  finalized,
  cancelled,
  onClaimed,
}: {
  project: Project & { claimed?: boolean };
  round?: Address;
  finalized: boolean;
  cancelled: boolean;
  onClaimed: () => void;
}) {
  const { address, chainId, isConnected } = useAccount();
  const { locale } = useLocale();
  const vi = locale === "vi";
  const { claim, isPending } = useClaim();
  const total = projectFunding(project, finalized, cancelled).total;
  const owner =
    isConnected &&
    address?.toLowerCase() === project.ownerAddress.toLowerCase();
  if (cancelled) return null;
  const reason = project.claimed
    ? vi
      ? "Chủ dự án đã nhận tiền. Hãy đăng cập nhật sử dụng tiền trong hồ sơ bên trên."
      : "The owner has received the funds. Publish a spending update in the proposal above."
    : !finalized
      ? vi
        ? "Chưa thể nhận tiền: round chưa được chốt kết quả."
        : "Funds cannot be claimed until the round is finalized."
      : project.status !== "approved"
        ? vi
          ? "Dự án chưa được duyệt nên không thể nhận tiền."
          : "This project is not approved and cannot claim funds."
        : total === undefined
          ? vi
            ? "Chưa đọc được matching đã chốt; hãy tải lại dữ liệu."
            : "Settled matching is unavailable; reload the data."
          : total === 0
            ? vi
              ? "Dự án không có khoản tiền để nhận."
              : "There are no funds to claim."
            : !owner
              ? vi
                ? isConnected
                  ? "Chỉ ví chủ dự án có thể nhận khoản tiền này."
                  : "Kết nối ví chủ dự án để nhận tiền."
                : isConnected
                  ? "Only the project owner's wallet can claim these funds."
                  : "Connect the project owner's wallet to claim funds."
              : chainId !== TARGET_CHAIN_ID
                ? vi
                  ? "Chuyển ví sang Avalanche Fuji để nhận tiền."
                  : "Switch to Avalanche Fuji to claim the funds."
                : undefined;
  return (
    <section
      id="claim"
      className="scroll-mt-24 space-y-2 border border-money/40 p-4"
    >
      <h2 className="font-semibold">
        {vi ? "Nhận tiền tài trợ (claim)" : "Receive project funding (claim)"}
      </h2>
      {reason ? (
        <p role="status" className="text-sm text-muted">
          {reason}
        </p>
      ) : (
        <>
          <p className="text-sm">
            {vi ? "Bạn có thể nhận" : "You can claim"} {formatUsdcFixed(total!)}{" "}
            —{" "}
            {vi
              ? "gồm tiền góp trực tiếp và matching đã chốt."
              : "direct contributions plus settled matching."}
          </p>
          <Button
            disabled={isPending || !round}
            isLoading={isPending}
            onClick={async () => {
              if (
                round &&
                owner &&
                chainId === TARGET_CHAIN_ID &&
                (await claim(BigInt(project.id), round))
              )
                onClaimed();
            }}
          >
            {vi
              ? "Nhận tiền về ví chủ dự án"
              : "Claim to the project owner's wallet"}
          </Button>
        </>
      )}
    </section>
  );
}
