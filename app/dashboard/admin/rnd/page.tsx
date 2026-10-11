import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { RndConsole } from "@/components/dashboard/admin/RndConsole";
import { RndRunBuilder } from "@/components/dashboard/admin/RndRunBuilder";

export default async function RndAdminPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardLayout
      title="R&D Run Builder & Control"
      description="Build controlled R&D runs, connect Gemini, monitor the worker, and inspect automated QA."
      sidebar={<AdminSidebar />}
    >
      <div className="space-y-8">
        <RndRunBuilder />
        <RndConsole />
      </div>
    </DashboardLayout>
  );
}
