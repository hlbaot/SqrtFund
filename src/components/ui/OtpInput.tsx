"use client";

import { useRef } from "react";

export function OtpInput({ value, onChange, disabled = false, locale = "vi" }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  locale?: "vi" | "en";
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  const enter = (text: string, index: number) => {
    const numeric = text.replace(/\D/g, "").slice(0, 6);
    if (!numeric) return;
    const start = numeric.length === 6 ? 0 : index;
    const next = [...digits];
    numeric.split("").forEach((digit, offset) => { if (start + offset < 6) next[start + offset] = digit; });
    onChange(next.join("").trimEnd());
    inputs.current[Math.min(5, start + numeric.length)]?.focus();
  };
  return <div role="group" aria-label={locale === "vi" ? "Mã OTP 6 số" : "6-digit OTP"} className="flex gap-1.5 sm:gap-2">
    {digits.map((digit, index) => <input key={index} ref={node => { inputs.current[index] = node; }}
      type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={index === 0 ? "one-time-code" : "off"}
      aria-label={`${locale === "vi" ? "Chữ số" : "Digit"} ${index + 1}`} maxLength={6}
      value={digit.trim()} disabled={disabled}
      className="h-12 w-9 min-w-0 rounded-xs border border-line-strong bg-bg text-center font-mono text-xl text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 sm:w-11"
      onFocus={event => event.currentTarget.select()}
      onChange={event => {
        if (event.target.value === "") {
          const next = [...digits]; next[index] = " "; onChange(next.join("").trimEnd());
        } else enter(event.target.value, index);
      }}
      onPaste={event => {
        event.preventDefault();
        if (!disabled) enter(event.clipboardData.getData("text"), index);
      }}
      onKeyDown={event => {
        if (event.key === "Backspace") {
          event.preventDefault();
          const target = digit.trim() ? index : Math.max(0, index - 1);
          const next = [...digits]; next[target] = " ";
          onChange(next.join("").trimEnd()); inputs.current[target]?.focus();
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          inputs.current[Math.max(0, Math.min(5, index + (event.key === "ArrowLeft" ? -1 : 1)))]?.focus();
        }
      }} />)}
  </div>;
}
