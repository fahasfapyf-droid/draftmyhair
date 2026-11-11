import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { RndAttempt5RecoveredArtifactForm } from "@/components/dashboard/admin/RndAttempt5RecoveredArtifactForm";

export default async function RndAttempt5ReconcilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return (
    <DashboardLayout title="R&D Recovered Artifact Reconciliation - Attempt 5"
      description="Attach the checksum-pinned Gemini result to the interrupted fifth attempt and run the existing QA gates."
      sidebar={<AdminSidebar />}>
      <RndAttempt5RecoveredArtifactForm />
    </DashboardLayout>
  );
}
