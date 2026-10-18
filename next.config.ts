import type { NextConfig } from "next";
import { ClientBundleStatsPlugin } from "./scripts/bundle-stats.mjs";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // Development uses Turbopack; the opt-in stats plugin applies to webpack builds.
  turbopack: {},
  webpack(config, { isServer }) {
    if (!isServer && process.env.ANALYZE_BUNDLE === "1") config.plugins.push(new ClientBundleStatsPlugin());
    return config;
  },
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
