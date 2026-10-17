import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { hashOtp } from "@/lib/verify/otp";
// Explicitly opt in to a SEPARATE dev project. Never reuse production variables.
const enabled = process.env.RUN_VERIFICATION_INTEGRATION === "1" && Boolean(process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY);
const secret = "integration-only-secret-at-least-32-characters";
const hex = (bytes: number) => `0x${randomBytes(bytes).toString("hex")}`;
describe.skipIf(!enabled)("Supabase verification integration (dev project only)", () => {
  const db = enabled ? createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) : null;
  const ids: string[] = [];
  const hashes: string[] = [];
  function identity() { return { email_hash: hex(32), email_domain: "test.edu.vn", address: hex(20), registry_address: hex(20), ip_hash: randomBytes(32).toString("hex") }; }
  async function seed(overrides: Record<string, unknown> = {}) {
    const id = randomUUID(); ids.push(id);
    const row = { ...identity(), id, otp_hash: hashOtp(id, "012345", secret), ...overrides };
    const result = await db!.from("otp_requests").insert(row); expect(result.error).toBeNull();
    return row;
  }
  async function consume(id: string, code = "012345") {
    const { data, error } = await db!.rpc("consume_otp", { p_id: id, p_otp_hash: hashOtp(id, code, secret) });
    expect(error).toBeNull(); return data;
  }
  async function reserve(who = identity()) {
    const id = randomUUID(); ids.push(id);
    const values = { ...who, id, otp_hash: hashOtp(id, "012345", secret) };
    const { data, error } = await db!.rpc("reserve_otp", Object.fromEntries(Object.entries(values).map(([k, v]) => [`p_${k}`, v])));
    expect(error).toBeNull(); return { id, result: data };
  }
  afterAll(async () => {
    if (ids.length) { const result = await db!.from("otp_requests").delete().in("id", ids); expect(result.error).toBeNull(); }
    if (hashes.length) { const result = await db!.from("verifications").delete().in("email_hash", hashes); expect(result.error).toBeNull(); }
  });
  it("consumes a correct code once and rejects reuse", async () => {
    const row = await seed(); expect((await consume(row.id)).status).toBe("OK"); expect((await consume(row.id)).status).toBe("EXPIRED");
  });
  it("rejects an expired code", async () => {
    const row = await seed({ expires_at: new Date(Date.now() - 1000).toISOString() });
    expect((await consume(row.id)).status).toBe("EXPIRED");
  });
  it("counts five wrong attempts and locks even the correct code", async () => {
    const row = await seed();
    for (let i = 0; i < 5; i++) expect(await consume(row.id, "999999")).toEqual({ status: "WRONG", attemptsLeft: 4 - i });
    expect((await consume(row.id)).status).toBe("LOCKED");
  });
  it("only one concurrent confirm succeeds", async () => {
    const row = await seed();
    const outcomes = await Promise.all([consume(row.id), consume(row.id)]);
    expect(outcomes.map(v => v.status).sort()).toEqual(["EXPIRED", "OK"]);
  });
  it("resending invalidates the previous code", async () => {
    const who = identity(); const old = await seed({ ...who, created_at: new Date(Date.now() - 61_000).toISOString() });
    expect((await reserve(who)).result.status).toBe("OK"); expect((await consume(old.id)).status).toBe("EXPIRED");
  });
  it("enforces the 60-second pair cooldown", async () => {
    const who = identity(); expect((await reserve(who)).result.status).toBe("OK");
    const blocked = (await reserve(who)).result;
    expect(blocked.status).toBe("RATE_LIMITED"); expect(blocked.retryAfter).toBeGreaterThan(0); expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });
  it.each(["email_hash", "ip_hash", "address"])("enforces the independent %s limit", async key => {
    const who = identity(); const limit = key === "email_hash" ? 3 : key === "ip_hash" ? 10 : 5;
    for (let i = 0; i < limit; i++) await seed({ [key]: who[key as keyof typeof who] });
    expect((await reserve(who)).result.status).toBe("RATE_LIMITED");
  });
  it("serializes concurrent reservations at the cooldown boundary", async () => {
    const who = identity(); const outcomes = await Promise.all([reserve(who), reserve(who)]);
    expect(outcomes.map(v => v.result.status).sort()).toEqual(["OK", "RATE_LIMITED"]);
  });
  it("resumes the same verified identity and refuses a second email for its wallet", async () => {
    const who = identity(); hashes.push(who.email_hash);
    const { ip_hash: _ip, ...verification } = who; expect(_ip).toBeTruthy();
    expect((await db!.from("verifications").insert(verification)).error).toBeNull();
    expect((await reserve(who)).result.status).toBe("ALREADY_VERIFIED");
    expect((await reserve({ ...who, email_hash: hex(32) })).result.status).toBe("WALLET_ALREADY_VERIFIED");
  });
  it("refuses an email reserved by another wallet globally", async () => {
    const who = identity(); hashes.push(who.email_hash);
    const { ip_hash: _ip, ...verification } = who;
    expect(_ip).toBeTruthy();
    expect((await db!.from("verifications").insert(verification)).error).toBeNull();
    expect((await reserve({ ...who, address: hex(20) })).result.status).toBe("EMAIL_ALREADY_USED");
    expect((await reserve({ ...who, registry_address: hex(20), address: hex(20) })).result.status).toBe("EMAIL_ALREADY_USED");
  });
});
