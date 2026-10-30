import { Container } from "@/components/layout/Container";
import { PlatformRules } from "@/components/policy/PlatformRules";
export const metadata = { title: "Quy định và tiêu chí xét duyệt | SqrtFund", alternates: { canonical: "/rules" } };
export default function RulesPage() {
  return <Container className="max-w-4xl space-y-6 py-8"><PlatformRules /></Container>;
}
