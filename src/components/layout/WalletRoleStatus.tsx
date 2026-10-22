import type { RoleReadStatus } from "@/hooks/useRole";
import type { WalletProfile } from "@/hooks/useWalletProfile";
import { Badge } from "@/components/ui/Badge";
import { RefreshCw } from "lucide-react";

/** Display only the selected profile. Authorization still comes from the on-chain reads. */
export function WalletRoleStatus({
  profile,
  studentStatus,
  organizerStatus,
  locale,
  onRetry,
  isRevoked,
}: {
  profile: WalletProfile | "platform";
  studentStatus: RoleReadStatus;
  organizerStatus: RoleReadStatus;
  locale: "vi" | "en";
  onRetry: () => void;
  isRevoked?: boolean;
  revocationReason?: string | null;
  onOpenRevokeDetails?: () => void;
  onSwitchRole?: () => void;
}) {
  const vi = locale === "vi";
  if (profile === "platform") {
    return (
      <Badge variant="primary" className="rounded-sm text-[10px] px-1.5 py-0 font-mono normal-case tracking-normal">
        {vi ? "Quản trị nền tảng" : "Platform Admin"}
      </Badge>
    );
  }

  const student = profile === "student";
  const status = student ? studentStatus : organizerStatus;
  const hasError = status === "error" || status === "unsupported";
  const label = status === "confirmed"
    ? (vi ? (student ? "Đã xác minh" : "Đã được cấp quyền") : (student ? "Verified" : "Authorized"))
    : status === "absent"
    ? (vi ? (student ? "Chưa xác minh" : "Chưa được cấp quyền") : (student ? "Not verified" : "Not authorized"))
    : status === "loading"
    ? (vi ? "Đang kiểm tra…" : "Checking…")
    : status === "inactive"
    ? (vi ? "Cần kết nối mạng Fuji" : "Connect on Fuji")
    : vi ? "Chưa kiểm tra được" : "Unable to verify";

  return (
    <div className="space-y-1" aria-live="polite">
      <p className="text-xs font-medium text-foreground">
        {student ? (vi ? "Sinh viên" : "Student") : (vi ? "Nhà tổ chức" : "Organizer")}
      </p>

      {(student || !isRevoked) && (
        <div className="space-y-2">
          <p className={`text-[11px] font-medium ${status === "confirmed" ? "text-money" : hasError ? "text-warning" : "text-muted"}`}>
            {label}
          </p>
          {!student && status === "unsupported" && (
            <p className="text-[10px] leading-snug text-muted">
              {vi ? "Hệ thống chưa cập nhật hợp đồng hỗ trợ Organizer." : "The system contract has not been updated for Organizers."}
            </p>
          )}
          {hasError && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1 text-[11px] text-primary underline-offset-4 hover:underline"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              {vi ? "Kiểm tra lại quyền" : "Retry role checks"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
