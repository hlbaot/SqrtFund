import { GuideView } from "@/views/guide";
import { getRequestLocale } from "@/lib/seo.server";
export async function generateMetadata() {
  const vi = (await getRequestLocale()) === "vi";
  return {
    title: vi ? "Hướng dẫn đóng góp" : "Contribution guide",
    description: vi
      ? "Các bước chuẩn bị ví, xác thực Student và đóng góp trên Avalanche Fuji."
      : "Prepare your wallet, verify Student status and contribute on Avalanche Fuji.",
    alternates: { canonical: "/guide" },
  };
}
export default function GuidePage() {
  return <GuideView />;
}
