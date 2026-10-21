import { Suspense } from "react";
import { AdminView } from "@/views/admin";
import { pageMetadata } from "@/lib/seo.server";
import { AdminSkeleton } from "@/components/common/PageSkeletons";
import { Container } from "@/components/layout/Container";

export const generateMetadata = () => pageMetadata("admin");

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-8 sm:py-10">
          <AdminSkeleton />
        </Container>
      }
    >
      <AdminView />
    </Suspense>
  );
}
