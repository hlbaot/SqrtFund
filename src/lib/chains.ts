import { avalancheFuji } from "viem/chains";

export const defaultRpcUrl = "https://api.avax-test.network/ext/bc/C/rpc";
export const explorerUrl =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://testnet.snowtrace.io";

export const fuji = {
  ...avalancheFuji,
  rpcUrls: {
    ...avalancheFuji.rpcUrls,
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL ?? defaultRpcUrl],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_RPC_URL ?? defaultRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Snowtrace",
      url: explorerUrl,
    },
  },
};
