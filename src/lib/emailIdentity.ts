import { keccak256, toBytes } from "viem";
import { normalizeEmail } from "@/lib/verify/domain";

/** Chỉ đối chiếu dữ liệu legacy; email mới dùng khoá email trực tiếp và ID ngẫu nhiên. */
export function legacyEmailIdentityHash(email: string): string {
  return keccak256(toBytes(normalizeEmail(email)));
}
