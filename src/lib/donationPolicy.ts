import { maxUint256 } from "viem";

/** Không đặt ngưỡng nghiệp vụ: chỉ cần > 0 và nằm trong miền uint256 của token.
 * Giữ ABI Factory hiện tại: 1 micro-USDC là đơn vị dương nhỏ nhất;
 * maxUint256 là không đặt trần, không phải số tiền gợi ý cho người dùng.
 * Round cũ vẫn phải tuân theo các giá trị immutable đã deploy.
 */
export const OPEN_DONATION_POLICY = {
  minDonation: 1n,
  maxDonation: maxUint256,
  maxPerRound: maxUint256,
} as const;

export const isUncappedDonation = (maximum?: bigint) => maximum === maxUint256;
