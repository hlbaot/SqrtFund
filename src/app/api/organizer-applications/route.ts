import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyOrganizerEmailProof } from "@/lib/server/organizerEmailProof";
import {
  createOrganizerApplication,
  listOrganizerApplications,
  updateOrganizerApplicationStatus,
} from "@/lib/server/organizerApplications";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress") || undefined;
    const status = searchParams.get("status") || undefined;

    if (walletAddress && !isAddress(walletAddress)) {
      return NextResponse.json({ ok: false, error: "INVALID_WALLET_ADDRESS" }, { status: 400 });
    }

    const applications = await listOrganizerApplications({ walletAddress, status });
    return NextResponse.json({ ok: true, applications });
  } catch (error) {
    console.error("[api/organizer-applications] GET error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { walletAddress, organizationName, contactEmail, reason } = body as Record<string, unknown>;

    if (typeof walletAddress !== "string" || !isAddress(walletAddress)) {
      return NextResponse.json({ ok: false, error: "INVALID_WALLET_ADDRESS" }, { status: 400 });
    }

    if (typeof organizationName !== "string" || organizationName.trim().length < 2 || organizationName.trim().length > 120) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZATION_NAME" }, { status: 400 });
    }

    if (typeof contactEmail !== "string" || !EMAIL_REGEX.test(contactEmail.trim())) {
      return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
    }

    if (typeof reason !== "string" || reason.trim().length < 5 || reason.trim().length > 2000) {
      return NextResponse.json({ ok: false, error: "INVALID_REASON" }, { status: 400 });
    }

    // Luôn kiểm tra ở backend; không thể bỏ qua OTP bằng cách gọi API trực tiếp.
    if (!verifyOrganizerEmailProof(body.emailVerificationToken, contactEmail, walletAddress)) {
      return NextResponse.json({ ok: false, error: "EMAIL_NOT_VERIFIED" }, { status: 403 });
    }

    // Check if wallet already has a pending application
    const existing = await listOrganizerApplications({ walletAddress: walletAddress.trim(), status: "pending" });
    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "APPLICATION_ALREADY_PENDING", existingApplication: existing[0] },
        { status: 409 }
      );
    }

    const application = await createOrganizerApplication({
      walletAddress: walletAddress.trim(),
      organizationName: organizationName.trim(),
      contactEmail: contactEmail.trim(),
      emailVerifiedAt: new Date().toISOString(),
      reason: reason.trim(),
    });

    return NextResponse.json({ ok: true, application }, { status: 201 });
  } catch (error) {
    console.error("[api/organizer-applications] POST error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { id, status, txHash, reviewedBy } = body as Record<string, unknown>;

    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
    }

    if (reviewedBy && (typeof reviewedBy !== "string" || !isAddress(reviewedBy))) {
      return NextResponse.json({ ok: false, error: "INVALID_REVIEWER_ADDRESS" }, { status: 400 });
    }

    const application = await updateOrganizerApplicationStatus(id.trim(), {
      status,
      txHash: typeof txHash === "string" ? txHash.trim() : null,
      reviewedBy: typeof reviewedBy === "string" ? reviewedBy.trim() : null,
    });

    if (!application) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, application });
  } catch (error) {
    console.error("[api/organizer-applications] PATCH error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
