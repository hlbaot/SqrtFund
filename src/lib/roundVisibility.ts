/** Vòng demo cũ được ẩn khỏi danh sách công khai, không xóa dữ liệu hay tiền trên chain. */
export function isPublicRound(address: string, chainId: number): boolean {
  return !(chainId === 43113 && address.toLowerCase() === "0x483048c8fcad691defa96da09db918cc6632347b");
}
