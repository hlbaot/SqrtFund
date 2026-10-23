"use client";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/lib/context/locale";
export function VerificationStats() {
  const { locale } = useLocale();
  const { data, isError } = useQuery({ queryKey: ["verification-stats"], queryFn: async () => {
    const { data } = await api.get<{ totalVerified: number; byDomain: Record<string, number> }>("/api/verify/stats", {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
    return data;
  }, refetchInterval: 60_000 });
  return <div className="flex flex-wrap gap-6 border border-line bg-surface p-4 text-sm" aria-live="polite">
    <p><strong className="font-mono">{data?.totalVerified ?? "—"}</strong> {locale === "vi" ? "sinh viên đã xác thực email" : "students with verified email"}</p>
    <p><strong className="font-mono">{data ? Object.keys(data.byDomain).length : "—"}</strong> {locale === "vi" ? "domain trường" : "university email domains"}</p>
    {isError && <p className="text-muted">{locale === "vi" ? "Chưa tải được thống kê." : "Statistics unavailable."}</p>}
  </div>;
}
