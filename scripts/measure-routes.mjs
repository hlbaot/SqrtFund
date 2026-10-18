import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { gzipSync } from "node:zlib";

const base = process.argv[2] || "http://127.0.0.1:3100";
const destination = process.argv[3] || "/tmp/sqrt-performance/routes.json";
const paths = ["/", "/rounds", "/round", "/round/0x1111111111111111111111111111111111111111", "/my", "/admin", "/register", "/verify"];
const routes = [];
for (const path of paths) {
  const start = performance.now();
  const response = await fetch(new URL(path, base));
  const html = await response.text();
  const scripts = [...new Set([...html.matchAll(/<script\b([^>]*?)src="([^"?]+)(?:[^\"]*)"[^>]*>/g)]
    .filter(match => !/\bnomodule\b/i.test(match[1]))
    .map(match => match[2]).filter(src => src.startsWith("/_next/") && src.endsWith(".js")))];
  let raw = 0; let gzip = 0;
  for (const script of scripts) {
    const bytes = readFileSync(join(".next", decodeURIComponent(script.slice("/_next/".length))));
    raw += bytes.length; gzip += gzipSync(bytes).length;
  }
  routes.push({ route: path.startsWith("/round/0x") ? "/round/[id]" : path, status: response.status, initialScripts: scripts, initialJsBytes: raw, initialJsGzipBytes: gzip, localHtmlMs: Math.round(performance.now() - start) });
}
const statsPath = ".next/analysis/client-stats.json";
let analysis;
if (existsSync(statsPath)) {
  const stats = JSON.parse(readFileSync(statsPath, "utf8"));
  const modules = new Map();
  function visit(module) {
    if (module.modules?.length) module.modules.forEach(visit);
    else if (module.identifier && module.size) modules.set(module.identifier, { name: module.name || module.identifier, bytes: module.size });
  }
  (stats.modules || []).forEach(visit);
  analysis = { topModules: [...modules.values()].sort((a,b) => b.bytes - a.bytes).slice(0, 25),
    note: "Webpack module sizes are uncompressed source sizes, not their gzip contribution." };
}
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify({ methodology: "Unique modern JS scripts present in initial route HTML; gzip calculated locally. Does not include later lazy chunks or simulate a wallet.", routes, analysis }, null, 2));
for (const row of routes) console.log(`${row.route}: HTTP ${row.status}, ${Math.round(row.initialJsBytes / 1024)} KiB raw / ${(row.initialJsGzipBytes / 1024).toFixed(1)} KiB gzip, ${row.initialScripts.length} scripts`);
if (analysis) console.log("Largest modules:", analysis.topModules.slice(0, 8));
