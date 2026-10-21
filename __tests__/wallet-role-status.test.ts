import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WalletRoleStatus } from "@/components/layout/WalletRoleStatus";
import type { RoleReadStatus, WalletRole } from "@/hooks/useRole";

function render(studentStatus: RoleReadStatus, organizerStatus: RoleReadStatus, roles: WalletRole[] = []) {
  return renderToStaticMarkup(createElement(WalletRoleStatus, { studentStatus, organizerStatus, roles, locale: "vi", onRetry: () => {} }));
}
it("keeps verified Student identity visible when the Organizer contract is unsupported", () => {
  const html = render("confirmed", "unsupported", ["student"]);
  expect(html).toContain("Đã xác minh"); expect(html).toContain("Chưa kiểm tra được");
  expect(html).not.toContain("Chưa xác minh"); expect(html).not.toContain("Chưa được cấp quyền");
});
it("keeps Organizer authorization visible when Student reads fail", () => {
  const html = render("error", "confirmed", ["organizer"]);
  expect(html).toContain("Đã được cấp quyền"); expect(html).toContain("Kiểm tra lại quyền");
});
it("shows both roles when the same wallet is Student and Organizer", () => {
  const html = render("confirmed", "confirmed", ["student", "organizer"]);
  expect(html).toContain("Đã xác minh"); expect(html).toContain("Đã được cấp quyền");
});
it("does not mistake connecting a new wallet for either verified role", () => {
  const html = render("absent", "absent", ["guest"]);
  expect(html).toContain("Chưa xác minh"); expect(html).toContain("Chưa được cấp quyền");
  expect(html).not.toContain("Đã xác minh"); expect(html).not.toContain("Đã được cấp quyền");
});
it("distinguishes pending checks from confirmed absence", () => {
  const html = render("loading", "loading");
  expect(html).toContain("Đang kiểm tra"); expect(html).not.toContain("Chưa được cấp quyền");
});
