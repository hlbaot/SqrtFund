import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { GuideView } from "@/views/guide";
import { FundingBreakdown } from "@/components/project/FundingBreakdown";
import {
  ContributionGuide,
  ContributionOverview,
} from "@/components/project/ContributionGuide";
import { ProjectClaimPanel } from "@/components/project/ProjectClaimPanel";
const f = vi.hoisted(() => ({
  wallet: `0x${"1".repeat(40)}`,
  chain: 43113,
  gas: 0n,
  gasError: false,
  connected: true,
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: f.wallet,
    isConnected: f.connected,
    chainId: f.chain,
  }),
  useSwitchChain: () => ({ switchChain: vi.fn() }),
  useBalance: () => ({
    data: f.gasError ? undefined : { value: f.gas },
    isError: f.gasError,
  }),
}));
vi.mock("@/components/layout/ConnectWalletButton",()=>({ConnectWalletButton:()=>createElement("button",null,"Kết nối ví")}));
vi.mock("@/hooks/useClaim", () => ({
  useClaim: () => ({ claim: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/context/locale", () => ({
  useLocale: () => ({ locale: "vi" }),
}));
const project = {
  id: "1",
  roundId: "round",
  name: "Project",
  category: "technology" as const,
  shortDescription: "",
  description: "",
  contactUrl: "",
  ownerAddress: `0x${"1".repeat(40)}`,
  totalDonated: 5,
  estimatedMatching: 10,
  supporterCount: 2,
  status: "approved" as const,
};
beforeEach(() => {
  f.connected = true;
  f.chain = 43113;
  f.wallet = project.ownerAddress;
  f.gas = 0n;
  f.gasError = false;
});
it("shows direct, estimated matching and total with a clear provisional label", () => {
  const html = renderToStaticMarkup(
    createElement(FundingBreakdown, { project }),
  );
  for (const text of [
    "Tiền góp trực tiếp",
    "Matching dự kiến",
    "Tổng dự kiến nhận",
    "5.00 USDC",
    "10.00 USDC",
    "15.00 USDC",
    "chưa phải số tiền đã nhận",
  ])
    expect(html).toContain(text);
  const settled = renderToStaticMarkup(
    createElement(FundingBreakdown, { project, finalized: true }),
  );
  expect(settled).toContain("—");
  expect(settled).not.toContain("15.00 USDC");
});
it("gives the next action for the actual missing prerequisite", () => {
  const props = {
    student: true,
    eligible: true,
    balanceReady: true,
    sufficient: false,
  };
  expect(
    renderToStaticMarkup(createElement(ContributionGuide, props)),
  ).toContain("/my#claim-usdc");
  f.chain = 1;
  expect(
    renderToStaticMarkup(createElement(ContributionGuide, props)),
  ).toContain("Chuyển sang Fuji");
  f.chain = 43113;
  expect(
    renderToStaticMarkup(
      createElement(ContributionGuide, { ...props, student: false }),
    ),
  ).toContain('href="/verify"');
  expect(
    renderToStaticMarkup(
      createElement(ContributionGuide, {
        ...props,
        checkingAccess: true,
        eligible: false,
      }),
    ),
  ).toContain("Đang kiểm tra quyền");
  expect(
    renderToStaticMarkup(
      createElement(ContributionGuide, { ...props, balanceReady: false }),
    ),
  ).toContain("Chưa đọc được số dư");
});
it("does not present a gas read failure as a confirmed zero balance", () => {
  f.gasError = true;
  const html = renderToStaticMarkup(
    createElement(ContributionGuide, {
      student: true,
      eligible: true,
      balanceReady: true,
      sufficient: true,
    }),
  );
  expect(html).toContain("Chưa đọc được số dư AVAX");
  expect(html).not.toContain("Nhận AVAX Fuji thử nghiệm qua faucet Core");
});
it("offers claim only to the owner after a known settlement", () => {
  const props = {
    project: { ...project, finalMatching: 2 },
    round: `0x${"2".repeat(40)}` as const,
    finalized: true,
    cancelled: false,
    onClaimed: vi.fn(),
  };
  const render = () =>
    renderToStaticMarkup(createElement(ProjectClaimPanel, props));
  expect(render()).toContain("7.00 USDC");
  expect(render()).toContain("Nhận tiền về ví chủ dự án");
  f.wallet = `0x${"3".repeat(40)}`;
  expect(render()).toContain("Chỉ ví chủ dự án");
  expect(render()).not.toContain("<button");
  expect(
    renderToStaticMarkup(
      createElement(ProjectClaimPanel, { ...props, cancelled: true }),
    ),
  ).toBe("");
});

it("shows the full checklist before wallet connection and does not treat cached balances as readiness", () => {
  f.connected = false;
  f.gas = 10n;
  const html = renderToStaticMarkup(
    createElement(ContributionGuide, {
      student: true,
      eligible: true,
      balanceReady: true,
      sufficient: true,
    }),
  );
  expect(html).toContain("Kết nối ví Core");
  expect(html).toContain("Kết nối ví bằng nút bên dưới");
  expect(html).toContain("Xác thực email và ví Student");
  expect(html).not.toContain("✓");
  expect(html).not.toContain("<button");
});
it("offers a visible mobile guide without requiring a connected wallet", () => {
  f.connected = false;
  const html = renderToStaticMarkup(
    createElement(ContributionOverview, { expanded: false, onOpen: vi.fn() }),
  );
  expect(html).toContain("Bạn mới tham gia? Bắt đầu từ đây");
  expect(html).toContain("Mở hướng dẫn và đóng góp");
  expect(html).toContain('aria-controls="mobile-contribution-panel"');
});

it("keeps the public guide reachable without an account or an active round",()=>{
 f.connected=false;const html=renderToStaticMarkup(createElement(GuideView));
 expect(html).toContain("chưa có round đang mở");expect(html).toContain('href="/verify"');expect(html).toContain('href="/round"');expect(html).toContain('href="/my#claim-usdc"');expect(html).toContain("Matching thay đổi");
 expect((html.match(/<h2/g)??[]).length).toBe(7);
});
