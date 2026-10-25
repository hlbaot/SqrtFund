import "server-only";
import { isHex, verifyMessage } from "viem";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { organizerReapplicationMessage, type OrganizerReapplication } from "@/lib/organizerReapplication";
import type { OrganizerApplication } from "./organizerApplications";

/** Stored email verification may be reused only by its wallet and application version. */
export async function verifyOrganizerReapplication(body: Record<string, unknown>, previous?: OrganizerApplication) {
  if (!previous?.emailVerifiedAt || !(previous.status === "revoked" || previous.status === "rejected")
    || typeof body.walletAddress !== "string" || previous.walletAddress.toLowerCase() !== body.walletAddress.toLowerCase()
    || typeof body.contactEmail !== "string" || previous.contactEmail.toLowerCase() !== body.contactEmail.trim().toLowerCase()
    || body.applicationId !== previous.id || body.expectedUpdatedAt !== previous.updatedAt
    || typeof body.issuedAt !== "number" || !Number.isSafeInteger(body.issuedAt)
    || body.issuedAt > Date.now() + 30_000 || Date.now() - body.issuedAt > 300_000
    || typeof body.signature !== "string" || !isHex(body.signature)) return false;
  try {
    return await verifyMessage({ address: previous.walletAddress as `0x${string}`,
      message: organizerReapplicationMessage(body as unknown as OrganizerReapplication, factoryAddress, TARGET_CHAIN_ID), signature: body.signature });
  } catch { return false; }
}
