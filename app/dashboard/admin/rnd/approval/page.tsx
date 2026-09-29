import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { RndApprovalQueue } from "@/components/dashboard/admin/RndApprovalQueue";

export default async function RndApprovalPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardLayout
      title="R&D Approval & History"
      description="Review automated R&D transformations that passed QA and inspect the complete approved-generation record."
      sidebar={<AdminSidebar />}
    >
      <RndApprovalQueue />
    </DashboardLayout>
  );
}
