import { isAddress, keccak256, toBytes } from "viem";
import { parseUsdc } from "@/lib/format";
export const PROFILE_TTL = 10 * 60_000;
export type ProjectProfile = {
  leadName: string;
  goal: string;
  budgetUsdc: string;
  budgetPlan: string;
  milestones: string;
  differentiator?: string;
  progress?: string;
};
export type ProjectReport = { text: string; evidenceUrl: string };
export type ProfileDocument = {
  profile: ProjectProfile;
  reports: (ProjectReport & { publishedAt: string })[];
  revision: number;
  updated_at: string;
};
export type ProfileChange = {
  round: string;
  projectId: string;
  revision: number;
  profile: ProjectProfile;
  report: ProjectReport | null;
};
export type ProfilePermit = {
  wallet: string;
  origin: string;
  issuedAt: number;
  expiresAt: number;
  chainId: number;
};
export const EMPTY_PROFILE: ProjectProfile = {
  leadName: "",
  goal: "",
  budgetUsdc: "",
  budgetPlan: "",
  milestones: "",
};
function text(value: unknown, max: number, required = true): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw Error("INVALID_PROFILE");
  return value.trim();
}
export function profileScope(round: unknown, projectId: unknown) {
  if (
    typeof round !== "string" ||
    !isAddress(round) ||
    typeof projectId !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(projectId)
  )
    throw Error("INVALID_PROFILE");
  return { round: round.toLowerCase(), projectId };
}
/** Canonical content is used by both the editor and the signed server request. */
export function parseProfileChange(value: unknown): ProfileChange {
  if (!value || typeof value !== "object") throw Error("INVALID_PROFILE");
  const x = value as Record<string, unknown>,
    p = x.profile as Record<string, unknown>;
  if (
    !p ||
    !Number.isSafeInteger(x.revision) ||
    Number(x.revision) < 0 ||
    Number(x.revision) > 2147483646
  )
    throw Error("INVALID_PROFILE");
  const budgetUsdc = text(p.budgetUsdc, 24),
    amount = parseUsdc(budgetUsdc);
  if (!amount.success || amount.amount <= 0n) throw Error("INVALID_PROFILE");
  let report: ProjectReport | null = null;
  if (x.report != null) {
    const r = x.report as Record<string, unknown>;
    const evidenceUrl = text(r.evidenceUrl, 500, false);
    if (evidenceUrl) {
      const url = new URL(evidenceUrl);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw Error("INVALID_PROFILE");
    }
    report = { text: text(r.text, 3000), evidenceUrl };
  }
  return {
    ...profileScope(x.round, x.projectId),
    revision: Number(x.revision),
    profile: {
      leadName: text(p.leadName, 100),
      goal: text(p.goal, 2000),
      budgetUsdc,
      budgetPlan: text(p.budgetPlan, 2000),
      milestones: text(p.milestones, 2000),
      ...(p.differentiator !== undefined ? { differentiator: text(p.differentiator, 2000, false) } : {}),
      ...(p.progress !== undefined ? { progress: text(p.progress, 2000, false) } : {}),
    },
    report,
  };
}
export function profileMessage(change: ProfileChange, permit: ProfilePermit) {
  const digest = keccak256(toBytes(JSON.stringify(change)));
  return [
    "SqrtFund: Publish project profile",
    "This publishes public project information; it does not transfer funds.",
    `Origin: ${permit.origin}`,
    `Wallet: ${permit.wallet.toLowerCase()}`,
    `Chain ID: ${permit.chainId}`,
    `Round: ${change.round}`,
    `Project: ${change.projectId}`,
    `Revision: ${change.revision}`,
    `Content hash: ${digest}`,
    `Issued at: ${permit.issuedAt}`,
    `Expires at: ${permit.expiresAt}`,
  ].join("\n");
}
