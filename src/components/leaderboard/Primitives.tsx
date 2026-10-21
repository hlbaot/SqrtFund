"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Info } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { displayNumber, type RoundPhase } from "./model";

export function StatusChip({ phase }: { phase: RoundPhase }) {
  const { t } = useLocale();
  const color = phase === "open" ? "border-primary/40 bg-primary/10 text-primary"
    : phase === "finalized" ? "border-money/40 bg-money/10 text-money"
    : "border-line text-muted";
  return <span role="status" aria-live="polite" className={`role-label inline-flex max-w-full items-center gap-2 border px-2 py-1 ${color}`}>
    {phase === "finalized" ? <Check className="h-3 w-3 shrink-0" aria-hidden="true" /> : <span className={`h-1.5 w-1.5 shrink-0 ${phase === "open" ? "bg-primary" : "bg-muted"}`} aria-hidden="true" />}
    {t.competition[phase]}
  </span>;
}

export function CopyAddress({ address }: { address: string }) {
  const { t } = useLocale();
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { clearTimeout(timer.current); }, []);
  return <span className="inline-flex shrink-0 items-center">
    <button type="button" className="competition-focus inline-flex h-8 w-8 items-center justify-center text-muted hover:bg-surface-2 hover:text-foreground" aria-label={t.competition.copyAddress} title={address} onClick={async event => {
      event.stopPropagation();
      try { await navigator.clipboard.writeText(address); setMessage(t.competition.copied); }
      catch { setMessage(t.competition.copyError); }
      clearTimeout(timer.current); timer.current = setTimeout(() => setMessage(""), 1800);
    }}>{message === t.competition.copied ? <Check className="h-3.5 w-3.5 text-money" /> : <Copy className="h-3.5 w-3.5" />}</button>
    <span className="sr-only" role="status">{message}</span>
  </span>;
}

export function InfoTooltip({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const trigger = useRef<HTMLButtonElement>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  const updatePosition = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const tooltipWidth = Math.min(320, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - tooltipWidth - 16));
    const top = rect.bottom + 8 + 180 > window.innerHeight
      ? Math.max(16, rect.top - 180)
      : rect.bottom + 8;
    setPosition({ left, top });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  const handleOpen = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    updatePosition();
    setOpen(true);
  };

  const handleClose = () => {
    closeTimeout.current = setTimeout(() => {
      setOpen(false);
    }, 120);
  };

  return (
    <span
      className="relative z-10 inline-flex align-middle"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
    >
      <button
        ref={trigger}
        type="button"
        className={`competition-focus inline-flex shrink-0 items-center justify-center text-muted hover:text-foreground cursor-pointer transition-colors ${className || "h-8 w-8"}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={open ? id : undefined}
        onClick={(event) => {
          event.stopPropagation();
          updatePosition();
          setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <span
          id={id}
          role="tooltip"
          style={position}
          className="fixed z-[100] block w-[min(20rem,calc(100vw-2rem))] border border-line-strong bg-surface p-3.5 text-left font-sans text-xs font-normal normal-case leading-relaxed tracking-normal text-foreground shadow-2xl"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          {children}
        </span>,
        document.body
      )}
    </span>
  );
}

export function AnimatedNumber({ value, decimals = 6 }: { value: number; decimals?: number }) {
  const { locale } = useLocale();
  const node = useRef<HTMLSpanElement>(null);
  const played = useRef(false);
  useEffect(() => {
    if (played.current || !node.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { played.current = true; return; }
    const started = performance.now();
    let frame: number;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / 300);
      if (node.current) node.current.textContent = displayNumber(value * (1 - (1 - progress) ** 3), locale, progress === 1 ? decimals : 0);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else played.current = true;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); };
  }, [value, locale, decimals]);
  return <span className="tabular-mono" title={displayNumber(value, locale, decimals)}><span className="sr-only">{displayNumber(value, locale, decimals)}</span><span aria-hidden="true" ref={node}>{displayNumber(value, locale, decimals)}</span></span>;
}

export function MetricBar({ value, max, money = false }: { value: number; max: number; money?: boolean }) {
  if (value <= 0 || max <= 0) return null;
  return <span className="mt-2 block h-1 w-full overflow-hidden bg-line" aria-hidden="true"><span className={`competition-bar block h-full ${money ? "bg-money" : "bg-primary"}`} style={{ width: `${Math.min(100, value / max * 100)}%` } as CSSProperties} /></span>;
}
