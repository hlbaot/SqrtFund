"use client";
import dynamic from "next/dynamic";
import { useLocale } from "@/lib/context/locale";
function VerificationLoading() { const { t } = useLocale(); return <p role="status" className="text-sm text-muted">{t.common.loading}</p>; }
export const StudentVerifyBox = dynamic(() => import("./StudentVerifyBox").then(module => module.StudentVerifyBox), { ssr: false, loading: VerificationLoading });
