import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { RndConsole } from "@/components/dashboard/admin/RndConsole";

export default async function RndAdminPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardLayout
      title="R&D Generation"
      description="Run and inspect controlled hairstyle-engine regression tests."
      sidebar={<AdminSidebar />}
    >
      <RndConsole />
    </DashboardLayout>
  );
}
