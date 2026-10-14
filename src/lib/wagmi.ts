import { createConfig, http, injected } from "wagmi";
import { fuji } from "@/lib/chains";

export const wagmiConfig = createConfig({
  chains: [fuji],
  connectors: [injected()],
  ssr: true,
  transports: {
    [fuji.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
});
