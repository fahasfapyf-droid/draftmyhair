import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { RndRecoveredArtifactForm } from "@/components/dashboard/admin/RndRecoveredArtifactForm";

export default async function RndReconcilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardLayout
      title="R&D Recovered Artifact Reconciliation"
      description="Attach the existing Gemini result to the interrupted attempt and run the normal QA gates."
      sidebar={<AdminSidebar />}
    >
      <RndRecoveredArtifactForm />
    </DashboardLayout>
  );
}
