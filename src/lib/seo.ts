import type { Metadata } from "next";
import type { Locale } from "@/lib/copy";

export const DEFAULT_SITE_URL = "https://sqrt-fund.vercel.app";
export function getSiteUrl(): URL {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return new URL(DEFAULT_SITE_URL);
    return new URL(url.origin);
  } catch { return new URL(DEFAULT_SITE_URL); }
}

export const seoCopy = {
  en: {
    home: ["Quadratic funding for students", "SqrtFund helps student clubs explore quadratic funding, transparent donations and matching pools on Avalanche Fuji testnet."],
    rounds: ["Explore funding rounds", "Explore student funding rounds, approved projects and matching pools on SqrtFund's Avalanche Fuji testnet dApp."],
    round: ["Funding round overview", "View SqrtFund funding rounds, project leaderboards and matching allocations on Avalanche Fuji testnet."],
    detail: ["Funding round", "View approved student projects, round details and quadratic matching on SqrtFund."],
    verify: ["Verify your student identity", "Learn how to verify a university email and link your wallet to a shared Student identity for SqrtFund funding rounds."],
    admin: ["Administration", "Manage your SqrtFund funding rounds and project reviews."],
    my: ["My activity", "View your projects, donations and available actions on SqrtFund."],
    register: ["Register a project", "Submit your student project to a SqrtFund funding round."],
  },
  vi: {
    home: ["Quadratic Funding cho sinh viên", "SqrtFund giúp câu lạc bộ sinh viên tìm hiểu Quadratic Funding, đóng góp minh bạch và quỹ đối ứng trên mạng thử nghiệm Avalanche Fuji."],
    rounds: ["Khám phá vòng gọi vốn", "Khám phá các vòng gọi vốn sinh viên, dự án đã duyệt và quỹ đối ứng trên dApp SqrtFund, mạng thử nghiệm Avalanche Fuji."],
    round: ["Tổng quan vòng gọi vốn", "Xem vòng gọi vốn, bảng xếp hạng dự án và phân bổ quỹ đối ứng trên SqrtFund, mạng thử nghiệm Avalanche Fuji."],
    detail: ["Chi tiết vòng gọi vốn", "Xem các dự án sinh viên đã được duyệt, thông tin vòng và phân bổ matching trên SqrtFund."],
    verify: ["Xác thực danh tính sinh viên", "Tìm hiểu cách xác thực email trường và liên kết ví với danh tính Student dùng chung để tham gia các vòng gọi vốn SqrtFund."],
    admin: ["Quản trị", "Quản lý vòng gọi vốn và xét duyệt dự án trên SqrtFund."],
    my: ["Hoạt động của tôi", "Xem dự án, đóng góp và các thao tác của bạn trên SqrtFund."],
    register: ["Đăng ký dự án", "Gửi dự án sinh viên của bạn vào một vòng gọi vốn SqrtFund."],
  },
} as const;
export type SeoPage = keyof typeof seoCopy.en;
const paths: Record<SeoPage, string> = { home: "/", rounds: "/rounds", round: "/round", detail: "/round", verify: "/verify", admin: "/admin", my: "/my", register: "/register" };
export function metadataForPage(page: SeoPage, locale: Locale = "en", path = paths[page]): Metadata {
  const [title, description] = seoCopy[locale][page];
  const base = getSiteUrl();
  const url = new URL(path, base);
  const noindex = page === "admin" || page === "my" || page === "register";
  return {
    metadataBase: base, title, description,
    keywords: ["quadratic funding", "student clubs", "Avalanche Fuji", "quỹ sinh viên"],
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: "website", title: `${title} | SqrtFund`, description, url, siteName: "SqrtFund", locale: locale === "vi" ? "vi_VN" : "en_US", alternateLocale: locale === "vi" ? "en_US" : "vi_VN", images: [{ url: new URL("/opengraph-image", base), width: 1200, height: 630, alt: "SqrtFund — Quadratic Funding cho quỹ hoạt động sinh viên" }] },
    twitter: { card: "summary_large_image", title: `${title} | SqrtFund`, description, images: [new URL("/twitter-image", base)] },
  };
}
