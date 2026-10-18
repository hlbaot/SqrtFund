import { AdminView } from "@/views/admin";
import { pageMetadata } from "@/lib/seo.server";
export const generateMetadata = () => pageMetadata("admin");

export default function AdminPage() {
  return <AdminView />;
}
