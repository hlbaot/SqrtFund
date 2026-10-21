import type { RoleReadStatus, WalletRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/Badge";
import { RefreshCw } from "lucide-react";

/** Các quyền có thể cùng tồn tại; không suy ra quyền từ việc vừa kết nối ví. */
export function WalletRoleStatus({
  roles,
  studentStatus,
  organizerStatus,
  locale,
  onRetry,
}: {
  roles: WalletRole[];
  studentStatus: RoleReadStatus;
  organizerStatus: RoleReadStatus;
  locale: "vi" | "en";
  onRetry: () => void;
}) {
  const vi = locale === "vi";

  const label = (status: RoleReadStatus, student: boolean) => {
    if (status === "confirmed") return vi ? (student ? "Đã xác minh" : "Đã được cấp quyền") : (student ? "Verified" : "Authorized");
    if (status === "absent") return vi ? (student ? "Chưa xác minh" : "Chưa được cấp quyền") : (student ? "Not verified" : "Not authorized");
    if (status === "loading") return vi ? "Đang kiểm tra…" : "Checking…";
    if (status === "inactive") return vi ? "Cần kết nối mạng Fuji" : "Connect on Fuji";
    return vi ? "Chưa kiểm tra được" : "Unable to verify";
  };

  const hasError = [studentStatus, organizerStatus].some(status => status === "error" || status === "unsupported");

  return (
    <div className="space-y-1.5" aria-live="polite">
      {/* Top Badges Row */}
      <div className="flex flex-wrap items-center gap-1">
        {roles.includes("platform_owner") && (
          <Badge variant="primary" className="text-[10px] px-1.5 py-0 font-mono">
            Platform Owner
          </Badge>
        )}
        {roles.includes("admin") && (
          <Badge variant="warning" className="text-[10px] px-1.5 py-0 font-mono">
            {vi ? "Quản lý vòng" : "Round Admin"}
          </Badge>
        )}
        {roles.includes("owner") && (
          <Badge variant="owner" className="text-[10px] px-1.5 py-0 font-mono">
            {vi ? "Chủ dự án" : "Project Owner"}
          </Badge>
        )}
        {roles.includes("organizer") && (
          <Badge variant="primary" className="text-[10px] px-1.5 py-0 font-mono">
            Organizer
          </Badge>
        )}
        {roles.includes("student") && (
          <Badge variant="accent" className="text-[10px] px-1.5 py-0 font-mono">
            {vi ? "Sinh viên" : "Student"}
          </Badge>
        )}
        {!roles.some(r => ["platform_owner", "admin", "owner", "organizer", "student"].includes(r)) && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0 font-mono text-muted">
            {vi ? "Chưa xác thực" : "Guest"}
          </Badge>
        )}
      </div>

      {/* Structured Status Detail Card */}
      <div className="bg-surface-2/40 border border-line/50 rounded-xs p-2 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted font-mono">{vi ? "Sinh viên" : "Student"}:</span>
          <span className={`font-mono font-medium ${
            studentStatus === "confirmed" ? "text-money" : studentStatus === "loading" ? "text-primary animate-pulse" : "text-muted"
          }`}>
            {label(studentStatus, true)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted font-mono">Organizer:</span>
          <span className={`font-mono font-medium ${
            organizerStatus === "confirmed" ? "text-money" : organizerStatus === "unsupported" || organizerStatus === "error" ? "text-warning" : organizerStatus === "loading" ? "text-primary animate-pulse" : "text-muted"
          }`}>
            {label(organizerStatus, false)}
          </span>
        </div>

        {organizerStatus === "unsupported" && (
          <p className="text-[10px] text-muted/80 pt-0.5 border-t border-line/40 leading-snug">
            {vi ? "Hệ thống chưa cập nhật hợp đồng hỗ trợ Organizer." : "The system contract has not been updated for Organizers."}
          </p>
        )}

        {hasError && (
          <div className="pt-1 border-t border-line/40 flex justify-end">
            <button
              type="button"
              onClick={onRetry}
              className="text-[11px] font-mono text-primary hover:underline underline-offset-4 cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              {vi ? "Kiểm tra lại quyền" : "Retry role checks"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
