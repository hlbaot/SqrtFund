import type { NextConfig } from "next";
import { ClientBundleStatsPlugin } from "./scripts/bundle-stats.mjs";

const nextConfig: NextConfig = {
  /* tùy chọn config */
  experimental: {
    agentFeedback: true,
  },
  // Dev dùng Turbopack; plugin stats tùy chọn chỉ áp dụng cho build webpack.
  turbopack: {},
  webpack(config, { isServer }) {
    if (!isServer && process.env.ANALYZE_BUNDLE === "1") config.plugins.push(new ClientBundleStatsPlugin());
    return config;
  },
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  async redirects() {
    return [{ source: "/guide", destination: "/support", permanent: true }];
  },
};

export default nextConfig;
