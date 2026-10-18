import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const label = process.argv[2] || "before";
if (!/^[a-z-]+$/.test(label)) throw new Error("Use a plain audit label");
const base = process.argv[3] || "http://127.0.0.1:3100";
const directory = `/tmp/sqrt-performance/${label}`;
mkdirSync(directory, { recursive: true });
const routes = [["home", "/"], ["rounds", "/rounds"], ["round", "/round"], ["detail", "/round/0x1111111111111111111111111111111111111111"], ["my", "/my"], ["admin", "/admin"], ["register", "/register"], ["verify", "/verify"]];
const results = [];
routeLoop: for (const [name, path] of routes) {
  const output = join(directory, `${name}.json`);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      execFileSync("pnpm", ["dlx", "lighthouse", new URL(path, base).href,
    "--chrome-flags=--headless --no-sandbox --disable-gpu", "--only-categories=performance", "--output=json", `--output-path=${output}`, "--save-assets", "--quiet"], {
    env: { ...process.env, CHROME_PATH: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }, stdio: ["ignore", "ignore", "pipe"], timeout: 180_000,
      });
      break;
    } catch {
      if (attempt === 0) continue;
      const row = { route: name === "detail" ? "/round/[id]" : path, runtimeError: "LIGHTHOUSE_FAILED" };
      results.push(row); console.log(JSON.stringify(row));
      writeFileSync(join(directory, "summary.json"), JSON.stringify({ results }, null, 2));
      continue routeLoop;
    }
  }
  const report = JSON.parse(readFileSync(output, "utf8"));
  const logName = readdirSync(directory).find(file => file.startsWith(`${name}-`) && file.endsWith(".devtoolslog.json"));
  let rpcHttpRequests = 0; let rpcMethods = 0; let ethCalls = 0;
  if (logName) {
    const entries = JSON.parse(readFileSync(join(directory, logName), "utf8"));
    const seen = new Set();
    for (const entry of entries) {
      if (entry.method !== "Network.requestWillBeSent" || seen.has(entry.params.requestId)) continue;
      let body; try { body = JSON.parse(entry.params.request.postData || "null"); } catch { continue; }
      const batch = Array.isArray(body) ? body : [body];
      if (!batch.length || !batch.every(item => item?.jsonrpc === "2.0" && typeof item.method === "string")) continue;
      seen.add(entry.params.requestId); rpcHttpRequests++; rpcMethods += batch.length;
      ethCalls += batch.filter(item => item.method === "eth_call").length;
    }
  }
  const value = key => report.audits?.[key]?.numericValue;
  const row = { route: name === "detail" ? "/round/[id]" : path, score: report.categories?.performance?.score, lcpMs: value("largest-contentful-paint"), cls: value("cumulative-layout-shift"), tbtMs: value("total-blocking-time"), rpcHttpRequests: logName ? rpcHttpRequests : null, rpcMethods: logName ? rpcMethods : null, ethCalls: logName ? ethCalls : null, runtimeError: report.runtimeError?.code || null };
  results.push(row); writeFileSync(join(directory, "summary.json"), JSON.stringify({ methodology: "One Lighthouse default mobile navigation audit per route, fresh Chrome profile, no connected wallet. RPC counts include retries/polls captured during that audit, not a fixed-duration steady-state window. INP is not measured by a navigation audit.", results }, null, 2));
  console.log(JSON.stringify(row));
}
