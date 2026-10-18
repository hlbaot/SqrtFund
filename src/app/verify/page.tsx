import { VerifyView } from "@/views/verify";
import { pageMetadata } from "@/lib/seo.server";
export const generateMetadata = () => pageMetadata("verify");
export default function VerifyPage() { return <VerifyView />; }
