import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { DEFAULT_SITE_URL, getSiteUrl, metadataForPage, seoCopy } from "@/lib/seo";

afterEach(() => vi.unstubAllEnvs());
it("publishes only static public sitemap URLs with the default base", () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  const urls = sitemap().map(entry => entry.url);
  expect(urls).toEqual([`${DEFAULT_SITE_URL}/`, `${DEFAULT_SITE_URL}/rounds`, `${DEFAULT_SITE_URL}/verify`, `${DEFAULT_SITE_URL}/guide`, `${DEFAULT_SITE_URL}/rules`]);
  expect(urls.some(url => /\/(admin|my|register|api)(?:\/|$)/.test(url))).toBe(false);
  expect(urls.some(url => url.includes("0x"))).toBe(false);
});
it("disallows private routes and API crawling and points to the public sitemap", () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.sqrtfund.tech/");
  const result = robots();
  expect(result.rules).toEqual(expect.objectContaining({ userAgent: "*", allow: ["/", "/rounds", "/verify", "/guide"], disallow: expect.arrayContaining(["/admin", "/my", "/register", "/api/"]) }));
  expect(result.sitemap).toBe("https://www.sqrtfund.tech/sitemap.xml");
  expect(sitemap().every(entry => entry.url.startsWith("https://www.sqrtfund.tech/"))).toBe(true);
});
it.each(["not a url", "javascript:alert(1)", "https://user:password@example.org"])("rejects invalid site origin: %s", value => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", value); expect(getSiteUrl().origin).toBe(DEFAULT_SITE_URL);
});
it("normalizes the site URL to an origin without query or path", () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.sqrtfund.tech/nested?query=1#hash");
  expect(getSiteUrl().href).toBe("https://www.sqrtfund.tech/");
});
describe.each(["vi", "en"] as const)("metadata in %s", locale => {
  it.each(["home", "rounds", "round", "verify"] as const)("sets canonical, preview images and a unique description for %s", page => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", DEFAULT_SITE_URL);
    const result = metadataForPage(page, locale);
    expect(result.title).toBe(seoCopy[locale][page][0]); expect(result.description).toBe(seoCopy[locale][page][1]);
    expect(result.alternates?.canonical).toBeInstanceOf(URL);
    expect(result.openGraph).toEqual(expect.objectContaining({ siteName: "SqrtFund", locale: locale === "vi" ? "vi_VN" : "en_US", images: [expect.objectContaining({ width: 1200, height: 630 })] }));
    expect(result.twitter).toEqual(expect.objectContaining({ card: "summary_large_image" }));
  });
});
it.each(["admin", "my", "register"] as const)("marks %s noindex/nofollow", page => {
  expect(metadataForPage(page).robots).toEqual({ index: false, follow: false });
});
