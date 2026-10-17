import { createConfig, injected } from "wagmi";
import { createFujiTransport } from "@/lib/contracts/rpc";
import { fuji } from "@/lib/chains";

export const wagmiConfig = createConfig({
  chains: [fuji],
  connectors: [injected()],
  ssr: true,
  transports: {
    [fuji.id]: createFujiTransport(process.env.NEXT_PUBLIC_RPC_URL, process.env.NEXT_PUBLIC_RPC_URL_FALLBACK),
  },
});
