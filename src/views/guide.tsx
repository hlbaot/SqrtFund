"use client";
import Link from "next/link";
import { useAccount, useSwitchChain } from "wagmi";
import { useLocale } from "@/lib/context/locale";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { Container } from "@/components/layout/Container";
import { ConnectWalletButton } from "@/components/layout/ConnectWalletButton";
import { Button } from "@/components/ui/Button";
export function GuideView() {
  const { locale } = useLocale(),
    vi = locale === "vi";
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  const steps = vi
    ? [
        {
          title: "Kết nối ví Core",
          body: "Dùng nút Kết nối ví. Kết nối chỉ cho ứng dụng biết địa chỉ ví; chưa chuyển tiền hoặc gửi giao dịch.",
        },
        {
          title: "Chuyển sang Avalanche Fuji",
          body: "SqrtFund dùng mạng thử nghiệm Fuji (chain ID 43113). Chuyển đúng mạng trước khi xác thực hoặc đóng góp.",
        },
        {
          title: "Xác thực email và ví Student",
          body: "Mở trang Xác thực, ký chứng minh quyền ví, nhận OTP qua email rồi xác nhận theo hướng dẫn. Chính sách MVP hiện nhận email .edu/.edu.vn; OTP chỉ chứng minh quyền truy cập hộp thư.",
        },
        {
          title: "Chọn round và kiểm tra quyền tham gia",
          body: "Chọn round đang mở và một dự án đã được duyệt. Một số round cần whitelist riêng: nếu bị từ chối, liên hệ người tổ chức. Ví chủ dự án không tự góp cho dự án của mình; tài khoản Organizer không tham gia đóng góp.",
        },
        {
          title: "Chuẩn bị MockUSDC và AVAX thử nghiệm",
          body: "Nhận MockUSDC qua Faucet trong Hoạt động của tôi; AVAX Fuji dùng để trả phí. Đây là token thử nghiệm. Khung đóng góp sẽ kiểm tra số dư theo số tiền bạn nhập.",
        },
        {
          title: "Nhập số tiền và xác nhận",
          body: "Trong Chi tiết dự án, mở khung đóng góp. Nếu allowance chưa đủ, ví yêu cầu phê duyệt MockUSDC trước, sau đó xác nhận giao dịch đóng góp. Có thể góp thêm trong trần cộng dồn và ngân sách round; một ví vẫn chỉ tính một supporter trên mỗi dự án.",
        },
      ]
    : [
        {
          title: "Connect your Core wallet",
          body: "Use Connect wallet. Connecting shares your wallet address; it does not transfer funds or submit a transaction.",
        },
        {
          title: "Switch to Avalanche Fuji",
          body: "SqrtFund uses the Fuji testnet (chain ID 43113). Switch to the correct network before verification or contributing.",
        },
        {
          title: "Verify your email and Student wallet",
          body: "Open Verify, prove wallet ownership by signing, receive an email OTP and follow the confirmation steps. The MVP accepts .edu/.edu.vn email addresses; OTP proves mailbox access only.",
        },
        {
          title: "Choose a round and check eligibility",
          body: "Choose an open round and an approved project. Some rounds require a separate whitelist: contact the organizer if you are not eligible. Project owners cannot self-donate; Organizer accounts cannot contribute.",
        },
        {
          title: "Prepare MockUSDC and test AVAX",
          body: "Get MockUSDC from the faucet in My activity; Fuji AVAX pays transaction fees. These are test tokens. The contribution panel checks your balance against the amount you enter.",
        },
        {
          title: "Enter an amount and confirm",
          body: "Open the contribution panel in Project details. If your allowance is insufficient, approve MockUSDC first, then confirm the contribution transaction. You may contribute again within cumulative caps and round budgets; one wallet still counts as one supporter per project.",
        },
      ];
  return (
    <Container className="space-y-6 py-8 sm:py-10">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {vi ? "Hướng dẫn đóng góp" : "Contribution guide"}
        </h1>
        <p className="text-sm text-muted">
          {vi
            ? "Bạn có thể đọc các bước này ngay cả khi chưa kết nối ví hoặc chưa có round đang mở. Khi chọn một dự án, khung đóng góp sẽ chỉ rõ bạn còn thiếu gì."
            : "Read these steps before connecting a wallet or while waiting for an open round. Once you select a project, its contribution panel explains exactly what is missing."}
        </p>
      </header>
      <ol className="grid gap-4 lg:grid-cols-2">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="space-y-3 border border-line bg-surface p-4"
          >
            <h2 className="flex items-start gap-3 text-base font-semibold">
              <span className="font-mono text-primary">{i + 1}.</span>
              {step.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted">{step.body}</p>
            {i === 0 && <ConnectWalletButton />}
            {i === 1 &&
              (isConnected ? (
                chainId === TARGET_CHAIN_ID ? (
                  <p className="text-sm text-money">
                    {vi ? "✓ Ví đang ở Fuji" : "✓ Wallet is on Fuji"}
                  </p>
                ) : (
                  <Button
                    disabled={isPending}
                    onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
                  >
                    {vi ? "Chuyển sang Fuji" : "Switch to Fuji"}
                  </Button>
                )
              ) : (
                <p className="text-xs text-muted">
                  {vi
                    ? "Kết nối ví ở bước 1 trước khi chuyển mạng."
                    : "Connect your wallet in step 1 before switching networks."}
                </p>
              ))}
            {i === 1 && error && (
              <p role="alert" className="text-xs text-primary">
                {vi
                  ? "Chưa chuyển được mạng. Hãy kiểm tra yêu cầu trong ví hoặc chuyển thủ công sang Fuji."
                  : "The network was not switched. Check the wallet request or select Fuji manually."}
              </p>
            )}
            {i === 2 && (
              <Link
                className="inline-block text-sm text-primary underline"
                href="/verify"
              >
                {vi ? "Mở trang xác thực" : "Open verification"}
              </Link>
            )}
            {i === 3 && (
              <Link
                className="inline-block text-sm text-primary underline"
                href="/round"
              >
                {vi ? "Xem các round" : "Browse rounds"}
              </Link>
            )}
            {i === 4 && (
              <div className="flex flex-wrap gap-4 text-sm text-primary underline">
                <Link href="/my#claim-usdc">
                  {vi ? "Faucet MockUSDC" : "MockUSDC faucet"}
                </Link>
                <a
                  href="https://core.app/tools/testnet-faucet/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {vi ? "Faucet AVAX Fuji" : "Fuji AVAX faucet"}
                </a>
              </div>
            )}
          </li>
        ))}
      </ol>
      <section className="space-y-2 border border-money/40 bg-money/10 p-4">
        <h2 className="font-semibold">
          {vi ? "Đọc đúng các khoản tiền" : "Understand the funding amounts"}
        </h2>
        <p className="text-sm">
          {vi
            ? "Tổng dự kiến nhận = tiền góp trực tiếp + matching dự kiến. Matching thay đổi đến khi round được chốt; dự kiến không có nghĩa đã nhận tiền."
            : "Estimated total = direct contributions + estimated matching. Matching can change until the round is finalized; estimates are not funds received."}
        </p>
        <p className="text-sm text-muted">
          {vi
            ? "Sau khi chốt, chỉ ví chủ dự án claim khoản được nhận. Khi round bị hủy, ví đã góp nhận lại tiền của mình qua refund; matching pool do người tổ chức thu hồi riêng."
            : "After finalization, only the project owner's wallet claims the payout. If the round is cancelled, contributors refund their own contributions; the organizer recovers the matching pool separately."}
        </p>
      </section>
    </Container>
  );
}
