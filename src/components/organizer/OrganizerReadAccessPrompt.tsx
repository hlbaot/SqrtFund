"use client";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/lib/context/locale";
import type { useOrganizerReadAccess } from "@/hooks/useOrganizerReadAccess";

export function OrganizerReadAccessPrompt({ access }: { access?: ReturnType<typeof useOrganizerReadAccess> }) {
  const { locale } = useLocale();
  if (!access?.needsAuth) return null;
  const vi = locale === "vi";
  return <div className="space-y-3 border border-line p-4" role="status">
    <p className="text-sm text-muted">{!access.canSign
      ? (vi ? "Chuyển ví sang Avalanche Fuji để xác thực quyền xem đơn." : "Switch your wallet to Avalanche Fuji to verify application access.") : vi
      ? "Ký xác nhận bằng ví để xem đơn đăng ký. Xác nhận có hiệu lực 15 phút, không tốn gas và không cấp quyền chuyển tiền."
      : "Sign with your wallet to view applications. Access lasts 15 minutes, costs no gas and does not authorize transfers."}</p>
    <Button type="button" variant="outline" disabled={access.isAuthorizing || !access.canSign} onClick={() => void access.authorize()}>
      {access.isAuthorizing ? (vi ? "Đang chờ chữ ký…" : "Waiting for signature…") : (vi ? "Xác thực để xem đơn" : "Verify to view applications")}
    </Button>
    {access.error && <p role="alert" className="text-sm text-primary">{vi
      ? "Chưa xác thực được ví. Bạn có thể thử ký lại." : "Wallet verification was not completed. You can try again."}</p>}
  </div>;
}
