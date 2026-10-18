import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Locale } from "@/lib/copy";
import { metadataForPage, type SeoPage } from "./seo";

export const getRequestLocale = cache(async (): Promise<Locale> => (await cookies()).get("sqrt-fund-locale")?.value === "vi" ? "vi" : "en");
export async function pageMetadata(page: SeoPage, path?: string) {
  return metadataForPage(page, await getRequestLocale(), path);
}
