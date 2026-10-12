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
      title="R&D Approval Queue"
      description="Approve or reject automated hairstyle transformations that have passed the R&D QA gate."
      sidebar={<AdminSidebar />}
    >
      <RndApprovalQueue />
    </DashboardLayout>
  );
}
