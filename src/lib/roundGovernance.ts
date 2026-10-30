import { isAddress, keccak256, toBytes } from "viem";
import type { ProfilePermit } from "@/lib/projectProfile";
export const RULES_VERSION = "2026-10-30";
export const CRITERIA = {
  vi: { fit: "Phù hợp chủ đề và đối tượng", impact: "Lợi ích cho cộng đồng", feasibility: "Kế hoạch khả thi", budget: "Ngân sách rõ ràng", integrity: "Thông tin trung thực và quyền sử dụng nội dung" },
  en: { fit: "Theme and eligibility", impact: "Community benefit", feasibility: "Feasible plan", budget: "Clear budget", integrity: "Accurate information and content rights" },
};
export type Criterion = keyof typeof CRITERIA.vi;
export type RoundPolicy = { theme: string; eligibility: string; funding: string; criteria: string };
export type ReviewNote = { projectId: string; action: "approve" | "reject"; criteria: Criterion[]; reason: string };
export type GovernanceChange = { round: string; rulesVersion: typeof RULES_VERSION } & ({ kind: "policy"; policy: RoundPolicy } | { kind: "review"; review: ReviewNote });
export type GovernanceRecord = { id: number; kind: "policy" | "review"; payload: GovernanceChange; owner_address: string; transaction_hash: string | null; created_at: string };
function field(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw Error("INVALID_GOVERNANCE");
  return value.trim();
}
export function governanceRound(value: unknown) {
  if (typeof value !== "string" || !isAddress(value)) throw Error("INVALID_GOVERNANCE");
  return value.toLowerCase();
}
export function parseGovernance(value: unknown): GovernanceChange {
  if (!value || typeof value !== "object") throw Error("INVALID_GOVERNANCE");
  const x = value as Record<string, unknown>;
  const base = { round: governanceRound(x.round), rulesVersion: RULES_VERSION as typeof RULES_VERSION };
  if (x.rulesVersion !== RULES_VERSION) throw Error("INVALID_GOVERNANCE");
  if (x.kind === "policy") {
    const p = x.policy as Record<string, unknown> | undefined;
    if (!p) throw Error("INVALID_GOVERNANCE");
    return { ...base, kind: "policy", policy: { theme: field(p.theme, 2000), eligibility: field(p.eligibility, 2000), funding: field(p.funding, 2000), criteria: field(p.criteria, 4000) } };
  }
  if (x.kind === "review") {
    const r = x.review as Record<string, unknown> | undefined;
    if (!r || !/^[1-9][0-9]{0,18}$/.test(String(r.projectId)) || typeof r.projectId !== "string" || !["approve", "reject"].includes(String(r.action)) || !Array.isArray(r.criteria) || r.criteria.length < 1 || r.criteria.length > 5 || new Set(r.criteria).size !== r.criteria.length || !r.criteria.every(c => typeof c === "string" && Object.hasOwn(CRITERIA.en, c))) throw Error("INVALID_GOVERNANCE");
    return { ...base, kind: "review", review: { projectId: r.projectId, action: r.action as "approve" | "reject", criteria: r.criteria as Criterion[], reason: field(r.reason, 2000) } };
  }
  throw Error("INVALID_GOVERNANCE");
}
export function governanceMessage(change: GovernanceChange, permit: ProfilePermit) {
  return ["SqrtFund: Publish round governance", "Public rules or review explanation. This signature does not transfer funds.", `Origin: ${permit.origin}`, `Wallet: ${permit.wallet.toLowerCase()}`, `Chain ID: ${permit.chainId}`, `Content hash: ${keccak256(toBytes(JSON.stringify(change)))}`, `Issued at: ${permit.issuedAt}`, `Expires at: ${permit.expiresAt}`].join("\n");
}
