/** Shared validation; the server exposes only the public domain policy to the UI. */
// School aliases +tag map to the same identity; original address is used only for delivery.
export function normalizeEmail(email: string): string {
  const value = email.trim().toLowerCase();
  const parts = value.split("@");
  if (parts.length !== 2) return value;
  return `${parts[0].split("+")[0]}@${parts[1]}`;
}
export function emailDomain(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (value.length > 254) return null;
  const parts = value.split("@");
  if (parts.length !== 2 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/.test(parts[0]) ||
      parts[0].startsWith(".") || parts[0].endsWith(".") || parts[0].includes("..")) return null;
  const domain = parts[1];
  if (domain.length > 253 || !domain.includes(".") || !domain.split(".").every(label =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return domain;
}
export function allowedDomains(value: string = ""): string[] {
  return value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}
export type EmailDomainPolicy = {
  mode: "open-edu" | "unconfigured" | "allowlist";
  allowedDomains: string[];
  blockedDomains: string[];
};
type DomainList = string | string[];
function domainList(value: DomainList): string[] {
  return allowedDomains(typeof value === "string" ? value : value.join(","));
}
export function emailDomainPolicy(allowed: DomainList = [], blocked: DomainList = []): EmailDomainPolicy {
  const list = domainList(allowed);
  const denied = domainList(blocked);
  const validDomain = (value: string) => value !== "edu.vn" && emailDomain(`policy@${value}`) === value;
  const valid = list.every(validDomain) && denied.every(validDomain);
  return { mode: !valid ? "unconfigured" : list.length ? "allowlist" : "open-edu", allowedDomains: list, blockedDomains: denied };
}
function matchesDomain(domain: string, entry: string): boolean {
  return domain === entry || domain.endsWith(`.${entry}`);
}
export function isAllowedEmail(email: string, domains: DomainList = [], blocked: DomainList = []): boolean {
  const domain = emailDomain(email);
  if (!domain || !emailDomain(normalizeEmail(email)) || domain === "edu.vn") return false;
  const policy = emailDomainPolicy(domains, blocked);
  // Deny rules cover descendants; allow rules require an exact approved domain.
  if (policy.blockedDomains.some(d => matchesDomain(domain, d))) return false;
  // MVP open mode checks the academic suffix; an explicit allowlist remains exact.
  if (policy.mode === "unconfigured") return false;
  return policy.mode === "allowlist"
    ? policy.allowedDomains.includes(domain)
    : domain.endsWith(".edu") || domain.endsWith(".edu.vn");
}
export function maskEmail(email: string): string {
  const [local, domain] = normalizeEmail(email).split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}
