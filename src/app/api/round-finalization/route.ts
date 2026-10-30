import { NextResponse } from "next/server";
import { governanceRound } from "@/lib/roundGovernance";
import { governanceChain } from "@/lib/server/roundGovernance";
import { readFinalizationTiming, type FinalizationTiming } from "@/lib/finalization";
import type { Address } from "viem";
export const runtime = "nodejs";
const cache = new Map<string, FinalizationTiming>();
const pending = new Map<string, Promise<FinalizationTiming | null>>();
export async function GET(request: Request) {
  let round;
  try { round = governanceRound(new URL(request.url).searchParams.get("round")); } catch { return NextResponse.json({ code: "INVALID_ROUND" }, { status: 400 }); }
  const key = `${process.env.NEXT_PUBLIC_FACTORY_ADDRESS}:${process.env.NEXT_PUBLIC_RPC_URL}:${round}`;
  try {
    let timing = cache.get(key) ?? null;
    if (!timing) {
      let operation = pending.get(key);
      if (!operation) {
        if (pending.size >= 64) return NextResponse.json({ code: "FINALIZATION_UNAVAILABLE" }, { status: 503 });
        operation = (async () => readFinalizationTiming(await governanceChain(round), round as Address))();
        pending.set(key, operation);
      }
      try { timing = await operation; } finally { pending.delete(key); }
      if (timing) { if (cache.size >= 256) cache.delete(cache.keys().next().value!); cache.set(key, timing); }
    }
    return NextResponse.json({ timing }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ code: "FINALIZATION_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
