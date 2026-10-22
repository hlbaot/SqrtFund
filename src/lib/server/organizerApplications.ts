import "server-only";
import { databaseError } from "@/lib/verify/errors";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { emailIdentityHash } from "@/lib/emailIdentity";
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";

export interface OrganizerApplication {
  id: string;
  walletAddress: string;
  organizationName: string;
  contactEmail: string;
  emailVerifiedAt?: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  txHash?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInput {
  walletAddress: string;
  organizationName: string;
  contactEmail: string;
  emailVerifiedAt: string;
  reason: string;
}

function mapRow(row: Record<string, unknown>): OrganizerApplication {
  return {
    id: String(row.id),
    walletAddress: String(row.wallet_address),
    organizationName: String(row.organization_name),
    contactEmail: String(row.contact_email),
    emailVerifiedAt: row.email_verified_at ? String(row.email_verified_at) : null,
    reason: String(row.reason),
    status: (row.status as "pending" | "approved" | "rejected") || "pending",
    txHash: row.tx_hash ? String(row.tx_hash) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

// Chỉ lưu Supabase: bộ nhớ mỗi instance Vercel không chia sẻ và sẽ mất khi restart.
export async function createOrganizerApplication(input: ApplicationInput): Promise<OrganizerApplication> {
  const wallet = input.walletAddress.trim().toLowerCase();
  const email = input.contactEmail.trim().toLowerCase();
  await ensureEmailWallet(emailIdentityHash(email), wallet, true);
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin().from("organizer_applications").insert({
    id: crypto.randomUUID(), wallet_address: wallet,
    organization_name: input.organizationName.trim(), contact_email: email,
    email_verified_at: input.emailVerifiedAt, reason: input.reason.trim(),
    status: "pending", created_at: now, updated_at: now,
  }).select().single();
  if (error) throw databaseError(error);
  return mapRow(data as Record<string, unknown>);
}

export async function listOrganizerApplications(options?: {
  walletAddress?: string;
  status?: string;
}): Promise<OrganizerApplication[]> {
  let query = supabaseAdmin().from("organizer_applications").select("*").order("created_at", { ascending: false });
  if (options?.walletAddress) query = query.ilike("wallet_address", options.walletAddress.trim().toLowerCase());
  if (options?.status && options.status !== "all") query = query.eq("status", options.status);
  const { data, error } = await query;
  if (error) throw databaseError(error);
  return ((data || []) as Record<string, unknown>[]).map(mapRow);
}

export async function updateOrganizerApplicationStatus(
  id: string,
  updates: { status: "approved" | "rejected"; txHash?: string | null; reviewedBy?: string | null; }
): Promise<OrganizerApplication | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin().from("organizer_applications").update({
    status: updates.status, tx_hash: updates.txHash || null,
    reviewed_by: updates.reviewedBy?.toLowerCase() || null,
    reviewed_at: now, updated_at: now,
  }).eq("id", id).select().maybeSingle();
  if (error) throw databaseError(error);
  return data ? mapRow(data as Record<string, unknown>) : null;
}
