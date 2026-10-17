"use client";
import { useAccount } from "wagmi";
import { Container } from "@/components/layout/Container";
import { ConnectWalletButton } from "@/components/layout/ConnectWalletButton";
import { StudentVerifyBox } from "@/components/verify/StudentVerifyBox";
import { useLocale } from "@/lib/context/locale";
export default function VerifyPage() {
  const { isConnected } = useAccount();
  const { locale } = useLocale();
  const vi = locale === "vi";
  return <Container className="max-w-2xl space-y-6 py-10">
    <div className="space-y-3">
      <p className="mono-label text-primary">STUDENT IDENTITY</p>
      <h1 className="text-3xl font-bold">{vi ? "Xác thực một lần. Tham gia nhiều vòng." : "Verify once. Join multiple rounds."}</h1>
      <p className="text-sm leading-6 text-muted">{vi ? "Xác thực email trường và liên kết ví với danh tính Student dùng chung. Bạn có thể xác thực ngay cả khi chưa có round nào." : "Verify your university email and link your wallet to a shared Student identity. You can verify before any round exists."}</p>
    </div>
    {isConnected ? <StudentVerifyBox showVerified /> : <div className="space-y-4 border border-line bg-surface p-5"><p className="text-sm text-muted">{vi ? "Kết nối ví để bắt đầu xác thực sinh viên." : "Connect your wallet to start student verification."}</p><ConnectWalletButton /></div>}
  </Container>;
}
