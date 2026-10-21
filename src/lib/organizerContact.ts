/** Email liên hệ không bị giới hạn theo tên miền trường học. */
export function normalizeContactEmail(value: string): string { return value.trim().toLowerCase(); }
export function validContactEmail(value: unknown): value is string {
  return typeof value === "string" && value.trim().length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value.trim());
}
