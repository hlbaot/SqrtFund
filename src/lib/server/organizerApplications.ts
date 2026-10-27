import "server-only";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { VerificationError, databaseError } from "@/lib/verify/errors";

export interface OrganizerApplication {
  id: string;
  walletAddress: string;
  organizationName: string;
  contactEmail: string;
  emailVerifiedAt?: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  txHash?: string | null;
  revocationReason?: string | null;
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

/** A database failure must never produce a local substitute for a persisted application. */
async function withDatabase<T>(
  work: (db: ReturnType<typeof supabaseAdmin>) => Promise<T>,
): Promise<T> {
  try {
    return await work(supabaseAdmin());
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    throw databaseError(error);
  }
}

function mapRow(value: unknown): OrganizerApplication {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new VerificationError("SERVICE_UNAVAILABLE", 503);
  const row = value as Record<string, unknown>;
  for (const field of [
    "id",
    "wallet_address",
    "organization_name",
    "contact_email",
    "reason",
    "created_at",
    "updated_at",
  ])
    if (typeof row[field] !== "string" || !row[field])
      throw new VerificationError("SERVICE_UNAVAILABLE", 503);
  if (
    !["pending", "approved", "rejected", "revoked"].includes(
      String(row.status),
    ) ||
    !Number.isFinite(Date.parse(row.created_at as string)) ||
    !Number.isFinite(Date.parse(row.updated_at as string))
  )
    throw new VerificationError("SERVICE_UNAVAILABLE", 503);
  return {
    id: row.id as string,
    walletAddress: row.wallet_address as string,
    organizationName: row.organization_name as string,
    contactEmail: row.contact_email as string,
    emailVerifiedAt: nullableText(row.email_verified_at),
    reason: row.reason as string,
    status: row.status as OrganizerApplication["status"],
    txHash: nullableText(row.tx_hash),
    revocationReason: nullableText(row.revocation_reason),
    reviewedBy: nullableText(row.reviewed_by),
    reviewedAt: nullableText(row.reviewed_at),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
function nullableText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string")
    throw new VerificationError("SERVICE_UNAVAILABLE", 503);
  return value;
}

export async function createOrganizerApplication(
  input: ApplicationInput,
): Promise<OrganizerApplication> {
  return withDatabase(async (db) => {
    const wallet = input.walletAddress.trim().toLowerCase();
    const email = input.contactEmail.trim().toLowerCase();
    // The caller validates the v2 email token; the persisted identity remains authoritative.
    await ensureEmailWallet(email, wallet, true, db);
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("organizer_applications")
      .insert({
        id: crypto.randomUUID(),
        wallet_address: wallet,
        organization_name: input.organizationName.trim(),
        contact_email: email,
        email_verified_at: input.emailVerifiedAt,
        reason: input.reason.trim(),
        status: "pending",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (error) throw databaseError(error);
    return mapRow(data);
  });
}

export async function listOrganizerApplications(options?: {
  walletAddress?: string;
  status?: string;
}): Promise<OrganizerApplication[]> {
  return withDatabase(async (db) => {
    let query = db
      .from("organizer_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (options?.walletAddress)
      query = query.ilike(
        "wallet_address",
        options.walletAddress.trim().toLowerCase(),
      );
    const status = options?.status?.trim().toLowerCase();
    if (status && status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw databaseError(error);
    if (!Array.isArray(data))
      throw new VerificationError("SERVICE_UNAVAILABLE", 503);
    return data.map(mapRow);
  });
}

/** Reopen only the signed database revision, without creating another email binding. */
export async function resubmitOrganizerApplication(
  previous: OrganizerApplication,
  input: ApplicationInput,
): Promise<OrganizerApplication> {
  if (
    !previous.emailVerifiedAt ||
    !["revoked", "rejected"].includes(previous.status) ||
    previous.walletAddress.toLowerCase() !==
      input.walletAddress.toLowerCase() ||
    previous.contactEmail.trim().toLowerCase() !==
      input.contactEmail.trim().toLowerCase()
  ) {
    throw new VerificationError("APPLICATION_CHANGED", 409);
  }
  return withDatabase(async (db) => {
    const { data, error } = await db
      .from("organizer_applications")
      .update({
        organization_name: input.organizationName.trim(),
        reason: input.reason.trim(),
        status: "pending",
        tx_hash: null,
        revocation_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", previous.id)
      .eq("wallet_address", previous.walletAddress)
      .eq("status", previous.status)
      .eq("updated_at", previous.updatedAt)
      .select()
      .maybeSingle();
    if (error) throw databaseError(error);
    if (!data) throw new VerificationError("APPLICATION_CHANGED", 409);
    return mapRow(data);
  });
}

export async function updateOrganizerApplicationStatus(
  id: string,
  updates: {
    status: "approved" | "rejected" | "revoked";
    txHash?: string | null;
    revocationReason?: string | null;
    reviewedBy: string;
    expectedUpdatedAt: string;
  },
): Promise<OrganizerApplication | null> {
  return withDatabase(async (db) => {
    // CAS and wallet-wide revocation are one database transaction, not two HTTP writes.
    const { data, error } = await db.rpc("review_organizer_application", {
      p_id: id,
      p_status: updates.status,
      p_reviewed_by: updates.reviewedBy.toLowerCase(),
      p_expected_updated_at: updates.expectedUpdatedAt,
      p_tx_hash: updates.txHash ?? null,
      p_revocation_reason: updates.revocationReason ?? null,
    });
    if (error) throw databaseError(error);
    if (data?.status === "CHANGED") return null;
    if (data?.status !== "OK")
      throw new VerificationError("SERVICE_UNAVAILABLE", 503);
    return mapRow(data.application);
  });
}
