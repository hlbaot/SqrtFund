import { Container } from "@/components/layout/Container";
import { PlatformRules } from "@/components/policy/PlatformRules";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Quy định và tiêu chí xét duyệt | SqrtFund",
  description: "Bộ quy chuẩn, điều kiện tham gia và tiêu chí xét duyệt áp dụng cho các vòng tài trợ Quadratic Funding trên SqrtFund.",
  alternates: { canonical: "/rules" },
};

export default function RulesPage() {
  return (
    <Container className="max-w-4xl space-y-5 py-8 sm:py-12">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Trang chủ</span>
        </Link>
        <span className="text-line-strong">/</span>
        <span className="text-foreground">Quy định & Tiêu chí</span>
      </div>
      <PlatformRules />
    </Container>
  );
}
