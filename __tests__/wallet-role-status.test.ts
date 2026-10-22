import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WalletRoleStatus } from "@/components/layout/WalletRoleStatus";
import type { RoleReadStatus } from "@/hooks/useRole";

function render(profile: "student" | "organizer" | "platform", studentStatus: RoleReadStatus, organizerStatus: RoleReadStatus) {
  return renderToStaticMarkup(createElement(WalletRoleStatus, { profile, studentStatus, organizerStatus, locale: "vi", onRetry: () => {} }));
}
it("shows only Student status even when Organizer reads fail", () => {
  const html = render("student", "confirmed", "unsupported");
  expect(html).toContain("Sinh viên");
  expect(html).toContain("Đã xác minh");
  expect(html).not.toContain("Organizer");
  expect(html).not.toContain("Nhà tổ chức");
  expect(html).not.toContain("Kiểm tra lại quyền");
});
it("shows only Organizer status without requiring Student verification", () => {
  const html = render("organizer", "error", "confirmed");
  expect(html).toContain("Nhà tổ chức");
  expect(html).toContain("Đã được cấp quyền");
  expect(html).not.toContain("Sinh viên");
  expect(html).not.toContain("xác minh");
  expect(html).not.toContain("Kiểm tra lại quyền");
});
it("does not grant authorization when an unapproved wallet selects Organizer", () => {
  const html = render("organizer", "absent", "absent");
  expect(html).toContain("Chưa được cấp quyền");
  expect(html).not.toContain("Đã được cấp quyền");
});
it("distinguishes loading, absence and failed checks for the selected profile", () => {
  expect(render("student", "loading", "confirmed")).toContain("Đang kiểm tra");
  expect(render("student", "absent", "confirmed")).toContain("Chưa xác minh");
  expect(render("organizer", "confirmed", "error")).toContain("Kiểm tra lại quyền");
  expect(render("organizer", "confirmed", "unsupported")).toContain("chưa cập nhật hợp đồng");
});
it("keeps platform approval administrators separate from both profiles", () => {
  const html = render("platform", "confirmed", "confirmed");
  expect(html).toContain("Quản trị nền tảng");
  expect(html).not.toContain("Đã xác minh");
  expect(html).not.toContain("Đã được cấp quyền");
});
