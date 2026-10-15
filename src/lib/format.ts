export const SNOWTRACE_BASE_URL = "https://testnet.snowtrace.io/tx";

export function shortAddress(addr: string, chars = 4): string {
  if (!addr) return "";
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export const USDC_DECIMALS = 6;

export type UsdcValidationKey =
  | "empty"
  | "invalid_format"
  | "too_many_decimals"
  | "zero"
  | "negative"
  | "exceeds_balance";

export interface ParseUsdcSuccess {
  success: true;
  amount: bigint;
  formatted: string;
}

export interface ParseUsdcError {
  success: false;
  errorKey: UsdcValidationKey;
  amount?: undefined;
}

export type ParseUsdcResult = ParseUsdcSuccess | ParseUsdcError;

/**
 * Validates and parses a USDC input string into a 6-decimal BigInt.
 * Never uses `Number` to prevent precision loss.
 */
export function parseUsdc(value: string, balance?: bigint): ParseUsdcResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { success: false, errorKey: "empty" };
  }

  if (trimmed.startsWith("-")) {
    return { success: false, errorKey: "negative" };
  }

  // Reject non-numeric input and multiple decimal points
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { success: false, errorKey: "invalid_format" };
  }

  const parts = trimmed.split(".");
  if (parts[1] && parts[1].length > 6) {
    return { success: false, errorKey: "too_many_decimals" };
  }

  const wholeStr = parts[0] || "0";
  const fracStr = (parts[1] || "").padEnd(6, "0").slice(0, 6);

  let amount: bigint;
  try {
    amount = BigInt(wholeStr) * 1_000_000n + BigInt(fracStr);
  } catch {
    return { success: false, errorKey: "invalid_format" };
  }

  if (amount <= 0n) {
    return { success: false, errorKey: "zero" };
  }

  if (balance !== undefined && amount > balance) {
    return { success: false, errorKey: "exceeds_balance" };
  }

  return { success: true, amount, formatted: trimmed };
}

export function formatUsdc(
  amount: number | bigint | string | undefined | null,
  options: { includeSymbol?: boolean; decimals?: number; compact?: boolean } = {}
): string {
  const { includeSymbol = true, decimals, compact = false } = options;

  if (amount === undefined || amount === null) {
    const zeroStr = decimals !== undefined ? (0).toFixed(decimals) : "0";
    return includeSymbol ? `${zeroStr} USDC` : zeroStr;
  }

  let rawStr = "";
  let isNegative = false;

  if (typeof amount === "bigint") {
    isNegative = amount < 0n;
    const abs = isNegative ? -amount : amount;
    const whole = abs / 1_000_000n;
    const frac = abs % 1_000_000n;
    if (frac === 0n && decimals === undefined) {
      rawStr = whole.toString();
    } else {
      const fracPadded = frac.toString().padStart(6, "0");
      rawStr = `${whole.toString()}.${fracPadded}`;
    }
  } else if (typeof amount === "number") {
    if (isNaN(amount)) return includeSymbol ? (decimals !== undefined ? `${(0).toFixed(decimals)} USDC` : "0 USDC") : (decimals !== undefined ? (0).toFixed(decimals) : "0");
    isNegative = amount < 0;
    const abs = Math.abs(amount);
    if (decimals !== undefined) {
      rawStr = abs.toFixed(decimals);
    } else {
      rawStr = abs.toString();
    }
  } else {
    const trimmed = amount.trim();
    if (!trimmed) return includeSymbol ? (decimals !== undefined ? `${(0).toFixed(decimals)} USDC` : "0 USDC") : (decimals !== undefined ? (0).toFixed(decimals) : "0");
    isNegative = trimmed.startsWith("-");
    rawStr = isNegative ? trimmed.slice(1) : trimmed;
  }

  // Split whole and fractional components
  const [wholePart = "0", fracPart = ""] = rawStr.split(".");
  let formattedWhole: string;
  try {
    formattedWhole = BigInt(wholePart).toLocaleString("en-US");
  } catch {
    formattedWhole = wholePart;
  }

  if (compact) {
    try {
      const wholeBig = BigInt(wholePart);
      if (wholeBig >= 1_000_000n) {
        const compactVal = (Number(wholeBig) / 1_000_000).toLocaleString("en-US", {
          maximumFractionDigits: 2,
        });
        return `${isNegative ? "-" : ""}${compactVal}M${includeSymbol ? " USDC" : ""}`;
      } else if (wholeBig >= 10_000n) {
        const compactVal = (Number(wholeBig) / 1_000).toLocaleString("en-US", {
          maximumFractionDigits: 1,
        });
        return `${isNegative ? "-" : ""}${compactVal}K${includeSymbol ? " USDC" : ""}`;
      }
    } catch {
      // fallback to regular format
    }
  }

  let finalNumberStr = formattedWhole;
  if (decimals !== undefined) {
    const paddedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
    finalNumberStr = decimals > 0 ? `${formattedWhole}.${paddedFrac}` : formattedWhole;
  } else if (fracPart.length > 0) {
    const trimmedFrac = fracPart.slice(0, 6).replace(/0+$/, "");
    finalNumberStr = trimmedFrac.length > 0 ? `${formattedWhole}.${trimmedFrac}` : formattedWhole;
  }

  const result = `${isNegative ? "-" : ""}${finalNumberStr}`;
  return includeSymbol ? `${result} USDC` : result;
}

/**
 * Format an integer count with thousand separators (e.g. 1,234)
 */
export function formatCount(num: number | bigint | undefined | null): string {
  if (num === undefined || num === null) return "0";
  const n = typeof num === "bigint" ? num : BigInt(Math.floor(num || 0));
  return n.toLocaleString("en-US");
}

/**
 * Format USDC with fixed 2 decimal places and thousand separators.
 * Zero is always formatted as "0.00" (or "0.00 USDC").
 */
export function formatUsdcFixed(
  amount: number | bigint | string | undefined | null,
  options: { includeSymbol?: boolean; compact?: boolean } = {}
): string {
  if (amount === undefined || amount === null || amount === 0 || amount === 0n || amount === "0") {
    return options.includeSymbol !== false ? "0.00 USDC" : "0.00";
  }
  return formatUsdc(amount, { decimals: 2, ...options });
}

/**
 * Format USDC with full precision (up to 6 decimals, trailing zeroes trimmed).
 * For tooltips, title attributes, and transaction confirmation details.
 */
export function formatUsdcFull(
  amount: number | bigint | string | undefined | null,
  options: { includeSymbol?: boolean } = {}
): string {
  if (amount === undefined || amount === null || amount === 0 || amount === 0n || amount === "0") {
    return options.includeSymbol !== false ? "0.00 USDC" : "0.00";
  }
  return formatUsdc(amount, { decimals: undefined, ...options });
}

/**
 * Formats a date strictly as "DD/MM/YYYY HH:mm GMT+7" in Asia/Ho_Chi_Minh timezone.
 * Consistent across all locales without month words like "thg 10" or "Oct".
 */
export function formatDateTimeGmt7(date: string | Date | number): string {
  if (!date && date !== 0) return "";
  let d: Date;
  if (typeof date === "number") {
    d = date < 10_000_000_000 ? new Date(date * 1000) : new Date(date);
  } else if (typeof date === "string") {
    if (/^\d+$/.test(date)) {
      const num = Number(date);
      d = num < 10_000_000_000 ? new Date(num * 1000) : new Date(num);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }

  if (isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  let day = "00";
  let month = "00";
  let year = "0000";
  let hour = "00";
  let minute = "00";

  for (const part of parts) {
    if (part.type === "day") day = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "year") year = part.value;
    else if (part.type === "hour") hour = part.value;
    else if (part.type === "minute") minute = part.value;
  }

  return `${day}/${month}/${year} ${hour}:${minute} GMT+7`;
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
