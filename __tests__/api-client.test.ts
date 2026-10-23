import { AxiosError, CanceledError, type AxiosAdapter } from "axios";
import { afterEach, expect, it } from "vitest";
import { api, ApiError } from "@/lib/api";

const originalAdapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = originalAdapter; });

it("serializes JSON bodies while preserving the wallet signature and review version", async () => {
  let sent: Parameters<AxiosAdapter>[0] | undefined;
  api.defaults.adapter = async config => {
    sent = config;
    return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
  };
  const body = { signature: "0xsigned", expectedUpdatedAt: "2026-10-23T00:00:00Z", reviewedBy: "0xwallet" };
  const { data } = await api.patch("/api/organizer-applications", body);
  expect(sent?.method).toBe("patch");
  expect(JSON.parse(sent!.data)).toEqual(body);
  expect(sent?.headers.get("Content-Type")).toBe("application/json");
  expect(data).toEqual({ ok: true });
});
it("encodes wallet and status query parameters", () => {
  const url = api.getUri({ url: "/api/organizer-applications", params: { walletAddress: "wallet&status=approved", status: "pending" } });
  const params = new URL(url, "https://example.test").searchParams;
  expect(params.get("walletAddress")).toBe("wallet&status=approved");
  expect(params.get("status")).toBe("pending");
});
it("preserves OTP retry, remaining attempts and configuration diagnostics on HTTP errors", async () => {
  api.defaults.adapter = async config => {
    throw new AxiosError("Rate limited", "ERR_BAD_REQUEST", config, undefined, {
      config, status: 429, statusText: "Too Many Requests", headers: {},
      data: { code: "RATE_LIMITED", retryAfter: 60, attemptsLeft: 2, missing: ["SMTP_HOST"] },
    });
  };
  await expect(api.post("/api/verify/request-otp", {})).rejects.toMatchObject({
    name: "ApiError", code: "RATE_LIMITED", message: "RATE_LIMITED", retryAfter: 60, attemptsLeft: 2, missing: ["SMTP_HOST"],
  });
});
it.each(["EMAIL_ALREADY_USED", "EMAIL_NOT_VERIFIED", "APPLICATION_ALREADY_PENDING", "APPLICATION_CHANGED"])("preserves the Organizer error %s", async code => {
  api.defaults.adapter = async config => {
    throw new AxiosError("Rejected", "ERR_BAD_REQUEST", config, undefined, {
      config, status: 409, statusText: "Conflict", headers: {}, data: { error: code },
    });
  };
  await expect(api.post("/api/organizer-applications", {})).rejects.toMatchObject({ code, message: code });
});
it("normalizes a network error without exposing Axios request config", async () => {
  api.defaults.adapter = async config => { throw new AxiosError("Network Error", "ERR_NETWORK", config); };
  const error = await api.get("/api/verify/stats").catch(error => error);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.code).toBe("SERVICE_UNAVAILABLE");
  expect(error).not.toHaveProperty("config");
});
it("uses a stable error code for a non-JSON server failure", async () => {
  api.defaults.adapter = async config => {
    throw new AxiosError("Bad Gateway", "ERR_BAD_RESPONSE", config, undefined, {
      config, status: 502, statusText: "Bad Gateway", headers: {}, data: "<html>Bad gateway</html>",
    });
  };
  await expect(api.get("/api/verify/stats")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
});
it("preserves Axios cancellation", async () => {
  const cancelled = new CanceledError("Cancelled");
  api.defaults.adapter = async () => { throw cancelled; };
  await expect(api.get("/api/verify/stats")).rejects.toBe(cancelled);
});
