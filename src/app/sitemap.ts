import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";
// No RPC or wallet-derived URLs in the build or sitemap request path.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/rounds", "/verify"].map(path => ({ url: new URL(path, getSiteUrl()).href, changeFrequency: path === "/rounds" ? "daily" : "weekly", priority: path === "/" ? 1 : 0.7 }));
}
