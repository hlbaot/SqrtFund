"use client";

import { Building2, GraduationCap, ArrowLeft } from "lucide-react";
import type { WalletProfile } from "@/hooks/useWalletProfile";

export function WalletProfilePicker({
  locale,
  onSelect,
  currentProfile,
  onCancel,
}: {
  locale: "vi" | "en";
  onSelect: (profile: WalletProfile) => void;
  currentProfile?: WalletProfile | null;
  onCancel?: () => void;
}) {
  const vi = locale === "vi";
  const choices = [
    {
      id: "student" as const,
      Icon: GraduationCap,
      title: vi ? "Sinh viên" : "Student",
      hint: vi ? "Xác thực email trường, góp quỹ và tạo dự án." : "Verify university email, donate and create projects.",
    },
    {
      id: "organizer" as const,
      Icon: Building2,
      title: vi ? "Nhà tổ chức" : "Organizer",
      hint: vi ? "Đăng ký quyền tổ chức, tạo và quản lý round." : "Apply for Organizer access, create and manage rounds.",
    },
  ];

  return (
    <div className="space-y-3 py-3" role="group" aria-label={vi ? "Chọn loại tài khoản" : "Choose account type"}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">
          {vi ? "Bạn sử dụng ví với vai trò nào?" : "How will you use this wallet?"}
        </p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground cursor-pointer font-mono px-1.5 py-0.5 rounded-xs hover:bg-surface-2 border border-line/40 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>{vi ? "Quay lại" : "Back"}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {choices.map(({ id, Icon, title, hint }) => {
          const isSelected = currentProfile === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex min-w-0 flex-col items-start gap-2 border bg-surface p-3 text-left transition-colors cursor-pointer rounded-xs ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-xs"
                  : "border-line-strong hover:border-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-primary"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-primary"}`} aria-hidden="true" />
                {isSelected && (
                  <span className="text-[9px] font-mono uppercase px-1 py-0.5 rounded-xs bg-primary text-black font-semibold">
                    {vi ? "Hiện tại" : "Active"}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-foreground">{title}</span>
              <span className="text-[11px] leading-relaxed text-muted">{hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
