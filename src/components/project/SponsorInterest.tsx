"use client";

import { useState } from "react";
import type { Address } from "viem";
import type { Project } from "@/types";
import { useLocale } from "@/lib/context/locale";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export function sponsorContactUrl(value?: string): string | undefined {
  try {
    const url = new URL(value ?? "");
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password)
      return url.href;
  } catch { /* A missing or invalid contact must not become a clickable link. */ }
}

export function SponsorInterest({ project, roundAddress }: { project: Project; roundAddress: Address }) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const contact = sponsorContactUrl(project.contactUrl);
  const path = `/round/${roundAddress}/project/${project.id}`;
  const [message, setMessage] = useState("");
  const title = vi ? "Quan tâm tài trợ" : "Interested in sponsoring";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus(vi ? "Đã sao chép lời nhắn." : "Message copied.");
    } catch {
      setCopyStatus(vi ? "Không sao chép được. Bạn có thể chọn và sao chép lời nhắn bên dưới." : "Could not copy. Select and copy the message below.");
    }
  }

  return (
    <div className="rounded-sm border border-primary/30 bg-primary/5 p-4 space-y-3">
      <p className="text-sm text-muted">{vi ? "Muốn tìm hiểu thêm trước khi tài trợ? Trao đổi trực tiếp với nhóm về kế hoạch và nhu cầu hỗ trợ." : "Want to learn more before sponsoring? Discuss the plan and funding needs with the team."}</p>
      <Button type="button" variant="outline" onClick={() => {
        setCopyStatus("");
        const link = `${window.location.origin}${path}`;
        setMessage(vi
          ? `Xin chào nhóm ${project.name}, tôi quan tâm đến việc tài trợ cho dự án. Nhóm có thể chia sẻ thêm về kế hoạch triển khai, ngân sách và hình thức hỗ trợ phù hợp không?\n\nDự án: ${link}`
          : `Hello ${project.name}, I am interested in sponsoring your project. Could you share more about your milestones, budget and ways to support the team?\n\nProject: ${link}`);
        setOpen(true);
      }}>{title}</Button>
      <Dialog isOpen={open} onClose={() => setOpen(false)} title={title}
        description={vi ? "Lời nhắn chưa được gửi và sự quan tâm chưa được lưu. Bạn chủ động liên hệ qua kênh của nhóm; thao tác này không chuyển tiền hay cam kết tài trợ." : "No message has been sent or interest recorded. Contact the team through their channel; this does not transfer funds or commit sponsorship."}>
        <div className="space-y-4">
          <p className="font-semibold break-words">{project.name}</p>
          {contact ? <a href={contact} target="_blank" rel="noopener noreferrer" className="inline-flex border border-line px-4 py-2 text-sm text-primary underline">{vi ? "Mở kênh liên hệ của nhóm ↗" : "Open the team's contact channel ↗"}</a>
            : <p className="text-sm text-muted">{vi ? "Nhóm chưa cung cấp kênh liên hệ hợp lệ. Hiện chưa thể kết nối trực tiếp qua nền tảng." : "The team has not provided a valid contact channel. Direct contact is currently unavailable."}</p>}
          <label className="block text-sm space-y-2">
            <span>{vi ? "Lời nhắn gợi ý — bạn có thể chỉnh sửa" : "Suggested message — you can edit it"}</span>
            <textarea rows={6} value={message} onChange={e => { setMessage(e.target.value); setCopyStatus(""); }} className="w-full border border-line bg-surface p-3" />
          </label>
          <Button type="button" onClick={() => void copy()}>{vi ? "Sao chép lời nhắn" : "Copy message"}</Button>
          <p role="status" className="text-xs text-muted">{copyStatus}</p>
        </div>
      </Dialog>
    </div>
  );
}
