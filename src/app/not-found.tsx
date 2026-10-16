"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { Button } from "@/components/ui/Button";
import { GradientBorder } from "@/components/ui/GradientBorder";
import FuzzyText from "@/components/ui/FuzzyText";

export default function NotFound() {
  const router = useRouter();
  const { locale } = useLocale();
  const isVi = locale === "vi";

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen w-full flex-col items-center justify-center overflow-y-auto px-4 py-12 text-center"
      style={{
        background:
          "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px), radial-gradient(circle at 50% -10%, rgba(232, 65, 66, 0.11), transparent 36rem), var(--background)",
        backgroundSize: "42px 42px, 42px 42px, auto, auto",
      }}
    >
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center justify-center">
        {/* Large 404 display with FuzzyText canvas & background glow */}
        <div className="relative flex items-center justify-center select-none min-h-[140px] sm:min-h-[200px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-48 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#e84142]/35 via-[#ff5a5b]/25 to-[#fb923c]/25 blur-3xl sm:h-64 sm:w-[420px]"
          />
          <FuzzyText
            fontSize="clamp(108px, 18vw, 210px)"
            fontWeight={900}
            fontFamily="inherit"
            gradient={["#e84142", "#ff5a5b", "#fb923c"]}
            baseIntensity={0.18}
            hoverIntensity={0.55}
            fuzzRange={26}
            direction="horizontal"
            enableHover={true}
            clickEffect={true}
            glitchMode={true}
            glitchInterval={3500}
            glitchDuration={200}
            colorSplit={0.3}
            className="drop-shadow-[0_0_28px_rgba(232,65,66,0.45)] transition-transform duration-200"
          >
            404
          </FuzzyText>
        </div>

        {/* Title: 8px below 404 */}
        <h1 className="mt-2 text-[22px] font-bold tracking-tight text-white sm:text-[28px] md:text-[32px] lg:text-[36px]">
          {isVi ? "Xin lỗi, trang không tồn tại" : "I'm sorry, page not exist"}
        </h1>

        {/* Description: 12px below title */}
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
          {isVi
            ? "Trang có thể đã bị di chuyển, hoặc địa chỉ trong URL không còn khả dụng."
            : "The page may have moved, or the address in the URL is no longer available."}
        </p>

        {/* Action button: 32px below description */}
        <div className="mt-8 flex w-full items-center justify-center">
          <GradientBorder className="w-full max-w-[280px] rounded-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(232,65,66,0.35)] sm:w-auto">
            <Button
              variant="ghost"
              size="md"
              onClick={() => router.push("/")}
              className="w-full min-h-11 px-8 text-sm font-bold text-foreground hover:bg-transparent sm:w-auto"
            >
              <Home className="h-4 w-4 shrink-0 text-primary" />
              <span>{isVi ? "Về trang chủ" : "Back to Home"}</span>
            </Button>
          </GradientBorder>
        </div>
      </div>
    </div>
  );
}
