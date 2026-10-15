export const SNOWTRACE_BASE_URL = "https://testnet.snowtrace.io/tx";

export function shortAddress(addr: string, chars = 4): string {
  if (!addr) return "";
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function formatUsdc(amount: number | bigint, options: { includeSymbol?: boolean; decimals?: number } = {}): string {
  const { includeSymbol = true, decimals = 0 } = options;
  const num = typeof amount === "bigint" ? Number(amount) / 1_000_000 : amount;
  
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  return includeSymbol ? `${formatted} USDC` : formatted;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatTimeLeft(targetDate: string | Date, locale: "en" | "vi" = "en"): string {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return locale === "vi" ? "Đã kết thúc" : "Round ended";
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (locale === "vi") {
    if (days > 0) return `${days} ngày ${hours} giờ`;
    return `${hours} giờ ${minutes} phút`;
  }

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function getExplorerTxUrl(txHash: string): string {
  return `${SNOWTRACE_BASE_URL}/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `https://testnet.snowtrace.io/address/${address}`;
}

export function formatTimeAgo(timestampMs: number, locale: "en" | "vi" = "en", now: number = Date.now()): string {
  if (!timestampMs || isNaN(timestampMs) || timestampMs <= 0) {
    return locale === "vi" ? "vừa xong" : "just now";
  }
  const diff = Math.max(0, now - timestampMs);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (locale === "vi") {
    if (days > 0) return `${days} ngày trước`;
    if (hours > 0) return `${hours} giờ trước`;
    if (minutes > 0) return `${minutes} phút trước`;
    return "vừa xong";
  }

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "just now";
}

export function formatCooldown(remainingSeconds: number): string {
  const s = Math.max(0, Math.floor(remainingSeconds));
  const seconds = s % 60;
  const minutes = Math.floor((s % 3600) / 60);
  const hours = Math.floor(s / 3600);

  if (s >= 86400) {
    const days = Math.floor(s / 86400);
    const remHours = Math.floor((s % 86400) / 3600);
    const hh = String(remHours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${days}d ${hh}:${mm}:${ss}`;
  }

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function calculateRemainingSeconds(nextClaimAt: number, currentNowSec: number): number {
  if (!nextClaimAt || nextClaimAt <= 0) return 0;
  return Math.max(0, nextClaimAt - currentNowSec);
}

export interface CanClaimParams {
  isConnected: boolean;
  nextClaimAt: number;
  remainingSeconds: number;
  lifetimeMinted?: bigint;
  amount?: bigint;
  cap?: bigint;
}

export function calculateCanClaim({
  isConnected,
  nextClaimAt,
  remainingSeconds,
  lifetimeMinted,
  amount,
  cap,
}: CanClaimParams): boolean {
  if (!isConnected) return false;
  if (
    lifetimeMinted !== undefined &&
    amount !== undefined &&
    cap !== undefined &&
    lifetimeMinted + amount > cap
  ) {
    return false;
  }
  if (!nextClaimAt || nextClaimAt === 0) return true;
  return remainingSeconds <= 0;
}
