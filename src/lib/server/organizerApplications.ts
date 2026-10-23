import "server-only";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";

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

// Fallback in-memory store in case migration has not been applied to Supabase yet
const fallbackStore: Map<string, OrganizerApplication> =
  (globalThis as unknown as { __organizerAppsFallback?: Map<string, OrganizerApplication> }).__organizerAppsFallback ??
  new Map<string, OrganizerApplication>();

(globalThis as unknown as { __organizerAppsFallback?: Map<string, OrganizerApplication> }).__organizerAppsFallback = fallbackStore;

function mapRow(row: Record<string, unknown>): OrganizerApplication {
  return {
    id: String(row.id),
    walletAddress: String(row.wallet_address),
    organizationName: String(row.organization_name),
    contactEmail: String(row.contact_email),
    emailVerifiedAt: row.email_verified_at ? String(row.email_verified_at) : null,
    reason: String(row.reason),
    status: (row.status as "pending" | "approved" | "rejected" | "revoked") || "pending",
    txHash: row.tx_hash ? String(row.tx_hash) : null,
    revocationReason: row.revocation_reason ? String(row.revocation_reason) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export async function createOrganizerApplication(input: ApplicationInput): Promise<OrganizerApplication> {
  const wallet = input.walletAddress.trim().toLowerCase();
  const orgName = input.organizationName.trim();
  const email = input.contactEmail.trim().toLowerCase();
  const reason = input.reason.trim();

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Không cho token cũ hoặc lỗi database lách ràng buộc email qua fallback memory.
  await ensureEmailWallet(email, wallet, true);

  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("organizer_applications")
      .insert({
        id,
        wallet_address: wallet,
        organization_name: orgName,
        contact_email: email,
        email_verified_at: input.emailVerifiedAt,
        reason,
        status: "pending",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist yet, fall back gracefully to memory store
      console.warn("[organizerApplications] Supabase insert failed, using fallback:", error.message);
      const fallbackApp: OrganizerApplication = {
        id,
        walletAddress: wallet,
        organizationName: orgName,
        contactEmail: email,
        emailVerifiedAt: input.emailVerifiedAt,
        reason,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      fallbackStore.set(id, fallbackApp);
      return fallbackApp;
    }

    return mapRow(data as Record<string, unknown>);
  } catch (err) {
    console.warn("[organizerApplications] Supabase unavailable, using fallback:", err);
    const fallbackApp: OrganizerApplication = {
      id,
      walletAddress: wallet,
      organizationName: orgName,
      contactEmail: email,
      emailVerifiedAt: input.emailVerifiedAt,
      reason,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    fallbackStore.set(id, fallbackApp);
    return fallbackApp;
  }
}

export async function listOrganizerApplications(options?: {
  walletAddress?: string;
  status?: string;
}): Promise<OrganizerApplication[]> {
  const filterWallet = options?.walletAddress ? options.walletAddress.trim().toLowerCase() : undefined;
  const filterStatus = options?.status?.trim().toLowerCase();

  try {
    const db = supabaseAdmin();
    let query = db.from("organizer_applications").select("*").order("created_at", { ascending: false });

    if (filterWallet) {
      query = query.ilike("wallet_address", filterWallet);
    }
    if (filterStatus && filterStatus !== "all") {
      if (filterStatus === "revoked") {
        query = query.eq("status", "revoked");
      } else {
        query = query.eq("status", filterStatus);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[organizerApplications] Supabase list failed, reading fallback:", error.message);
      return getFallbackApplications(filterWallet, filterStatus);
    }

    const dbApps = ((data || []) as Record<string, unknown>[]).map(mapRow);
    // Combine with any fallback entries created during local dev
    const combined = [...dbApps];
    for (const app of fallbackStore.values()) {
      if (!combined.some(c => c.id === app.id)) {
        if (filterWallet && app.walletAddress.toLowerCase() !== filterWallet) continue;
        if (filterStatus && filterStatus !== "all" && app.status !== filterStatus) continue;
        combined.push(app);
      }
    }
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return getFallbackApplications(filterWallet, filterStatus);
  }
}

function getFallbackApplications(wallet?: string, status?: string): OrganizerApplication[] {
  let list = Array.from(fallbackStore.values());
  if (wallet) {
    list = list.filter(a => a.walletAddress.toLowerCase() === wallet);
  }
  if (status && status !== "all") {
    list = list.filter(a => a.status === status);
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateOrganizerApplicationStatus(
  id: string,
  updates: {
    status: "approved" | "rejected" | "revoked";
    txHash?: string | null;
    revocationReason?: string | null;
    reviewedBy?: string | null;
    expectedUpdatedAt?: string;
  }
): Promise<OrganizerApplication | null> {
  const now = new Date().toISOString();

  try {
    const db = supabaseAdmin();
    let query = db
      .from("organizer_applications")
      .update({
        status: updates.status,
        tx_hash: updates.txHash || null,
        revocation_reason: updates.revocationReason || null,
        reviewed_by: updates.reviewedBy?.toLowerCase() || null,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", id);
    if (updates.status === "revoked") query = query.eq("status", "approved");
    if (updates.expectedUpdatedAt) query = query.eq("updated_at", updates.expectedUpdatedAt);
    const { data, error } = await query.select().maybeSingle();

    if (error) {
      console.warn("[organizerApplications] Supabase update failed, updating fallback:", error.message);
      const app = fallbackStore.get(id);
      if (app && (!updates.expectedUpdatedAt || app.updatedAt === updates.expectedUpdatedAt)) {
        if (updates.status === "revoked" && app.status !== "approved") return null;
        app.status = updates.status;
        app.txHash = updates.txHash || null;
        app.revocationReason = updates.revocationReason || null;
        app.reviewedBy = updates.reviewedBy?.toLowerCase() || null;
        app.reviewedAt = now;
        app.updatedAt = now;
        return app;
      }
      return null;
    }

    if (data) {
      if (updates.status === "revoked") {
        const wallet = String((data as Record<string, unknown>).wallet_address);
        if (wallet) {
          await db
            .from("organizer_applications")
            .update({
              status: "revoked",
              tx_hash: updates.txHash || null,
              revocation_reason: updates.revocationReason || null,
              reviewed_by: updates.reviewedBy?.toLowerCase() || null,
              reviewed_at: now,
              updated_at: now,
            })
            .ilike("wallet_address", wallet)
            .eq("status", "approved");
        }
      }
      return mapRow(data as Record<string, unknown>);
    }
    if (updates.expectedUpdatedAt) return null;
  } catch {
    // ignore
  }

  const app = fallbackStore.get(id);
  if (app && (!updates.expectedUpdatedAt || app.updatedAt === updates.expectedUpdatedAt)) {
    if (updates.status === "revoked" && app.status !== "approved") return null;
    app.status = updates.status;
    app.txHash = updates.txHash || null;
    app.revocationReason = updates.revocationReason || null;
    app.reviewedBy = updates.reviewedBy?.toLowerCase() || null;
    app.reviewedAt = now;
    app.updatedAt = now;
    return app;
  }

  return null;
}
