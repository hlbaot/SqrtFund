import { RoundsView } from "@/views/rounds";
import { pageMetadata } from "@/lib/seo.server";
export const generateMetadata = () => pageMetadata("rounds");

export default function RoundsPage() {
  return <RoundsView />;
}
