import { authorizeOrganizerReview } from "@/lib/server/organizerReviewAuthorization";
import { authorizeOrganizerRead } from "@/lib/server/organizerReadAuthorization";
import { publishNotificationChange } from "@/lib/server/publishNotificationChange";
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyOrganizerEmailProof } from "@/lib/server/organizerEmailProof";
import { VerificationError } from "@/lib/verify/errors";
import { verifyOrganizerReapplication } from "@/lib/server/organizerReapplication";
import {
  createOrganizerApplication,
  resubmitOrganizerApplication,
  listOrganizerApplications,
  updateOrganizerApplicationStatus,
} from "@/lib/server/organizerApplications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store", Vary: "Authorization" };
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress") || undefined;
    const status = searchParams.get("status") || undefined;

    if (walletAddress && !isAddress(walletAddress)) {
      return privateJson({ ok: false, error: "INVALID_WALLET_ADDRESS" }, { status: 400, headers });
    }

    await authorizeOrganizerRead(request, walletAddress);
    const applications = await listOrganizerApplications({ walletAddress, status });
    return privateJson({ ok: true, applications }, { headers });
  } catch (error) {
    if (error instanceof VerificationError)
      return privateJson({ ok: false, error: error.code }, { status: error.status, headers });
    // Do not log credentials, query strings or application data.
    console.error("[api/organizer-applications] GET unavailable");
    return privateJson({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return privateJson({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { walletAddress, organizationName, contactEmail, reason } = body as Record<string, unknown>;

    if (typeof walletAddress !== "string" || !isAddress(walletAddress)) {
      return privateJson({ ok: false, error: "INVALID_WALLET_ADDRESS" }, { status: 400 });
    }

    if (typeof organizationName !== "string" || organizationName.trim().length < 2 || organizationName.trim().length > 120) {
      return privateJson({ ok: false, error: "INVALID_ORGANIZATION_NAME" }, { status: 400 });
    }

    if (typeof contactEmail !== "string" || !EMAIL_REGEX.test(contactEmail.trim())) {
      return privateJson({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
    }

    if (typeof reason !== "string" || reason.trim().length < 5 || reason.trim().length > 2000) {
      return privateJson({ ok: false, error: "INVALID_REASON" }, { status: 400 });
    }

    const existing = await listOrganizerApplications({ walletAddress: walletAddress.trim() });
    const previous = existing[0];
    const reverified = await verifyOrganizerReapplication(body, previous);
    // Reuse stored verification only with a valid signature from the same wallet.
    if (!reverified && !verifyOrganizerEmailProof(body.emailVerificationToken, contactEmail, walletAddress)) {
      return privateJson({ ok: false, error: "EMAIL_NOT_VERIFIED" }, { status: 403 });
    }

    // Check if wallet already has a pending application
    const activePending = existing.find(a => a.status === "pending");
    if (activePending) {
      return privateJson(
        { ok: false, error: "APPLICATION_ALREADY_PENDING", existingApplication: activePending },
        { status: 409 }
      );
    }

    const input = {
      walletAddress: walletAddress.trim(),
      organizationName: organizationName.trim(),
      contactEmail: contactEmail.trim(),
      emailVerifiedAt: reverified ? previous.emailVerifiedAt! : new Date().toISOString(),
      reason: reason.trim(),
    };
    const application = reverified
      ? await resubmitOrganizerApplication(previous, input)
      : await createOrganizerApplication(input);

    await publishNotificationChange();
    return privateJson({ ok: true, application }, { status: 201 });
  } catch (error) {
    if (error instanceof VerificationError) return privateJson({ ok: false, error: error.code }, { status: error.status });
    console.error("[api/organizer-applications] POST unavailable");
    return privateJson({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return privateJson({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { id, status, txHash, reviewedBy, revocationReason } = body as Record<string, unknown>;

    if (typeof id !== "string" || !id.trim()) {
      return privateJson({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    if (status !== "approved" && status !== "rejected" && status !== "revoked") {
      return privateJson({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
    }

    if (reviewedBy && (typeof reviewedBy !== "string" || !isAddress(reviewedBy))) {
      return privateJson({ ok: false, error: "INVALID_REVIEWER_ADDRESS" }, { status: 400 });
    }

    // Require revocation reason when revoking
    if (status === "revoked" && (typeof revocationReason !== "string" || revocationReason.trim().length < 3)) {
      return privateJson({ ok: false, error: "REVOCATION_REASON_REQUIRED" }, { status: 400 });
    }

    const authorization = await authorizeOrganizerReview(body);
    const application = await updateOrganizerApplicationStatus(id.trim(), {
      status,
      txHash: typeof txHash === "string" ? txHash.trim() : null,
      revocationReason: status === "revoked" && typeof revocationReason === "string" ? revocationReason.trim() : null,
      reviewedBy: authorization.reviewedBy,
      expectedUpdatedAt: authorization.expectedUpdatedAt,
    });

    if (!application) {
      return privateJson({ ok: false, error: "APPLICATION_CHANGED" }, { status: 409 });
    }

    await publishNotificationChange();
    return privateJson({ ok: true, application });
  } catch (error) {
    if (error instanceof VerificationError) return privateJson({ ok: false, error: error.code }, { status: error.status });
    console.error("[api/organizer-applications] PATCH unavailable");
    return privateJson({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
