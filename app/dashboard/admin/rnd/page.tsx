import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { RndRunBuilder } from "@/components/dashboard/admin/RndRunBuilder";

export default async function RnDRunPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return (
    <DashboardLayout
      title="R&D Run Builder"
      description="Select reusable source photos and validation targets, then queue the run."
      sidebar={<AdminSidebar />}
    >
      <RndRunBuilder />
    </DashboardLayout>
  );
}
