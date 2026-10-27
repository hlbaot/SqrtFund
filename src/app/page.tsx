import { HomeView } from "@/views/home";
import { pageMetadata } from "@/lib/seo.server";
export async function generateMetadata() {
  const metadata = await pageMetadata("home");
  return { ...metadata, title: { absolute: `${metadata.title} | N-Power` } };
}

export default function HomePage() {
  return <HomeView />;
}
