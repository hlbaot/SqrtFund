import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { fuji } from "@/lib/chains";

export const wagmiConfig = createConfig({
  chains: [fuji],
  connectors: [injected()],
  ssr: true,
  transports: {
    [fuji.id]: http(),
  },
});
