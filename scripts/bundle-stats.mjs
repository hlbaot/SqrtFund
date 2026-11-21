import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Webpack stats tùy chọn, không chứa source code hay giá trị env.
export class ClientBundleStatsPlugin {
  apply(compiler) {
    compiler.hooks.done.tap("SqrtFundClientBundleStats", stats => {
      const destination = join(process.cwd(), ".next", "analysis");
      mkdirSync(destination, { recursive: true });
      writeFileSync(join(destination, "client-stats.json"), JSON.stringify(stats.toJson({
        all: false, assets: true, chunks: true, chunkModules: true, modules: true,
        nestedModules: true, ids: true, source: false, reasons: false,
      })));
    });
  }
}
