import { MyView } from "@/views/my";
import { pageMetadata } from "@/lib/seo.server";
export const generateMetadata = () => pageMetadata("my");

export default function MyPage() {
  return <MyView />;
}
