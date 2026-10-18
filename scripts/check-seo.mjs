const base = process.argv[2] || "http://127.0.0.1:3100";
for (const path of ["/", "/rounds", "/round", "/round/0x1111111111111111111111111111111111111111", "/verify", "/admin", "/my", "/register"]) {
  // Next.js puts awaited metadata in <head> for HTML-limited preview crawlers.
  const response = await fetch(new URL(path, base), { headers: { "User-Agent": "facebookexternalhit/1.1" } });
  const html = await response.text();
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] || "";
  const value = expression => head.match(expression)?.[1] || null;
  const names = ["description", "robots", "og:title", "og:description", "og:url", "og:locale", "og:image", "twitter:card"];
  const duplicates = names.filter(name => (head.match(new RegExp(`(?:name|property)="${name}"`, "g")) || []).length > 1);
  const row = { route: path, status: response.status, lang: html.match(/<html[^>]*lang="([^"]+)"/)?.[1],
    title: value(/<title>([^<]+)<\/title>/), canonical: value(/<link rel="canonical" href="([^"]+)"/),
    robots: value(/<meta name="robots" content="([^"]+)"/), ogImage: value(/<meta property="og:image" content="([^"]+)"/),
    imageWidth: value(/<meta property="og:image:width" content="([^"]+)"/), imageHeight: value(/<meta property="og:image:height" content="([^"]+)"/),
    twitterCard: value(/<meta name="twitter:card" content="([^"]+)"/), duplicates };
  console.log(JSON.stringify(row));
  if (!row.title?.includes("SqrtFund") || !row.canonical || row.imageWidth !== "1200" || row.imageHeight !== "630" || duplicates.length || (head.match(/<title>/g) || []).length !== 1) process.exitCode = 1;
}
const response = await fetch(new URL("/verify", base), { headers: { Cookie: "sqrt-fund-locale=vi", "User-Agent": "facebookexternalhit/1.1" } });
const html = await response.text();
console.log(JSON.stringify({ localeCheck: "vi", lang: html.match(/<html[^>]*lang="([^"]+)"/)?.[1], title: html.match(/<title>([^<]+)<\/title>/)?.[1] }));
