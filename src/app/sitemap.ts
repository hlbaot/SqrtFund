import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";
// Không có URL từ RPC hay ví trong build và request sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/rounds", "/verify", "/support", "/rules"].map(path => ({ url: new URL(path, getSiteUrl()).href, changeFrequency: path === "/rounds" ? "daily" : "weekly", priority: path === "/" ? 1 : 0.7 }));
}
