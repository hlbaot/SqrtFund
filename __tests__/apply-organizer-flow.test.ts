import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { copy } from "@/lib/copy";

describe("Organizer Application Flow & Migration", () => {
  it("migration 0002_organizer_applications.sql contains correct table, checks, and RLS policies", () => {
    const migrationPath = path.resolve(process.cwd(), "supabase/migrations/0002_organizer_applications.sql");
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("create table if not exists public.organizer_applications");
    expect(sql).toContain("wallet_address text not null");
    expect(sql).toContain("organization_name text not null");
    expect(sql).toContain("contact_email text not null");
    expect(sql).toContain("reason text not null");
    expect(sql).toContain("status in ('pending', 'approved', 'rejected')");
    expect(sql).toContain("tx_hash text");
    expect(sql).toContain("reviewed_by text");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("grant all on public.organizer_applications to service_role");
  });

  it("provides comprehensive copy for Vietnamese and English application flows", () => {
    const vi = copy.vi.applyOrganizer;
    const en = copy.en.applyOrganizer;

    expect(vi.btnMenu).toBe("Đăng ký làm Organizer");
    expect(en.btnMenu).toBe("Apply as Organizer");

    expect(vi.title).toBeTruthy();
    expect(en.title).toBeTruthy();

    expect(vi.orgNameLabel).toBeTruthy();
    expect(en.orgNameLabel).toBeTruthy();

    expect(vi.emailLabel).toBeTruthy();
    expect(en.emailLabel).toBeTruthy();

    expect(vi.reasonLabel).toBeTruthy();
    expect(en.reasonLabel).toBeTruthy();

    expect(vi.submitBtn).toBeTruthy();
    expect(en.submitBtn).toBeTruthy();

    expect(vi.successTitle).toBeTruthy();
    expect(en.successTitle).toBeTruthy();

    expect(vi.alreadyPendingTitle).toBeTruthy();
    expect(en.alreadyPendingTitle).toBeTruthy();

    expect(vi.statusPendingBadge).toBe("Đang chờ duyệt");
    expect(en.statusPendingBadge).toBe("Pending Review");
  });

  it("has corresponding admin copy for managing applications in both languages", () => {
    const viAdmin = copy.vi.admin;
    const enAdmin = copy.en.admin;

    expect(viAdmin.applicationsTitle).toBe("Danh sách đơn đăng ký Organizer");
    expect(enAdmin.applicationsTitle).toBe("Organizer Applications");

    expect(viAdmin.btnGrantAndApprove).toBe("Cấp quyền On-chain");
    expect(enAdmin.btnGrantAndApprove).toBe("Grant On-chain");

    expect(viAdmin.btnReject).toBe("Từ chối");
    expect(enAdmin.btnReject).toBe("Reject");

    expect(viAdmin.appColOrg).toBeTruthy();
    expect(enAdmin.appColOrg).toBeTruthy();

    expect(viAdmin.appColWallet).toBeTruthy();
    expect(enAdmin.appColWallet).toBeTruthy();

    expect(viAdmin.appColReason).toBeTruthy();
    expect(enAdmin.appColReason).toBeTruthy();
  });
});
