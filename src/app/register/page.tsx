import { RegisterView } from "@/views/register";
import { pageMetadata } from "@/lib/seo.server";
export const generateMetadata = () => pageMetadata("register");

export default function RegisterPage() {
  return <RegisterView />;
}
