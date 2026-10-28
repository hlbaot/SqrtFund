"use client";
import Link from "next/link";
import { useBalance, useAccount, useSwitchChain } from "wagmi";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { useLocale } from "@/lib/context/locale";
import { Button } from "@/components/ui/Button";
/** Gas availability is a prerequisite, not a promise that a nonzero balance covers every fee. */
export function ContributionGuide({
  student,
  eligible,
  balanceReady,
  sufficient,
  blocked,
  checkingAccess = false,
  accessError = false,
}: {
  checkingAccess?: boolean;
  accessError?: boolean;
  student: boolean;
  eligible: boolean;
  balanceReady: boolean;
  sufficient: boolean;
  blocked?: string;
}) {
  const { address, chainId, isConnected } = useAccount();
  const connected = Boolean(isConnected && address);
  const { locale } = useLocale();
  const vi = locale === "vi";
  const { switchChain, isPending } = useSwitchChain();
  const gas = useBalance({
    address,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: connected, refetchInterval: 15000 },
  });
  const steps = [
    {
      done: connected,
      text: vi ? "Kết nối ví Core" : "Connect your Core wallet",
    },
    {
      done: connected && chainId === TARGET_CHAIN_ID,
      text: vi ? "Kết nối mạng Avalanche Fuji" : "Connect to Avalanche Fuji",
    },
    {
      done: connected && student,
      text: vi
        ? "Xác thực email và ví Student"
        : "Verify your email and Student wallet",
    },
    {
      done: connected && eligible,
      text: vi ? "Được phép tham gia round này" : "Be eligible for this round",
    },
    {
      done: connected && balanceReady && sufficient,
      text: vi
        ? "Có đủ MockUSDC cho khoản góp đã chọn"
        : "Have enough MockUSDC for your chosen contribution",
    },
    {
      done:
        connected && typeof gas.data?.value === "bigint" && gas.data.value > 0n,
      text: vi
        ? "Có AVAX thử nghiệm để trả phí giao dịch"
        : "Have test AVAX for transaction fees",
    },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <section
      aria-label={vi ? "Các bước đóng góp" : "Contribution checklist"}
      className="my-4 border border-line bg-bg p-3 space-y-3"
    >
      <h3 className="text-sm font-semibold">
        {vi ? "Để đóng góp, bạn cần" : "Before contributing"}
      </h3>
      <ol className="space-y-2 text-xs">
        {steps.map((step, i) => (
          <li
            key={step.text}
            aria-current={i === next ? "step" : undefined}
            className={step.done ? "text-money" : "text-muted"}
          >
            {step.done ? "✓" : `${i + 1}.`} {step.text}
            {i === next ? (vi ? " — bước tiếp theo" : " — next step") : ""}
          </li>
        ))}
      </ol>
      {!connected ? (
        <p className="text-xs">
          {vi
            ? "Kết nối ví bằng nút bên dưới để bắt đầu. Bước này chưa gửi giao dịch hay chuyển tiền."
            : "Use the wallet button below to get started. Connecting does not submit a transaction or transfer funds."}
        </p>
      ) : chainId !== TARGET_CHAIN_ID ? (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
        >
          {vi ? "Chuyển sang Fuji" : "Switch to Fuji"}
        </Button>
      ) : checkingAccess || accessError ? (
        <p role="status" className="text-xs">
          {checkingAccess
            ? vi
              ? "Đang kiểm tra quyền Student và điều kiện round…"
              : "Checking Student and round eligibility…"
            : vi
              ? "Chưa đọc được quyền tham gia; hãy tải lại dữ liệu trước khi xác thực hoặc liên hệ người tổ chức."
              : "Participation status is unavailable. Retry loading before verifying or contacting the organizer."}
        </p>
      ) : !student ? (
        <Link href="/verify" className="text-sm text-primary underline">
          {vi ? "Bắt đầu xác thực" : "Start verification"}
        </Link>
      ) : !eligible ? (
        <p className="text-xs">
          {vi
            ? "Liên hệ người tổ chức để kiểm tra whitelist của round; xác thực Student không tự cấp quyền vào mọi round."
            : "Ask the organizer to check this round's whitelist; Student verification does not grant access to every round."}
        </p>
      ) : !balanceReady ? (
        <p role="status" className="text-xs">
          {vi
            ? "Chưa đọc được số dư MockUSDC. Hãy thử tải lại dữ liệu."
            : "MockUSDC balance is unavailable. Retry loading the data."}
        </p>
      ) : !sufficient ? (
        <Link href="/my#claim-usdc" className="text-sm text-primary underline">
          {vi
            ? "Nhận MockUSDC thử nghiệm tại Dashboard"
            : "Get test MockUSDC in your dashboard"}
        </Link>
      ) : null}
      {connected && gas.isLoading && (
        <p role="status" className="text-xs">
          {vi
            ? "Đang đọc số dư AVAX Fuji; chưa xác định đủ phí."
            : "Loading the Fuji AVAX balance; gas availability is unknown."}
        </p>
      )}
      {connected && gas.isError && (
        <p className="text-xs">
          {vi
            ? "Chưa đọc được số dư AVAX; chưa thể xác nhận bạn đủ phí."
            : "Unable to read your AVAX balance; gas availability is unknown."}
        </p>
      )}
      {connected && gas.data?.value === 0n && (
        <a
          href="https://core.app/tools/testnet-faucet/"
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-primary underline"
        >
          {vi
            ? "Nhận AVAX Fuji thử nghiệm qua faucet Core"
            : "Get Fuji test AVAX through the Core faucet"}
        </a>
      )}
      {blocked && (
        <p role="status" className="text-xs text-primary">
          {blocked}
        </p>
      )}
      <p className="text-xs text-muted">
        {vi
          ? "Khi sẵn sàng: nhập số tiền → phê duyệt MockUSDC nếu ví yêu cầu → xác nhận đóng góp. Số dư AVAX dương chưa bảo đảm đủ mọi mức phí."
          : "When ready: enter an amount → approve MockUSDC if required → confirm your contribution. A positive AVAX balance does not guarantee every transaction fee is covered."}
      </p>
    </section>
  );
}

/** Visible mobile entry point; it does not require a connected wallet. */
export function ContributionOverview({
  onOpen,
  expanded,
}: {
  onOpen: () => void;
  expanded: boolean;
}) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const steps = vi
    ? [
        "Kết nối ví Core",
        "Chuyển sang Avalanche Fuji",
        "Xác thực Student và quyền tham gia round",
        "Chuẩn bị MockUSDC và AVAX thử nghiệm",
        "Nhập số tiền, phê duyệt nếu cần và xác nhận đóng góp",
      ]
    : [
        "Connect your Core wallet",
        "Switch to Avalanche Fuji",
        "Verify Student status and round eligibility",
        "Prepare MockUSDC and test AVAX",
        "Enter an amount, approve if needed and confirm the contribution",
      ];
  return (
    <section
      className="lg:hidden space-y-3 border border-line bg-surface p-4"
      aria-label={
        vi ? "Hướng dẫn đóng góp cho người mới" : "New contributor guide"
      }
    >
      <h2 className="font-semibold">
        {vi ? "Bạn mới tham gia? Bắt đầu từ đây" : "New here? Start here"}
      </h2>
      <ol className="list-inside list-decimal space-y-1 text-sm text-muted">
        {steps.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        {vi
          ? "Khung đóng góp sẽ kiểm tra ví của bạn và chỉ rõ bước còn thiếu. Ví chủ dự án không tự góp cho dự án của mình."
          : "The contribution panel checks your wallet and explains what is missing. Owners cannot contribute to their own project."}
      </p>
      <Button
        onClick={onOpen}
        aria-expanded={expanded}
        aria-controls="mobile-contribution-panel"
      >
        {vi ? "Mở hướng dẫn và đóng góp" : "Open guide and contribute"}
      </Button>
    </section>
  );
}
