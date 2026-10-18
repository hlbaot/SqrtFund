import { RoundsView } from "@/views/rounds";
import { pageMetadata } from "@/lib/seo.server";
export const generateMetadata = () => pageMetadata("round");

export default function RoundListPage() {
  return <RoundsView />;
}
