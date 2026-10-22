import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { OrganizerApplication } from "@/lib/server/organizerApplications";

type Query = { queryFn: (context: { signal: AbortSignal }) => Promise<unknown>; refetchInterval: number };
const f = vi.hoisted(() => ({
  client: null as QueryClient | null, queries: [] as Query[],
  mutation: null as null | { onSuccess: (updated: OrganizerApplication) => Promise<void> },
}));
vi.mock("@tanstack/react-query", async original => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQueryClient: () => f.client,
  useQuery: (query: Query) => { f.queries.push(query); return { data: undefined }; },
  useMutation: (mutation: NonNullable<typeof f.mutation>) => { f.mutation = mutation; return { mutateAsync: vi.fn() }; },
}));
import { useMyOrganizerApplication, useOrganizerApplicationsAdmin } from "@/hooks/useOrganizerApplications";
beforeEach(() => { f.client = new QueryClient(); f.queries = []; });
afterEach(() => { f.client?.clear(); vi.unstubAllGlobals(); });
it("moves a reviewed application across every cached status filter immediately", async () => {
  const pending = { id: "one", status: "pending", walletAddress: "0x123" } as OrganizerApplication;
  const approved = { ...pending, status: "approved" as const };
  for (const filter of ["all", "pending", "approved", "rejected"]) {
    f.client!.setQueryData(["admin-organizer-applications", filter], filter === "all" || filter === "pending" ? [pending] : []);
  }
  useOrganizerApplicationsAdmin("pending");
  await f.mutation!.onSuccess(approved);
  expect(f.client!.getQueryData(["admin-organizer-applications", "all"])).toEqual([approved]);
  expect(f.client!.getQueryData(["admin-organizer-applications", "approved"])).toEqual([approved]);
  expect(f.client!.getQueryData(["admin-organizer-applications", "pending"])).toEqual([]);
  expect(f.client!.getQueryData(["admin-organizer-applications", "rejected"])).toEqual([]);
});
it("refreshes both browsers' application views without using a cached response", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, applications: [] }) });
  vi.stubGlobal("fetch", fetcher);
  useOrganizerApplicationsAdmin("all"); useMyOrganizerApplication("0x123");
  const signal = new AbortController().signal;
  for (const query of f.queries) {
    expect(query.refetchInterval).toBe(5000);
    await query.queryFn({ signal });
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [, options] of fetcher.mock.calls) expect(options).toMatchObject({ cache: "no-store", signal });
});
