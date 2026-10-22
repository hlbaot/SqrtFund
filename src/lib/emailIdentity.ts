import { keccak256, toBytes } from "viem";
import { normalizeEmail } from "@/lib/verify/domain";

/** Dùng chung định danh email cho sinh viên và Organizer, kể cả alias +tag. */
export function emailIdentityHash(email: string): string {
  return keccak256(toBytes(normalizeEmail(email)));
}
