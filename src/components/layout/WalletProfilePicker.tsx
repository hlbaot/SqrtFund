"use client";

import { Building2, GraduationCap } from "lucide-react";
import type { WalletProfile } from "@/hooks/useWalletProfile";

export function WalletProfilePicker({ locale, onSelect }: { locale: "vi" | "en"; onSelect: (profile: WalletProfile) => void }) {
  const vi = locale === "vi";
  const choices = [
    { id: "student" as const, Icon: GraduationCap, title: vi ? "Sinh viên" : "Student", hint: vi ? "Xác thực email trường, góp quỹ và tạo dự án." : "Verify university email, donate and create projects." },
    { id: "organizer" as const, Icon: Building2, title: vi ? "Nhà tổ chức" : "Organizer", hint: vi ? "Đăng ký quyền tổ chức, tạo và quản lý round." : "Apply for Organizer access, create and manage rounds." },
  ];
  return <div className="space-y-3 py-3" role="group" aria-label={vi ? "Chọn loại tài khoản" : "Choose account type"}>
    <p className="text-xs font-semibold text-foreground">{vi ? "Bạn sử dụng ví với vai trò nào?" : "How will you use this wallet?"}</p>
    <div className="grid grid-cols-2 gap-2">
      {choices.map(({ id, Icon, title, hint }) => <button key={id} type="button" onClick={() => onSelect(id)}
        className="flex min-w-0 flex-col items-start gap-2 border border-line-strong bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-primary">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="text-[11px] leading-relaxed text-muted">{hint}</span>
      </button>)}
    </div>
  </div>;
}
