"use client";
import Link from "next/link";
import { useLocale } from "@/lib/context/locale";
export function StudentAccessGate() {
  const { locale } = useLocale(); const vi = locale === "vi";
  return <section className="space-y-4 border border-line bg-surface p-6">
    <h2 className="font-bold">{vi ? "Cần xác thực sinh viên" : "Student verification required"}</h2>
    <p className="text-sm text-muted">{vi ? "Xác thực email trường một lần để tạo dự án và quyên góp trong các vòng tài trợ." : "Verify your university email once to create projects and donate in funding rounds."}</p>
    <Link href="/verify" className="gradient-border inline-flex px-4 py-2 text-sm font-bold">{vi ? "Xác thực Student" : "Verify Student"}</Link>
  </section>;
}
