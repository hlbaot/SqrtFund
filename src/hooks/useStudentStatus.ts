"use client";
import { useAccount, useReadContract } from "wagmi";
import { studentRegistryAbi } from "@/lib/contracts/abis";
import { isStudentRegistryConfigured, studentRegistryAddress } from "@/lib/contracts/addresses";
/** Đọc danh tính Student không phụ thuộc factory, project hay round đã chọn. */
export function useStudentStatus() {
  const { address, isConnected, chainId } = useAccount();
  const active = isConnected && chainId === 43113;
  const query = useReadContract({ address: studentRegistryAddress, abi: studentRegistryAbi,
    functionName: "isStudent", args: address ? [address] : undefined, chainId: 43113,
    query: { enabled: Boolean(active && address && isStudentRegistryConfigured), refetchInterval: 5000, refetchOnWindowFocus: true },
  });
  return { isStudent: Boolean(active && query.data), isConfigured: isStudentRegistryConfigured,
    isLoading: Boolean(active && isStudentRegistryConfigured && query.isLoading),
    isError: Boolean(active && isStudentRegistryConfigured && query.isError), refetch: query.refetch };
}
