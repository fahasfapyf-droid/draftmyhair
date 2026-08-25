import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminMasterPrompt } from "@/components/dashboard/admin/AdminMasterPrompt";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";

export default async function AdminMasterPromptPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardLayout
      title="Master Prompt"
      description="Manage the global identity and geometry-preservation prompt."
      sidebar={<AdminSidebar />}
    >
      <AdminMasterPrompt />
    </DashboardLayout>
  );
}
