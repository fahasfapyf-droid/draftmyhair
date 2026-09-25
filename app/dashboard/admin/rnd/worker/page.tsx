import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { RndWorkerMonitor } from "@/components/dashboard/admin/RndWorkerMonitor";

export default async function RnDWorkerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return (
    <DashboardLayout title="R&D Worker" description="Live operational state for the local Gemini worker, profiles, and exact-source capture." sidebar={<AdminSidebar />}>
      <RndWorkerMonitor />
    </DashboardLayout>
  );
}
