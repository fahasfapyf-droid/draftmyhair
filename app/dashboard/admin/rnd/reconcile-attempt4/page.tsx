import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { RndRecoveredArtifactForm } from "@/components/dashboard/admin/RndAttempt4RecoveredArtifactForm";

export default async function RndAttempt4ReconcilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return (
    <DashboardLayout title="R&D Recovered Artifact Reconciliation - Attempt 4"
      description="Attach the checksum-pinned Gemini result to the interrupted fourth attempt and run the existing QA gates."
      sidebar={<AdminSidebar />}>
      <RndRecoveredArtifactForm />
    </DashboardLayout>
  );
}
