import { HomeView } from "@/views/home";
import { pageMetadata } from "@/lib/seo.server";
export async function generateMetadata() {
  const metadata = await pageMetadata("home");
  return { ...metadata, title: { absolute: `${metadata.title} | SqrtFund` } };
}

export default function HomePage() {
  return <HomeView />;
}
