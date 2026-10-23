import { RegisterView } from "@/views/register";
import { pageMetadata } from "@/lib/seo.server";
export const generateMetadata = () => pageMetadata("register");

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ round?: string | string[] }> }) {
  const { round } = await searchParams;
  return <RegisterView initialRound={Array.isArray(round) ? round[0] : round} />;
}
