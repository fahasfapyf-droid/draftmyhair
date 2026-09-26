import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { CalibrationReviewer } from "@/components/dashboard/admin/CalibrationReviewer";

export default async function RnDCalibrationPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardLayout
      title="R&D Blind QA Calibration"
      description="Review generated outputs without seeing the automated QA score."
      sidebar={<AdminSidebar />}
    >
      <CalibrationReviewer />
    </DashboardLayout>
  );
}
